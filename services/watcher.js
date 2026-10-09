// services/watcher.js
// Install:  npm i cheerio nodemailer
// Watches scheme pages for new circulars / notifications and (optionally) emails subscribers.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");

const FILE = path.join(__dirname, "..", "data", "watch.json");
const EVERY = 6 * 60 * 60 * 1000;                 // re-check every 6 hours
const CIRC = /circular|notification|notice|guideline|amendment|advertisement|अधिसूचना|परिपत्र|सूचना|दिशानिर्देश/i;

let db = { pages: {}, subs: [] };
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) {}
const save = () => {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db, null, 1)); } catch (e) {}
};

/* Basic SSRF guard: only public http(s) URLs. For production, also allow-list your dataset's source_url values. */
function isSafe(u) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return false;
    const h = x.hostname;
    return !(/^(localhost|0\.0\.0\.0|\[::1?\])$/i.test(h) || /^(127|10|0)\./.test(h) ||
             /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || !h.includes("."));
  } catch (e) { return false; }
}

async function getHtml(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (SchemeFinderBot)" } });
    return r.ok ? await r.text() : "";
  } catch (e) { return ""; } finally { clearTimeout(t); }
}

/* Fingerprint = list of circular/notice links if the page has any, else the page text */
function snapshot(html, base) {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  const seen = new Set(), circulars = [];
  $("a").each((_, a) => {
    const text = $(a).text().replace(/\s+/g, " ").trim();
    const href = $(a).attr("href");
    if (!text || !href || text.length > 160 || !CIRC.test(text)) return;
    try {
      const abs = new URL(href, base).href;
      if (!seen.has(abs)) { seen.add(abs); circulars.push({ text, href: abs }); }
    } catch (e) {}
  });
  const top = circulars.slice(0, 5);
  const basis = top.length
    ? top.map(l => l.text + "|" + l.href).join("\n")
    : $("body").text().replace(/\s+/g, " ").trim().toLowerCase().slice(0, 20000);
  return { hash: crypto.createHash("sha1").update(basis).digest("hex"), circulars: top };
}

async function checkUrl(url) {
  if (!isSafe(url)) return null;
  const prev = db.pages[url];
  const html = await getHtml(url);
  const now = Date.now();
  if (!html) {
    db.pages[url] = Object.assign({}, prev, { checkedAt: now, error: true });
    save();
    return db.pages[url];
  }
  const s = snapshot(html, url);
  const changed = !!(prev && prev.hash && prev.hash !== s.hash);
  db.pages[url] = { hash: s.hash, circulars: s.circulars, checkedAt: now, changedAt: changed ? now : (prev && prev.changedAt) || null };
  if (changed) notify(url, s.circulars);
  save();
  return db.pages[url];
}

/* Status for wishlist page. New URLs get an immediate first check (max 4 per request). */
async function getStatus(urls) {
  const out = {};
  let fresh = 0;
  for (const u of urls) {
    if (!isSafe(u)) continue;
    if (!db.pages[u] && fresh < 4) { fresh++; await checkUrl(u); }
    out[u] = db.pages[u] || null;
  }
  return out;
}

/* ---------- Email alerts (optional: set SMTP_* env vars) ---------- */
function subscribe(email, items) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ""))) return false;
  const clean = (items || []).filter(i => i && isSafe(i.url)).slice(0, 50)
    .map(i => ({ url: i.url, name: String(i.name || "").slice(0, 150), end: /^\d{4}-\d{2}-\d{2}$/.test(i.end || "") ? i.end : null }));
  let sub = db.subs.find(s => s.email === email);
  if (!sub) { sub = { email, items: [] }; db.subs.push(sub); }
  clean.forEach(i => {
    const old = sub.items.find(x => x.url === i.url);
    if (old) { old.name = i.name; old.end = i.end; } else sub.items.push(i);
  });
  save();
  clean.forEach(i => { if (!db.pages[i.url]) checkUrl(i.url); });     // start baseline now
  return true;
}

let mailer = null;
function getMailer() {
  if (mailer !== null) return mailer;
  try {
    mailer = process.env.SMTP_HOST ? require("nodemailer").createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    }) : false;
  } catch (e) { mailer = false; }
  return mailer;
}

function notify(url, circulars) {
  const m = getMailer();
  if (!m) return;
  db.subs.forEach(sub => {
    const item = sub.items.find(i => i.url === url);
    if (!item) return;
    const lines = circulars.map(c => "- " + c.text + ": " + c.href).join("\n");
    m.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER, to: sub.email,
      subject: "Update on a scheme you saved: " + (item.name || "Government scheme"),
      text: "The official page of \"" + item.name + "\" has new updates.\n\n" + url + "\n\n" +
            (lines ? "Latest circulars / notices:\n" + lines + "\n\n" : "") +
            "Please read the notice on the official site before applying."
    }).catch(() => {});
  });
}

/* Deadline reminders: one mail at 7 days left, one at 1 day left */
function remindDeadlines() {
  const m = getMailer();
  if (!m) return;
  const n = new Date(), today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  db.subs.forEach(sub => sub.items.forEach(it => {
    if (!it.end) return;
    const days = Math.round((Date.parse(it.end + "T00:00:00Z") - today) / 864e5);
    if (days < 0 || days > 7) return;
    const key = days <= 1 ? "d1" : "d7";
    it.reminded = it.reminded || {};
    if (it.reminded[key]) return;
    it.reminded[key] = true;
    m.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER, to: sub.email,
      subject: "Reminder: " + (it.name || "scheme") + " closes " + (days === 0 ? "today" : "in " + days + " day" + (days === 1 ? "" : "s")),
      text: "The last date for \"" + it.name + "\" is " + it.end + ".\n\nApply here: " + it.url + "\n\nKeep your documents ready before applying."
    }).catch(() => {});
  }));
  save();
}

/* ---------- Scheduler ---------- */
async function checkAll() {
  remindDeadlines();
  for (const u of Object.keys(db.pages).slice(0, 200)) {
    await checkUrl(u);
    await new Promise(r => setTimeout(r, 500));       // be polite to government servers
  }
}
let started = false;
function start() {
  if (started) return;
  started = true;
  setTimeout(checkAll, 30 * 1000);
  setInterval(checkAll, EVERY).unref();
}

module.exports = { getStatus, subscribe, checkUrl, start };