var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

// Load the database at startup so tables are created before any request comes in.
require('./db/db');

var { loadUser } = require('./middleware/auth');
var flash = require('./middleware/flash');
var format = require('./services/format');
var content = require('./services/content');

var indexRouter = require('./routes/index');
var authRouter = require('./routes/auth');
var accountRouter = require('./routes/account');
var staffRouter = require('./routes/staff');
var adminRouter = require('./routes/admin');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Helpers every template can use: money(), date(), slug(), ticketNumber().
Object.assign(app.locals, format);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Sessions keep people logged in between page loads. Sessions live in
// memory, so restarting the server logs everyone out (fine for a prototype).
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set; using a development secret. Set it before deploying.');
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
}));
app.use(loadUser);
app.use(flash);

// Site-wide text (firm name, footer, disclaimer) for the layout. Read on
// every request so edits to content/home.json show up on refresh.
app.use(function(req, res, next) {
  res.locals.site = content.load();
  res.locals.currentPath = req.path;
  next();
});

app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', accountRouter);
app.use('/staff', staffRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
