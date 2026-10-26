-- =============================================================
-- schema.sql
-- Defines the structure of the ticket-system database.
--
-- This file is run by db.js EVERY time the server starts, so every
-- statement must be safe to run more than once. That's what
-- "IF NOT EXISTS" does: create the table/index the first time,
-- and silently skip it on every start after that (your data is kept).
-- =============================================================


-- One row per account on the site: clients, lawyers, and admins.
CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY,

    -- What the person types to log in. UNIQUE stops two accounts
    -- from sharing a username.
    username       TEXT NOT NULL UNIQUE,

    -- NEVER the real password. This is a bcrypt hash: a one-way
    -- scramble that can be checked against a typed password but
    -- can't be turned back into it.
    password_hash  TEXT NOT NULL,

    full_name      TEXT NOT NULL,
    phone          TEXT NOT NULL DEFAULT '',
    email          TEXT NOT NULL,

    -- 'user' = a client. Public sign-up always creates 'user';
    -- only an admin can create 'lawyer' or 'admin' accounts.
    type           TEXT NOT NULL DEFAULT 'user'
                   CHECK (type IN ('admin', 'lawyer', 'user')),

    -- Only 'Open' accounts can log in.
    status         TEXT NOT NULL DEFAULT 'Open'
                   CHECK (status IN ('Open', 'Inactive', 'Closed')),

    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- One row per ticket submitted through the public intake form.
CREATE TABLE IF NOT EXISTS tickets (

    -- Unique number for each ticket. "INTEGER PRIMARY KEY" in SQLite
    -- auto-assigns the next number (1, 2, 3...) when you insert a row,
    -- so you never set this yourself.
    id              INTEGER PRIMARY KEY,

    -- The four fields from the intake form.
    -- TEXT = a string. NOT NULL = the database refuses to save a ticket
    -- with this field missing (a last line of defense behind your
    -- form validation).
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,   -- TEXT, not INTEGER: phone numbers can
                                     -- have leading zeros, "+", dashes, etc.
    email           TEXT NOT NULL,
    request         TEXT NOT NULL,

    -- Tracks where the ticket is in your workflow.
    -- DEFAULT 'Open' means new tickets start as open automatically.
    -- CHECK rejects any value not in the list, so typos like 'open'
    -- or 'Closd' can't sneak in.
    status          TEXT NOT NULL DEFAULT 'Open'
                    CHECK (status IN ('Open', 'Under Review', 'Closed')),

    -- Optional: why the ticket was closed. Filled in by a lawyer or admin.
    closure_reason  TEXT,

    -- The account this ticket belongs to, if any. Set when the person
    -- submitting is logged in, or when the email matches an account.
    -- NULL means "no account" (someone who just used the form).
    -- ON DELETE SET NULL keeps the ticket if the account is deleted.
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- When the ticket was submitted. SQLite has no real date type, so
    -- this is stored as TEXT like '2026-10-13 14:30:00' (in UTC).
    -- That format sorts correctly as text, which is all we need for
    -- "newest first". DEFAULT CURRENT_TIMESTAMP fills it in for you.
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- An index is like the index at the back of a book: it lets SQLite
-- find/sort rows by created_at without scanning the whole table.
-- The admin page sorts by date on every load, so this keeps it fast
-- as the number of tickets grows.
CREATE INDEX IF NOT EXISTS idx_tickets_created_at
    ON tickets (created_at);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id
    ON tickets (user_id);


-- One row per invoice sent to a client.
CREATE TABLE IF NOT EXISTS invoices (
    id              INTEGER PRIMARY KEY,

    -- The client being billed.
    user_id         INTEGER NOT NULL REFERENCES users(id),

    -- Money is stored in CENTS as a whole number ($125.50 -> 12550).
    -- Decimal numbers in computers can't represent most cents exactly
    -- (0.1 + 0.2 = 0.30000000000000004), so whole cents avoid rounding bugs.
    amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),

    reason          TEXT NOT NULL,

    status          TEXT NOT NULL DEFAULT 'Unpaid'
                    CHECK (status IN ('Unpaid', 'Paid', 'Void')),

    -- The lawyer/admin who created the invoice.
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Filled in by the (mock) checkout.
    paid_at         TEXT,
    payment_method  TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id
    ON invoices (user_id);


-- One row per conflict check that a lawyer/admin runs. This is the
-- digital "Conflict Check folder" from the paper checklist.
CREATE TABLE IF NOT EXISTS conflict_checks (
    id              INTEGER PRIMARY KEY,
    client_name     TEXT NOT NULL,
    has_conflict    INTEGER NOT NULL DEFAULT 0,  -- SQLite has no true/false: 0 or 1
    completed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Every party named in a conflict check. Later checks search this
-- table too, so an opposing party from one case shows up as a
-- conflict if they later come in as a client (and vice versa).
CREATE TABLE IF NOT EXISTS conflict_parties (
    id              INTEGER PRIMARY KEY,
    check_id        INTEGER NOT NULL REFERENCES conflict_checks(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL
                    CHECK (role IN ('client', 'co-defendant', 'opposing', 'related')),

    -- What this name matched when the check was run (a short summary),
    -- or NULL if nothing matched.
    match_summary   TEXT
);

CREATE INDEX IF NOT EXISTS idx_conflict_parties_name
    ON conflict_parties (name COLLATE NOCASE);
