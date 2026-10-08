// services/documentService.js
// Install:  npm i csv-parse
// Uses the documents already present in your dataset (schemes_clean.csv): no scraping, fast, reliable.
const fs = require("fs");
const { parse } = require("csv-parse/sync");

// Possible column names for the documents field in your CSV
const DOC_COLS = ["documents", "documents_required", "required_documents", "docs", "document_list"];

// Canonical names so "Aadhar card copy" and "Aadhaar Card" are counted as the same document
const CANON = [
  ["Aadhaar Card", /aadhaar|aadhar|आधार/i],
  ["PAN Card", /\bpan\b|पैन/i],
  ["Income Certificate", /income (certificate|proof)|आय प्रमाण/i],
  ["Caste Certificate", /caste (certificate|proof)|जाति प्रमाण/i],
  ["Domicile / Residence Proof", /domicile|residen(ce|t) (proof|certificate)|निवास प्रमाण|मूल निवास/i],
  ["Bank Account Details", /bank (account|passbook|details)|passbook|बैंक/i],
  ["Ration Card", /ration card|राशन कार्ड/i],
  ["Passport Size Photograph", /photograph|passport size|photo\b|फोटो/i],
  ["Age / Date of Birth Proof", /date of birth|age proof|birth certificate|जन्म प्रमाण/i],
  ["Disability Certificate", /disability (certificate|proof)|divyang|दिव्यांग/i],
  ["BPL Card", /\bbpl\b|below poverty/i],
  ["Educational Certificates / Marksheet", /mark ?sheet|educational (certificate|qualification)|degree|diploma/i],
  ["Mobile Number", /mobile number|phone number|मोबाइल/i],
  ["Business / Project Report", /project report|business plan|udyam|msme registration/i]
];

const isTrue = v => v === true || v === "true" || v === "on" || v === "1";
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/* ---------- 1. Raw cell -> clean list ---------- */
function splitRaw(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);

  const s = String(raw).trim();
  if (!s || /^(nan|null|none|n\/a|na|-)$/i.test(s)) return [];

  if (s.startsWith("[")) {                                   // JSON-like list
    for (const t of [s, s.replace(/'/g, '"')]) {
      try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(String); } catch (e) {}
    }
  }
  let parts = s.split(/\r?\n|;|\||•|\u2022|(?:^|\s)\d{1,2}[.)]\s+/);
  parts = parts.map(p => p.trim()).filter(Boolean);
  if (parts.length === 1 && parts[0].includes(",") && parts[0].length < 300) {
    parts = parts[0].split(",").map(p => p.trim()).filter(Boolean);   // comma separated
  }
  return parts;
}

function normalizeDocs(raw) {
  const seen = new Set(), out = [];
  splitRaw(raw).forEach(item => {
    let t = item.replace(/^[\s\-*•\d.)]+/, "").replace(/[.\s]+$/, "").replace(/\s+/g, " ");
    if (t.length < 3 || t.length > 110) return;
    const hit = CANON.find(([, re]) => re.test(t));
    const name = hit ? hit[0] : t.charAt(0).toUpperCase() + t.slice(1);
    if (!seen.has(norm(name))) { seen.add(norm(name)); out.push(name); }
  });
  return out;
}

/* ---------- 2. Documents suggested by the user's own profile ---------- */
function profileDocs(p) {
  const out = [];
  if (!p) return out;
  if (["SC", "ST", "OBC"].includes(p.social_cat)) out.push("Caste Certificate");
  if (p.income !== undefined && p.income !== "") out.push("Income Certificate");
  if (isTrue(p.bpl)) out.push("BPL Card");
  if (isTrue(p.disability)) out.push("Disability Certificate");
  if (isTrue(p.minority)) out.push("Minority Community Certificate / Declaration");
  out.push("Aadhaar Card", "Bank Account Details");
  return out;
}

/* ---------- 3. Load docs from your CSV ---------- */
function loadDocsLookup(csvPath) {
  const rows = parse(fs.readFileSync(csvPath), { columns: true, skip_empty_lines: true, relax_quotes: true });
  const col = DOC_COLS.find(c => rows.length && c in rows[0]);
  const map = new Map();
  if (!col) { console.warn("[documents] No documents column found. Set DOC_COLS to your column name."); return map; }
  rows.forEach(r => map.set(norm(r.scheme_name), r[col]));
  return map;
}

/* ---------- 4. Attach to recommendations + master checklist ---------- */
function attachDocuments(recommendations, profile, lookup) {
  const count = new Map();

  const schemes = (recommendations || []).map(s => {
    const raw = s.documents != null ? s.documents : lookup && lookup.get(norm(s.scheme_name));
    const docs = normalizeDocs(raw);
    const have = new Set(docs.map(norm));

    // Only suggest profile docs that the scheme list doesn't already include
    const extra = profileDocs(profile).filter(d => !have.has(norm(d)));
    const fallback = docs.length === 0;

    new Set([...docs, ...extra]).forEach(d => count.set(d, (count.get(d) || 0) + 1));
    return Object.assign({}, s, { documents: docs, docs_profile: extra, docs_fallback: fallback });
  });

  const master = [...count.entries()]
    .map(([name, n]) => ({ name, count: n, total: schemes.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);

  return { schemes, master };
}

module.exports = { loadDocsLookup, attachDocuments, normalizeDocs, profileDocs };
