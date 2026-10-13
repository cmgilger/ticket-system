-- =============================================================
-- schema.sql
-- Defines the structure of the ticket-system database.
--
-- This file is run by db.js EVERY time the server starts, so every
-- statement must be safe to run more than once. That's what
-- "IF NOT EXISTS" does: create the table/index the first time,
-- and silently skip it on every start after that (your data is kept).
-- =============================================================


-- One row per ticket submitted through the public form.
CREATE TABLE IF NOT EXISTS tickets (

    -- Unique number for each ticket. "INTEGER PRIMARY KEY" in SQLite
    -- auto-assigns the next number (1, 2, 3...) when you insert a row,
    -- so you never set this yourself.
    id          INTEGER PRIMARY KEY,

    -- The four fields from the intake form.
    -- TEXT = a string. NOT NULL = the database refuses to save a ticket
    -- with this field missing (a last line of defense behind your
    -- form validation).
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,   -- TEXT, not INTEGER: phone numbers can
                                 -- have leading zeros, "+", dashes, etc.
    email       TEXT NOT NULL,
    request     TEXT NOT NULL,

    -- Tracks where the ticket is in your workflow.
    -- DEFAULT 'open' means new tickets start as open automatically.
    -- CHECK rejects any value not in the list, so typos like 'Open'
    -- or 'closd' can't sneak in.
    status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'replied', 'closed')),

    -- When the ticket was submitted. SQLite has no real date type, so
    -- this is stored as TEXT like '2026-10-13 14:30:00' (in UTC).
    -- That format sorts correctly as text, which is all we need for
    -- "newest first". DEFAULT CURRENT_TIMESTAMP fills it in for you.
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- An index is like the index at the back of a book: it lets SQLite
-- find/sort rows by created_at without scanning the whole table.
-- The admin page sorts by date on every load, so this keeps it fast
-- as the number of tickets grows.
CREATE INDEX IF NOT EXISTS idx_tickets_created_at
    ON tickets (created_at);
