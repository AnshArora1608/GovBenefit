// services/dateService.js
// Install:  npm i csv-parse   (already installed if you use documentService.js)
// Reads start / end dates of each scheme from your dataset and works out the status (open, closing soon, closed...).
const fs = require("fs");
const { parse } = require("csv-parse/sync");

// Possible column names in your CSV. Add yours here if it is different.
const START_COLS = ["start_date", "opening_date", "open_date", "begin_date", "launch_date", "scheme_start_date", "from_date", "application_start_date"];
const END_COLS = ["end_date", "closing_date", "close_date", "last_date", "deadline", "scheme_end_date", "to_date", "application_end_date"];

const CLOSING_SOON_DAYS = 15;
const ALWAYS = /ongoing|throughout|always|round the year|all year|no (last )?date|no deadline|till further|until further|continuous|perpetual|open all/i;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

function iso(y, m, d) {                                    // returns "YYYY-MM-DD" or null if invalid
  const t = new Date(Date.UTC(y, m, d));
  if (isNaN(t) || t.getUTCMonth() !== m || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

/* Accepts 2026-03-31, 31/03/2026, 31-03-2026, 31 March 2026, March 31, 2026 */
function parseDate(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /^(nan|null|none|n\/a|na|-)$/i.test(s)) return null;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) {       // Indian format: day first
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return iso(y, +m[2] - 1, +m[1]);
  }
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/)) && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined)
    return iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/)) && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined)
    return iso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return null;
}

const todayUTC = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
const dayDiff = (isoDate) => Math.round((Date.parse(isoDate + "T00:00:00Z") - todayUTC()) / 864e5);

function getStatus(start, end, always) {
  if (start && dayDiff(start) > 0) return { state: "upcoming", days: dayDiff(start) };
  if (end) {
    const d = dayDiff(end);
    if (d < 0) return { state: "closed", days: -d };
    return { state: d <= CLOSING_SOON_DAYS ? "closing" : "open", days: d };
  }
  if (always) return { state: "always" };
  return { state: start ? "open" : "unknown" };
}

function loadDatesLookup(csvPath) {
  const rows = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true, relax_quotes: true });
  const map = new Map();
  if (!rows.length) return map;
  const keys = Object.keys(rows[0]);
  const find = list => keys.find(k => list.includes(k.toLowerCase().trim()));
  const sc = find(START_COLS), ec = find(END_COLS);
  if (!sc && !ec) console.warn("[dates] No start/end date column found in the CSV. Add your column names to START_COLS / END_COLS.");
  rows.forEach(r => {
    const endRaw = ec ? r[ec] : "";
    map.set(norm(r.scheme_name), {
      start: sc ? parseDate(r[sc]) : null,
      end: parseDate(endRaw),
      always: ALWAYS.test(String(endRaw || ""))
    });
  });
  return map;
}

function attachDates(schemes, lookup) {
  return (schemes || []).map(s => {
    const row = (lookup && lookup.get(norm(s.scheme_name))) || {};
    const start = parseDate(s.start_date) || row.start || null;
    const end = parseDate(s.end_date) || row.end || null;
    const always = !!row.always || ALWAYS.test(String(s.end_date || ""));
    return Object.assign({}, s, { start_date: start, end_date: end, date_status: getStatus(start, end, always) });
  });
}

module.exports = { loadDatesLookup, attachDates, parseDate, getStatus };
