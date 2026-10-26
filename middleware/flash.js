// =============================================================
// flash.js
// One-time messages ("Invoice created", "Wrong password") that show
// on the NEXT page load and then disappear.
//
// Routes call  req.flash('success', 'Saved.')  and then redirect.
// The message is parked in the session, picked up here on the next
// request, and handed to the template as `flash`.
// =============================================================

function flash(req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;

  req.flash = function(type, text) {
    req.session.flash = { type, text };
  };
  next();
}

module.exports = flash;
