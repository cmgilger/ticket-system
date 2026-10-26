// =============================================================
// conflicts.js
// The search behind the Conflict Check page.
//
// Each name entered on the form is compared against everyone the
// firm already knows about:
//   - client accounts (users table)
//   - people who submitted the intake form (tickets table)
//   - every party named in earlier conflict checks
//   - Clio Manage contacts, once services/clio.js is connected
//
// Two kinds of hit are reported:
//   'exact'    - the same name, ignoring case and extra spaces
//   'possible' - every word of one name appears in the other
//                ("John Smith" vs "John A. Smith"). These need a
//                human to decide, just like on the paper checklist.
//
// Not every hit is a conflict. Each known person is on a "side":
//   'client'  - someone the firm represents or who has inquired
//   'adverse' - someone named as an opposing/related party before
//   'staff'   - a lawyer or admin at the firm
// A hit is a CONFLICT when the sides clash:
//   - the prospective client was an adverse party before, or
//   - an opposing/co-defendant/related party is a client or staff.
// Other hits (e.g. the prospective client matching their own intake
// ticket) are shown as notes but don't count as a conflict.
// =============================================================

const db = require('../db/db');
const clio = require('./clio');

const ROLE_LABELS = {
  client: 'Prospective client',
  'co-defendant': 'Co-defendant',
  opposing: 'Opposing party',
  related: 'Other related party',
};

// "  John   SMITH " -> "john smith"
function normalize(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function compareNames(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return null;
  if (na === nb) return 'exact';

  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  // A single shared word ("Smith") is too weak to flag on its own.
  if (shorter.length >= 2 && shorter.every(w => longer.includes(w))) return 'possible';
  return null;
}

// Everything we compare against, loaded once per check.
function loadKnownPeople() {
  const people = [];

  for (const u of db.prepare('SELECT id, full_name, type FROM users').all()) {
    const label = u.type === 'user' ? 'client account' : `${u.type} account`;
    people.push({ name: u.full_name, side: u.type === 'user' ? 'client' : 'staff', source: `${label} #${u.id}` });
  }
  for (const t of db.prepare('SELECT id, name FROM tickets').all()) {
    people.push({ name: t.name, side: 'client', source: `intake ticket #${String(t.id).padStart(4, '0')}` });
  }
  const pastParties = db.prepare(`
    SELECT p.name, p.role, c.id AS check_id, c.client_name
    FROM conflict_parties p JOIN conflict_checks c ON c.id = p.check_id
  `).all();
  for (const p of pastParties) {
    const role = (ROLE_LABELS[p.role] || p.role).toLowerCase();
    const side = p.role === 'client' ? 'client' : 'adverse';
    people.push({ name: p.name, side, source: `${role} in conflict check #${p.check_id} (client: ${p.client_name})` });
  }
  return people;
}

// parties: [{ name, role }]. Returns the same list with a `matches`
// array on each, plus an overall hasConflict flag.
// It's async because the Clio search goes over the network.
async function runCheck(parties) {
  const known = loadKnownPeople();
  const results = await Promise.all(parties.map(async party => {
    // Clio does its own fuzzy search; we still run each hit through
    // compareNames so Clio results are judged the same way as ours.
    const clioContacts = await clio.searchContacts(party.name);
    const candidates = known.concat(
      // Clio contacts are treated as clients; refine this once you know
      // how your firm tags opposing parties in Clio.
      clioContacts.map(c => ({ name: c.name, side: 'client', source: `Clio contact ${c.id}` }))
    );

    const matches = [];
    for (const person of candidates) {
      const kind = compareNames(party.name, person.name);
      if (!kind) continue;
      const conflict = party.role === 'client'
        ? person.side === 'adverse'
        : person.side === 'client' || person.side === 'staff';
      matches.push({ kind, conflict, name: person.name, source: person.source });
    }
    // Conflicts first, then exact before possible.
    const rank = m => (m.conflict ? 0 : 2) + (m.kind === 'exact' ? 0 : 1);
    matches.sort((a, b) => rank(a) - rank(b));
    return { ...party, roleLabel: ROLE_LABELS[party.role], matches, conflict: matches.some(m => m.conflict) };
  }));

  return { results, hasConflict: results.some(r => r.conflict) };
}

// Saves the check (the "file in Conflict Check folder" step). Runs in
// a transaction so a check is never saved with only some of its parties.
const saveCheck = db.transaction((clientName, results, hasConflict, userId) => {
  const info = db.prepare(
    'INSERT INTO conflict_checks (client_name, has_conflict, completed_by) VALUES (?, ?, ?)'
  ).run(clientName, hasConflict ? 1 : 0, userId);

  const insertParty = db.prepare(
    'INSERT INTO conflict_parties (check_id, name, role, match_summary) VALUES (?, ?, ?, ?)'
  );
  for (const r of results) {
    const summary = r.matches.length
      ? r.matches.map(m => `${m.conflict ? 'CONFLICT' : 'note'}, ${m.kind}: ${m.name} (${m.source})`).join('; ')
      : null;
    insertParty.run(info.lastInsertRowid, r.name, r.role, summary);
  }
  return info.lastInsertRowid;
});

module.exports = { runCheck, saveCheck, compareNames, ROLE_LABELS };
