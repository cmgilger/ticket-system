// =============================================================
// auth.js
// Login/session helpers shared by every route file.
//
// When someone logs in, we store only their user id in the session
// (req.session.userId). On every request, loadUser looks that id up
// so routes and templates always see the account's CURRENT details:
// if an admin closes an account, that person is logged out on their
// very next click instead of whenever their session expires.
// =============================================================

const bcrypt = require('bcryptjs');
const db = require('../db/db');

// Higher = slower to hash = harder to brute-force. 10 is the common default.
const SALT_ROUNDS = 10;

const findUserById = db.prepare(
  'SELECT id, username, full_name, phone, email, type, status, created_at FROM users WHERE id = ?'
);

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Runs on every request (see app.js). Sets req.user and res.locals.user
// (res.locals is what Pug templates can see).
function loadUser(req, res, next) {
  req.user = null;
  if (req.session.userId) {
    const user = findUserById.get(req.session.userId);
    if (user && user.status === 'Open') {
      req.user = user;
    } else {
      // Account was deleted or closed since they logged in.
      delete req.session.userId;
    }
  }
  res.locals.user = req.user;
  res.locals.isStaff = !!req.user && (req.user.type === 'admin' || req.user.type === 'lawyer');
  next();
}

// Put in front of any route that needs a logged-in user.
function requireLogin(req, res, next) {
  if (!req.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

// requireRole('admin') or requireRole('admin', 'lawyer').
function requireRole(...types) {
  return function(req, res, next) {
    if (!req.user) {
      return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }
    if (!types.includes(req.user.type)) {
      const err = new Error('You do not have access to this page.');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

module.exports = { hashPassword, checkPassword, loadUser, requireLogin, requireRole };
