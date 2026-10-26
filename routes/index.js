// public front-end

const db = require('../db/db');
const content = require('../services/content');

var express = require('express');
var router = express.Router();

const insertTicket = db.prepare(
  'INSERT INTO tickets (name, phone, email, request, user_id) VALUES (?, ?, ?, ?, ?)'
);
const findClientByEmail = db.prepare(
  "SELECT id FROM users WHERE email = ? COLLATE NOCASE AND type = 'user'"
);

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    title: content.load().firmName,
    home: content.load(),
    submitted: req.query.submitted === '1',
    form: {},
    errors: [],
  });
});

/* POST intake form. */
router.post('/intake', function(req, res, next) {
  const form = {
    name: (req.body.name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
    request: (req.body.request || '').trim(),
  };

  const errors = [];
  if (!form.name) errors.push('Please enter your name.');
  if (!/^[\d\s()+.-]{7,20}$/.test(form.phone)) errors.push('Please enter a valid phone number.');
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.push('Please enter a valid email address.');
  if (!form.request) errors.push('Please tell us how we can help.');
  if (form.request.length > 5000) errors.push('Please keep your message under 5,000 characters.');

  if (errors.length) {
    const home = content.load();
    return res.status(400).render('index', { title: home.firmName, home, submitted: false, form, errors });
  }

  // Link the ticket to an account: the logged-in client, or else a
  // client account with the same email address.
  let userId = null;
  if (req.user && req.user.type === 'user') {
    userId = req.user.id;
  } else {
    const match = findClientByEmail.get(form.email);
    if (match) userId = match.id;
  }

  insertTicket.run(form.name, form.phone, form.email, form.request, userId);

  // Redirect after POST so refreshing the page doesn't submit twice.
  res.redirect('/?submitted=1#intake');
});

module.exports = router;
