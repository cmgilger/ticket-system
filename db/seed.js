// =============================================================
// seed.js
// Fills an empty database with demo accounts, tickets, and invoices
// so there's something to click through.
//
//     npm run seed            adds demo data (only if there are no users yet)
//     npm run seed -- --reset WIPES ALL DATA first, then adds demo data
//
// Every demo account uses the password in DEMO_PASSWORD below.
// Change these passwords (Admin Panel -> Users -> Edit) before the
// site is used by real people.
// =============================================================

const db = require('./db');
const { hashPassword } = require('../middleware/auth');

const DEMO_PASSWORD = 'ChangeMe123!';
const reset = process.argv.includes('--reset');

if (reset) {
  db.exec(`
    DELETE FROM conflict_parties;
    DELETE FROM conflict_checks;
    DELETE FROM invoices;
    DELETE FROM tickets;
    DELETE FROM users;
  `);
  console.log('All data deleted.');
} else if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
  console.log('The database already has users, so nothing was added.');
  console.log('Run "npm run seed -- --reset" to wipe it and start over.');
  process.exit(0);
}

const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, full_name, phone, email, type) VALUES (?, ?, ?, ?, ?, ?)'
);
const insertTicket = db.prepare(
  'INSERT INTO tickets (name, phone, email, request, status, closure_reason, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const insertInvoice = db.prepare(
  'INSERT INTO invoices (user_id, amount_cents, reason, created_by) VALUES (?, ?, ?, ?)'
);

// One transaction: either all of the demo data is added or none of it.
db.transaction(() => {
  const hash = hashPassword(DEMO_PASSWORD);
  const user = (...args) => insertUser.run(...args).lastInsertRowid;

  user('admin', hash, 'Alex Admin',   '(555) 555-0101', 'admin@example.com',  'admin');
  const lawyer = user('lawyer', hash, 'Lee Lawyer',   '(555) 555-0102', 'lawyer@example.com', 'lawyer');
  const client = user('client', hash, 'Casey Client', '(555) 555-0103', 'client@example.com', 'user');

  insertTicket.run('Casey Client', '(555) 555-0103', 'client@example.com',
    'My landlord is refusing to return my security deposit after I moved out.', 'Under Review', null, client);
  insertTicket.run('Casey Client', '(555) 555-0103', 'client@example.com',
    'Question about updating my will.', 'Closed', 'Referred to estate planning partner; client chose to wait until next year.', client);
  insertTicket.run('Jordan Smith', '(555) 555-0199', 'jordan@example.com',
    'I was in a car accident last month and the other driver\'s insurance is not responding.', 'Open', null, null);

  insertInvoice.run(client, 25000, 'Initial consultation', lawyer);
  insertInvoice.run(client, 72550, 'Demand letter and document review', lawyer);
})();

console.log('Demo data added. Log in with any of these (password: ' + DEMO_PASSWORD + '):');
console.log('  admin   (admin)');
console.log('  lawyer  (lawyer)');
console.log('  client  (client)');
