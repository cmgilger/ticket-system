// lawyer + admin tools: ticket queue, conflict check, invoices

const db = require('../db/db');
const { requireRole } = require('../middleware/auth');
const { runCheck, saveCheck } = require('../services/conflicts');
const { parseDollars, money } = require('../services/format');
const gmail = require('../services/gmail');

var express = require('express');
var router = express.Router();

router.use(requireRole('admin', 'lawyer'));

const TICKET_STATUSES = ['Open', 'Under Review', 'Closed'];

const allTickets = db.prepare(`
  SELECT t.*, u.username
  FROM tickets t LEFT JOIN users u ON u.id = t.user_id
  ORDER BY (t.status = 'Closed'), t.created_at DESC, t.id DESC
`);
const findTicket = db.prepare('SELECT * FROM tickets WHERE id = ?');
const updateTicket = db.prepare('UPDATE tickets SET status = ?, closure_reason = ? WHERE id = ?');

const activeClients = db.prepare(
  "SELECT id, username, full_name, email FROM users WHERE type = 'user' AND status = 'Open' ORDER BY full_name"
);
const allInvoices = db.prepare(`
  SELECT i.*, u.username, u.full_name, u.email, c.full_name AS created_by_name
  FROM invoices i
  JOIN users u ON u.id = i.user_id
  LEFT JOIN users c ON c.id = i.created_by
  ORDER BY i.created_at DESC, i.id DESC
`);
const insertInvoice = db.prepare(
  'INSERT INTO invoices (user_id, amount_cents, reason, created_by) VALUES (?, ?, ?, ?)'
);
const findClient = db.prepare("SELECT * FROM users WHERE id = ? AND type = 'user'");

const staffEmails = db.prepare(
  "SELECT email FROM users WHERE type IN ('admin', 'lawyer') AND status = 'Open'"
);
const recentChecks = db.prepare(`
  SELECT c.*, u.full_name AS completed_by_name
  FROM conflict_checks c LEFT JOIN users u ON u.id = c.completed_by
  ORDER BY c.created_at DESC, c.id DESC LIMIT 25
`);
const findCheck = db.prepare(`
  SELECT c.*, u.full_name AS completed_by_name
  FROM conflict_checks c LEFT JOIN users u ON u.id = c.completed_by WHERE c.id = ?
`);
const partiesForCheck = db.prepare('SELECT * FROM conflict_parties WHERE check_id = ? ORDER BY id');

// Forms may send one value or several for the same field name.
function toList(value) {
  return (Array.isArray(value) ? value : [value]).map(v => (v || '').trim()).filter(Boolean);
}

// Where to go after updating a ticket: back to the admin panel if
// that's where the form was, otherwise the staff ticket queue.
function ticketReturnPath(value) {
  return value === '/admin' ? '/admin?tab=tickets' : '/staff/tickets';
}


/* ---------- Ticket queue ---------- */

router.get('/', function(req, res, next) {
  res.redirect('/staff/tickets');
});

router.get('/tickets', function(req, res, next) {
  const tickets = allTickets.all().map(t => ({ ...t, replyUrl: gmail.replyToTicketUrl(t) }));
  res.render('staff/tickets', { title: 'Ticket Queue', tickets, statuses: TICKET_STATUSES });
});

/* POST status + closure reason. Also used by the admin panel. */
router.post('/tickets/:id', function(req, res, next) {
  const ticket = findTicket.get(req.params.id);
  if (!ticket) return next();

  const status = req.body.status;
  if (!TICKET_STATUSES.includes(status)) {
    req.flash('error', 'Unknown status.');
    return res.redirect(ticketReturnPath(req.body.return_to));
  }
  const reason = (req.body.closure_reason || '').trim() || null;

  updateTicket.run(status, reason, ticket.id);
  req.flash('success', `Ticket ${gmail.ticketNumber(ticket.id)} updated.`);
  res.redirect(ticketReturnPath(req.body.return_to));
});


/* ---------- Conflict check ---------- */

router.get('/conflict-check', function(req, res, next) {
  res.render('staff/conflict-check', { title: 'Conflict Check', form: {}, checks: recentChecks.all() });
});

router.post('/conflict-check', async function(req, res, next) {
  try {
    const form = {
      client_name: (req.body.client_name || '').trim(),
      client_email: (req.body.client_email || '').trim(),
      co_defendants: toList(req.body.co_defendant),
      opposing: toList(req.body.opposing),
      related: toList(req.body.related),
    };

    if (!form.client_name || form.opposing.length === 0) {
      return res.status(400).render('staff/conflict-check', {
        title: 'Conflict Check', form, checks: recentChecks.all(),
        error: 'Enter the prospective client and at least one opposing party.',
      });
    }

    const parties = [
      { name: form.client_name, role: 'client' },
      ...form.co_defendants.map(name => ({ name, role: 'co-defendant' })),
      ...form.opposing.map(name => ({ name, role: 'opposing' })),
      ...form.related.map(name => ({ name, role: 'related' })),
    ];

    const { results, hasConflict } = await runCheck(parties);
    const checkId = saveCheck(form.client_name, results, hasConflict, req.user.id);

    res.render('staff/conflict-result', {
      title: 'Conflict Check Result',
      ...buildResultView(checkId, form.client_name, form.client_email, results, hasConflict, req.user),
    });
  } catch (err) {
    next(err);
  }
});

/* GET a past check from the "folder". */
router.get('/conflict-check/:id', function(req, res, next) {
  const check = findCheck.get(req.params.id);
  if (!check) return next();
  res.render('staff/conflict-record', {
    title: `Conflict Check #${check.id}`,
    check,
    parties: partiesForCheck.all(check.id),
  });
});

// Builds the result page data, including the two Gmail drafts.
function buildResultView(checkId, clientName, clientEmail, results, hasConflict, user) {
  const lines = results.map(r => {
    const verdict = (r.conflict ? 'CONFLICT' : 'No conflict') + r.matches
      .map(m => `\n      - ${m.conflict ? 'conflict' : 'note'}, ${m.kind} match: ${m.name} (${m.source})`).join('');
    return `  ${r.roleLabel}: ${r.name}: ${verdict}`;
  }).join('\n');

  const firmDraft = gmail.composeUrl({
    to: staffEmails.all().map(s => s.email),
    subject: `Conflict check #${checkId}: ${clientName}: ${hasConflict ? 'CONFLICT FOUND' : 'clear'}`,
    body: `Conflict check #${checkId}, completed by ${user.full_name}.\n\n${lines}\n`,
  });

  // The letter to the client must NOT name who the conflict is with:
  // that would disclose another client's information.
  const clientDraft = clientEmail ? gmail.composeUrl({
    to: clientEmail,
    subject: 'Regarding your inquiry',
    body: `Dear ${clientName},\n\nThank you for contacting our firm. After reviewing your inquiry, ` +
      `we have determined that we are unable to represent you in this matter due to a conflict of interest. ` +
      `This is not a judgment on the merits of your matter. We encourage you to contact another attorney promptly, ` +
      `as deadlines may apply to your claim.\n\nSincerely,\n${user.full_name}\n`,
  }) : null;

  return { checkId, clientName, clientEmail, results, hasConflict, firmDraft, clientDraft };
}


/* ---------- Invoices ---------- */

router.get('/invoices', function(req, res, next) {
  res.render('staff/invoices', {
    title: 'Invoices', clients: activeClients.all(), invoices: allInvoices.all(), form: {},
  });
});

router.post('/invoices', function(req, res, next) {
  const form = {
    user_id: req.body.user_id,
    amount: (req.body.amount || '').trim(),
    reason: (req.body.reason || '').trim(),
  };
  const client = findClient.get(form.user_id);
  const cents = parseDollars(form.amount);

  const errors = [];
  if (!client) errors.push('Choose a client.');
  if (cents === null) errors.push('Enter an amount in dollars, e.g. 250 or 250.00.');
  if (!form.reason) errors.push('Enter a reason for the invoice.');

  if (errors.length && req.body.return_to === '/admin') {
    req.flash('error', errors.join(' '));
    return res.redirect('/admin?tab=invoices');
  }
  if (errors.length) {
    return res.status(400).render('staff/invoices', {
      title: 'Invoices', clients: activeClients.all(), invoices: allInvoices.all(), form, errors,
    });
  }

  insertInvoice.run(client.id, cents, form.reason, req.user.id);
  req.flash('success', `Invoice for ${money(cents)} sent to ${client.full_name}. It now appears on their Billing page.`);
  res.redirect(req.body.return_to === '/admin' ? '/admin?tab=invoices' : '/staff/invoices');
});

module.exports = router;
