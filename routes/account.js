// pages for any logged-in account: account info, tickets, billing

const db = require('../db/db');
const { requireLogin } = require('../middleware/auth');

var express = require('express');
var router = express.Router();

const ticketsForUser = db.prepare(
  'SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC, id DESC'
);
const invoicesForUser = db.prepare(
  "SELECT * FROM invoices WHERE user_id = ? AND status != 'Void' ORDER BY status = 'Paid', created_at DESC"
);
const findInvoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?');
const markPaid = db.prepare(
  "UPDATE invoices SET status = 'Paid', paid_at = CURRENT_TIMESTAMP, payment_method = ? WHERE id = ? AND status = 'Unpaid'"
);

const PAYMENT_METHODS = { card: 'Credit card', paypal: 'PayPal', applepay: 'Apple Pay' };

router.use(['/account', '/tickets', '/billing'], requireLogin);

/* GET account info. */
router.get('/account', function(req, res, next) {
  res.render('account', { title: 'Account' });
});

/* GET my tickets. */
router.get('/tickets', function(req, res, next) {
  res.render('tickets', { title: 'Tickets', tickets: ticketsForUser.all(req.user.id) });
});

/* GET my invoices. */
router.get('/billing', function(req, res, next) {
  res.render('billing', { title: 'Billing', invoices: invoicesForUser.all(req.user.id) });
});

/* GET mock checkout for one invoice. */
router.get('/billing/:id/pay', function(req, res, next) {
  const invoice = findInvoice.get(req.params.id, req.user.id);
  if (!invoice) return next();
  if (invoice.status !== 'Unpaid') {
    req.flash('info', 'That invoice has already been settled.');
    return res.redirect('/billing');
  }
  res.render('pay', { title: 'Pay Invoice', invoice });
});

/* POST mock payment. PROTOTYPE: no card data is checked, stored, or sent anywhere. */
router.post('/billing/:id/pay', function(req, res, next) {
  const invoice = findInvoice.get(req.params.id, req.user.id);
  if (!invoice) return next();

  const method = PAYMENT_METHODS[req.body.method];
  if (!method) {
    req.flash('error', 'Please choose a payment method.');
    return res.redirect(`/billing/${invoice.id}/pay`);
  }

  const result = markPaid.run(method, invoice.id);
  if (result.changes === 0) {
    req.flash('info', 'That invoice has already been settled.');
  } else {
    req.flash('success', `Payment received. Thank you! (Prototype: no money was charged.)`);
  }
  res.redirect('/billing');
});

module.exports = router;
