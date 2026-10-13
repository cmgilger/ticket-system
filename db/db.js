// =============================================================
// db.js
// Opens the SQLite database, makes sure the tables exist, and
// shares the connection with the rest of the app.
//
// Any file that needs the database just does:
//     const db = require('../db/db');
//
// Node only runs this file ONCE (the first time it's required) and
// then hands every later require() the same cached `db` object, so
// the whole app shares one connection.
// =============================================================

// --- Imports ---------------------------------------------------
// This project uses CommonJS (`require`), not ES modules (`import`),
// because that's how express-generator set it up. Mixing the two in
// one project causes "Cannot use import statement" errors.
//
// The variable name can't be `better-sqlite3`: a hyphen isn't allowed
// in JavaScript names (it would be read as "better minus sqlite3").
// By convention it's called `Database`, since that's what it creates.
const Database = require('better-sqlite3');
const fs = require('fs');     // built into Node: reads files from disk
const path = require('path'); // built into Node: builds file paths safely


// --- File locations --------------------------------------------
// __dirname is the folder THIS file lives in (the db/ folder).
// Building paths from it means they're correct no matter which folder
// you start the server from. A plain 'tickets.db' would be relative
// to wherever you ran `npm start`, which can put the database file
// somewhere you don't expect.
const DB_PATH = path.join(__dirname, 'tickets.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');


// --- Open the database -----------------------------------------
// If tickets.db doesn't exist yet, SQLite creates an empty one.
const db = new Database(DB_PATH);

// WAL ("write-ahead logging") mode lets reads and writes happen at
// the same time and is faster in general. The better-sqlite3 docs
// recommend it for web apps. It creates two helper files next to the
// database (tickets.db-wal and tickets.db-shm); that's normal.
db.pragma('journal_mode = WAL');


// --- Create tables ---------------------------------------------
// Read schema.sql as one big string of text...
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

// ...and run it. We use exec() rather than prepare() because exec()
// can run a string containing MULTIPLE SQL statements (our schema has
// a CREATE TABLE and a CREATE INDEX). prepare() only accepts one.
//
// IMPORTANT: only use exec() with SQL you wrote yourself. Never pass
// it anything built from user input. For queries involving user data
// (like saving a form submission), use prepare() with ? placeholders,
// which keeps user input from being treated as SQL (SQL injection).
db.exec(schema);


// --- Share the connection --------------------------------------
module.exports = db;
