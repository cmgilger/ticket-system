// admin page

const db = require('../db/db');
const { requireRole, hashPassword } = require('../middleware/auth');
const { parseDollars } = require('../services/format');
const gmail = require('../services/gmail');

var express = require('express');
var router = express.Router();

router.use(requireRole('admin'));

const TABS = ['tickets', 'users', 'invoices'];
const USER_TYPES = ['user', 'lawyer', 'admin'];
const USER_STATUSES = ['Open', 'Inactive', 'Closed'];
const TICKET_STATUSES = ['Open', 'Under Review', 'Closed'];
const INVOICE_STATUSES = ['Unpaid', 'Paid', 'Void'];

const allTickets = db.prepare(`
  SELECT t.*, u.username
  FROM tickets t LEFT JOIN users u ON u.id = t.user_id
  ORDER BY t.created_at DESC, t.id DESC
`);
const deleteTicket = db.prepare('DELETE FROM tickets WHERE id = ?');

const allUsers = db.prepare('SELECT * FROM users ORDER BY type, full_name');
const findUser = db.prepare('SELECT * FROM users WHERE id = ?');
const findByUsername = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE');
const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, full_name, phone, email, type, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const updateUser = db.prepare(
  'UPDATE users SET username = ?, full_name = ?, phone = ?, email = ?, type = ?, status = ? WHERE id = ?'
);
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const activeClients = db.prepare(
  "SELECT id, username, full_name FROM users WHERE type = 'user' AND status = 'Open' ORDER BY full_name"
);

const allInvoices = db.prepare(`
  SELECT i.*, u.username, u.full_name, c.full_name AS created_by_name
  FROM invoices i
  JOIN users u ON u.id = i.user_id
  LEFT JOIN users c ON c.id = i.created_by
  ORDER BY i.created_at DESC, i.id DESC
`);
const findInvoice = db.prepare(`
  SELECT i.*, u.username, u.full_name FROM invoices i JOIN users u ON u.id = i.user_id WHERE i.id = ?
`);
const updateInvoice = db.prepare(`
  UPDATE invoices SET amount_cents = ?, reason = ?, status = ?,
    paid_at = CASE WHEN ? = 'Paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE NULL END,
    payment_method = CASE WHEN ? = 'Paid' THEN COALESCE(payment_method, 'Recorded by admin') ELSE NULL END
  WHERE id = ?
`);

// Checks the fields shared by "create user" and "edit user".
function validateUser(form, existingId) {
  const errors = [];
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(form.username)) {
    errors.push('Username must be 3 to 30 letters, numbers, dots, dashes, or underscores.');
  } else {
    const taken = findByUsername.get(form.username);
    if (taken && taken.id !== existingId) errors.push('That username is taken.');
  }
  if (!form.full_name) errors.push('Full name is required.');
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.push('A valid email is required.');
  if (!USER_TYPES.includes(form.type)) errors.push('Choose an account type.');
  if (!USER_STATUSES.includes(form.status)) errors.push('Choose an account status.');
  return errors;
}

function readUserForm(body) {
  return {
    username: (body.username || '').trim(),
    full_name: (body.full_name || '').trim(),
    phone: (body.phone || '').trim(),
    email: (body.email || '').trim(),
    type: body.type,
    status: body.status,
  };
}

function renderPanel(res, tab, extra = {}) {
  res.render('admin/index', {
    title: 'Admin Panel',
    tab,
    tickets: allTickets.all().map(t => ({ ...t, replyUrl: gmail.replyToTicketUrl(t) })),
    users: allUsers.all().map(u => ({ ...u, messageUrl: gmail.messageFromCounselUrl(u) })),
    invoices: allInvoices.all(),
    clients: activeClients.all(),
    ticketStatuses: TICKET_STATUSES,
    userTypes: USER_TYPES,
    userStatuses: USER_STATUSES,
    userForm: { type: 'user', status: 'Open' },
    invoiceForm: {},
    ...extra,
  });
}


/* GET admin panel. ?tab=tickets|users|invoices */
router.get('/', function(req, res, next) {
  renderPanel(res, TABS.includes(req.query.tab) ? req.query.tab : 'tickets', {
    selectedClient: req.query.client, // pre-selects a client in the invoice form
  });
});


/* ---------- Tickets ---------- */
// Status/closure-reason updates go through POST /staff/tickets/:id,
// which lawyers use too.

router.post('/tickets/:id/delete', function(req, res, next) {
  deleteTicket.run(req.params.id);
  req.flash('success', `Ticket ${gmail.ticketNumber(req.params.id)} deleted.`);
  res.redirect('/admin?tab=tickets');
});


/* ---------- Users ---------- */

router.post('/users', function(req, res, next) {
  const form = readUserForm(req.body);
  const errors = validateUser(form, null);
  if ((req.body.password || '').length < 8) errors.push('Password must be at least 8 characters.');

  if (errors.length) {
    res.status(400);
    return renderPanel(res, 'users', { userForm: form, userErrors: errors });
  }

  insertUser.run(form.username, hashPassword(req.body.password), form.full_name, form.phone,
    form.email, form.type, form.status);
  req.flash('success', `Account "${form.username}" created.`);
  res.redirect('/admin?tab=users');
});

router.get('/users/:id', function(req, res, next) {
  const account = findUser.get(req.params.id);
  if (!account) return next();
  res.render('admin/user-edit', {
    title: `Edit ${account.username}`, account, form: account, errors: [],
    userTypes: USER_TYPES, userStatuses: USER_STATUSES,
  });
});

router.post('/users/:id', function(req, res, next) {
  const account = findUser.get(req.params.id);
  if (!account) return next();

  const form = readUserForm(req.body);
  const errors = validateUser(form, account.id);
  // Stop admins from locking themselves out.
  if (account.id === req.user.id && (form.type !== 'admin' || form.status !== 'Open')) {
    errors.push("You can't remove your own admin access or close your own account.");
  }
  const newPassword = req.body.password || '';
  if (newPassword && newPassword.length < 8) errors.push('New password must be at least 8 characters.');

  if (errors.length) {
    return res.status(400).render('admin/user-edit', {
      title: `Edit ${account.username}`, account, form, errors,
      userTypes: USER_TYPES, userStatuses: USER_STATUSES,
    });
  }

  updateUser.run(form.username, form.full_name, form.phone, form.email, form.type, form.status, account.id);
  if (newPassword) updatePassword.run(hashPassword(newPassword), account.id);

  req.flash('success', `Account "${form.username}" saved.`);
  res.redirect('/admin?tab=users');
});


/* ---------- Invoices ---------- */
// New invoices are created through POST /staff/invoices, which
// lawyers use too.

router.get('/invoices/:id', function(req, res, next) {
  const invoice = findInvoice.get(req.params.id);
  if (!invoice) return next();
  res.render('admin/invoice-edit', {
    title: `Edit Invoice #${invoice.id}`, invoice, form: { ...invoice, amount: (invoice.amount_cents / 100).toFixed(2) },
    errors: [], statuses: INVOICE_STATUSES,
  });
});

router.post('/invoices/:id', function(req, res, next) {
  const invoice = findInvoice.get(req.params.id);
  if (!invoice) return next();

  const form = {
    amount: (req.body.amount || '').trim(),
    reason: (req.body.reason || '').trim(),
    status: req.body.status,
  };
  const cents = parseDollars(form.amount);
  const errors = [];
  if (cents === null) errors.push('Enter an amount in dollars, e.g. 250 or 250.00.');
  if (!form.reason) errors.push('Reason is required.');
  if (!INVOICE_STATUSES.includes(form.status)) errors.push('Choose a status.');

  if (errors.length) {
    return res.status(400).render('admin/invoice-edit', {
      title: `Edit Invoice #${invoice.id}`, invoice, form, errors, statuses: INVOICE_STATUSES,
    });
  }

  updateInvoice.run(cents, form.reason, form.status, form.status, form.status, invoice.id);
  req.flash('success', `Invoice #${invoice.id} saved.`);
  res.redirect('/admin?tab=invoices');
});

module.exports = router;
