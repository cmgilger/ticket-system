// =============================================================
// content.js
// Loads the editable front-page text from content/home.json.
//
// The file is re-read on every request so you can edit the text and
// just refresh the browser; no server restart needed. If the JSON has
// a typo (a missing comma is the usual one), we log the error and keep
// showing the last version that worked instead of crashing the site.
// =============================================================

const fs = require('fs');
const path = require('path');

const CONTENT_PATH = path.join(__dirname, '..', 'content', 'home.json');

let lastGood = null;

function load() {
  try {
    lastGood = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
  } catch (err) {
    console.error(`Could not read ${CONTENT_PATH}: ${err.message}`);
    if (!lastGood) throw err;
  }
  return lastGood;
}

module.exports = { load };
