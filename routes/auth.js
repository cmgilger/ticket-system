// login, logout, and public sign-up

const db = require('../db/db');
const { hashPassword, checkPassword } = require('../middleware/auth');

var express = require('express');
var router = express.Router();

const findByUsername = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
const insertClient = db.prepare(
  "INSERT INTO users (username, password_hash, full_name, phone, email, type) VALUES (?, ?, ?, ?, ?, 'user')"
);

// Only follow ?next= links that stay on this site ("/billing"), never
// "https://evil.example" or "//evil.example".
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/* GET login page. */
router.get('/login', function(req, res, next) {
  if (req.user) return res.redirect('/');
  res.render('login', { title: 'Log In', next: safeNext(req.query.next), username: '' });
});

/* POST login. */
router.post('/login', function(req, res, next) {
  const username = (req.body.username || '').trim();
  const user = findByUsername.get(username);

  // Same message whether the username or the password was wrong, so
  // the form can't be used to discover which usernames exist.
  if (!user || !checkPassword(req.body.password || '', user.password_hash)) {
    return res.status(401).render('login', {
      title: 'Log In', next: safeNext(req.body.next), username,
      error: 'Incorrect username or password.',
    });
  }
  if (user.status !== 'Open') {
    return res.status(403).render('login', {
      title: 'Log In', next: safeNext(req.body.next), username,
      error: `This account is ${user.status.toLowerCase()}. Please contact the firm.`,
    });
  }

  // New session id on login (prevents "session fixation" attacks).
  req.session.regenerate(function(err) {
    if (err) return next(err);
    req.session.userId = user.id;
    res.redirect(safeNext(req.body.next));
  });
});

/* POST logout. */
router.post('/logout', function(req, res, next) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});

/* GET sign-up page. */
router.get('/register', function(req, res, next) {
  if (req.user) return res.redirect('/');
  res.render('register', { title: 'Create an Account', form: {}, errors: [] });
});

/* POST sign-up. Always creates a client ('user') account. */
router.post('/register', function(req, res, next) {
  const form = {
    username: (req.body.username || '').trim(),
    full_name: (req.body.full_name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
  };
  const password = req.body.password || '';

  const errors = [];
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(form.username)) {
    errors.push('Username must be 3 to 30 letters, numbers, dots, dashes, or underscores.');
  } else if (findByUsername.get(form.username)) {
    errors.push('That username is taken.');
  }
  if (!form.full_name) errors.push('Please enter your full name.');
  if (!/^[\d\s()+.-]{7,20}$/.test(form.phone)) errors.push('Please enter a valid phone number.');
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.push('Please enter a valid email address.');
  if (password.length < 8) errors.push('Password must be at least 8 characters.');
  if (password !== req.body.password_confirm) errors.push('Passwords do not match.');
  if (req.body.acknowledge !== 'yes') errors.push('Please confirm you have read the disclaimer.');

  if (errors.length) {
    return res.status(400).render('register', { title: 'Create an Account', form, errors });
  }

  const info = insertClient.run(form.username, hashPassword(password), form.full_name, form.phone, form.email);

  req.session.regenerate(function(err) {
    if (err) return next(err);
    req.session.userId = info.lastInsertRowid;
    req.flash('success', 'Welcome! Your account has been created.');
    res.redirect('/account');
  });
});

module.exports = router;
