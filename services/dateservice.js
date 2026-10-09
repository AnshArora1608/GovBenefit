
// services/dateService.js

const fs = require("fs");
const { parse } = require("csv-parse/sync");

const START_COLS = [
  "scheme_open_date",
  "start_date",
  "opening_date",
  "open_date",
  "begin_date",
  "launch_date",
  "scheme_start_date",
  "from_date",
  "application_start_date"
];

const END_COLS = [
  "scheme_close_date",
  "end_date",
  "closing_date",
  "close_date",
  "last_date",
  "deadline",
  "scheme_end_date",
  "to_date",
  "application_end_date"
];

const CLOSING_SOON_DAYS = 15;

const ALWAYS =
  /ongoing|throughout|always|round the year|all year|no (last )?date|no deadline|till further|until further|continuous|perpetual|open all/i;

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3,
  may: 4, jun: 5, jul: 6, aug: 7,
  sep: 8, oct: 9, nov: 10, dec: 11
};

const norm = value =>
  String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function iso(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (value == null) return null;

  const str = String(value).trim();

  if (!str || /^(nan|null|none|n\/a|na|-)$/i.test(str)) {
    return null;
  }

  let match;

  // YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
  if (
    (match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/))
  ) {
    return iso(+match[1], +match[2] - 1, +match[3]);
  }

  // Indian format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  if (
    (match = str.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/))
  ) {
    const year = +match[3] < 100 ? 2000 + +match[3] : +match[3];
    return iso(year, +match[2] - 1, +match[1]);
  }

  // DD Month YYYY
  if (
    (match = str.match(
      /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/i
    ))
  ) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];

    if (month !== undefined) {
      return iso(+match[3], month, +match[1]);
    }
  }

  // Month DD, YYYY
  if (
    (match = str.match(
      /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i
    ))
  ) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()];

    if (month !== undefined) {
      return iso(+match[3], month, +match[2]);
    }
  }

  return null;
}

function todayUTC() {
  const now = new Date();

  return Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function dayDiff(date) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - todayUTC()) / 86400000
  );
}

function getStatus(start, end, always = false) {
  if (start && dayDiff(start) > 0) {
    return {
      state: "upcoming",
      days: dayDiff(start)
    };
  }

  if (end) {
    const days = dayDiff(end);

    if (days < 0) {
      return {
        state: "closed",
        days: Math.abs(days)
      };
    }

    return {
      state: days <= CLOSING_SOON_DAYS ? "closing" : "open",
      days
    };
  }

  if (always) {
    return { state: "always" };
  }

  return {
    state: start ? "open" : "unknown"
  };
}

function loadDatesLookup(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Scheme dataset not found: ${csvPath}`);
  }

  const rows = parse(fs.readFileSync(csvPath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    bom: true
  });

  const lookup = new Map();

  if (!rows.length) return lookup;

  const keys = Object.keys(rows[0]);

  const findColumn = candidates =>
    keys.find(key =>
      candidates.includes(key.toLowerCase().trim())
    );

  const nameCol = findColumn(["scheme_name", "name", "short_title"]);
  const startCol = findColumn(START_COLS);
  const endCol = findColumn(END_COLS);

  if (!nameCol) {
    throw new Error("No scheme name column found in the dataset.");
  }

  if (!startCol && !endCol) {
    console.warn(
      "[dates] No supported opening or closing date columns found."
    );
  }

  for (const row of rows) {
    const name = norm(row[nameCol]);

    if (!name) continue;

    const startRaw = startCol ? row[startCol] : "";
    const endRaw = endCol ? row[endCol] : "";

    lookup.set(name, {
      start: parseDate(startRaw),
      end: parseDate(endRaw),
      always: ALWAYS.test(`${startRaw} ${endRaw}`)
    });
  }

  return lookup;
}

function attachDates(schemes, lookup) {
  return (schemes || []).map(scheme => {
    const row = lookup?.get(norm(scheme.scheme_name)) || {};

    const start =
      parseDate(scheme.start_date) ||
      parseDate(scheme.scheme_open_date) ||
      row.start ||
      null;

    const end =
      parseDate(scheme.end_date) ||
      parseDate(scheme.scheme_close_date) ||
      row.end ||
      null;

    const always =
      !!row.always ||
      ALWAYS.test(
        `${scheme.scheme_close_date || ""} ${scheme.end_date || ""}`
      );

    return {
      ...scheme,
      start_date: start,
      end_date: end,
      date_status: getStatus(start, end, always)
    };
  });
}

module.exports = {
  loadDatesLookup,
  attachDates,
  parseDate,
  getStatus
};
