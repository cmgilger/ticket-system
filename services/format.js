// =============================================================
// format.js
// Small display helpers. app.js puts these on app.locals so every
// Pug template can call them, e.g. #{money(invoice.amount_cents)}.
// =============================================================

const { ticketNumber } = require('./gmail');

// 12550 -> "$125.50"
function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// "125.50" or "$1,250" (from a form) -> 12550 / 125000. Returns null if invalid.
function parseDollars(text) {
  const cleaned = String(text || '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

// SQLite stores '2026-10-13 14:30:00' in UTC. Show it as a local date.
function date(sqliteTimestamp) {
  if (!sqliteTimestamp) return '';
  const d = new Date(sqliteTimestamp.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// A CSS-friendly version of a status, e.g. 'Under Review' -> 'under-review'.
function slug(text) {
  return String(text).toLowerCase().replace(/\s+/g, '-');
}

module.exports = { money, parseDollars, date, slug, ticketNumber };
