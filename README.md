# ticket-system

Prototype website for a law firm: a public front page with a client intake form,
client accounts, a lawyer/admin back office, conflict checks, and invoicing with
a mock checkout.

Built with Express, Pug, and SQLite (better-sqlite3).

## Running the site

### Prerequisites

- [Node.js](https://nodejs.org/) **20 or newer** (`node -v` to check)

### First-time setup

```bash
npm install        # install dependencies
npm run seed       # create demo accounts, tickets, and invoices
npm start          # start the server
```

Open <http://localhost:3000>.

For development, `npm run dev` restarts the server automatically when you
save a file.

### Demo logins

`npm run seed` creates these accounts, all with the password `ChangeMe123!`:

| Username | Type   | Can see                                              |
|----------|--------|------------------------------------------------------|
| `admin`  | admin  | Everything, including the Admin Panel                |
| `lawyer` | lawyer | Ticket Queue, Conflict Check, Invoices               |
| `client` | user   | Their own Account, Tickets, and Billing              |

**Change these passwords before real people use the site** (Admin Panel → Users → Edit).

To wipe the database and start over with fresh demo data:

```bash
npm run seed -- --reset
```

The database is a single file, `db/tickets.db`. It holds personal information,
so it's excluded from git.

### Settings (environment variables)

| Variable            | Purpose                                                      |
|---------------------|--------------------------------------------------------------|
| `PORT`              | Port to run on (default `3000`)                              |
| `SESSION_SECRET`    | Long random string used to sign login cookies. **Required for any real deployment.** |
| `CLIO_ACCESS_TOKEN` | Turns on the Clio Manage integration (see below)             |

Example (PowerShell): `$env:SESSION_SECRET = "some-long-random-string"; npm start`

## Pages

| Page                         | Who            | What it does |
|------------------------------|----------------|--------------|
| `/`                          | Everyone       | Firm info and the intake form. Logged-in users see shortcuts to their pages; admins also get an Admin button. |
| `/register`, `/login`        | Everyone       | Public sign-up always creates a client account. Lawyer/admin accounts are created by an admin. |
| `/account`                   | Logged in      | Name, phone, email, and account creation date. |
| `/tickets`                   | Logged in      | The user's tickets, their status, and any closure reason. |
| `/billing`                   | Logged in      | Unpaid/paid invoices, with a mock checkout (card / PayPal / Apple Pay). |
| `/staff/tickets`             | Lawyer, admin  | All tickets: change status, add a reason for closure, reply in Gmail. |
| `/staff/conflict-check`      | Lawyer, admin  | Run a conflict check, notify lawyers and the client via Gmail, and browse past checks. |
| `/staff/invoices`            | Lawyer, admin  | Send an invoice to a client. |
| `/admin`                     | Admin          | Tickets, Users, and Invoices tables: edit, create, void, delete, and message clients via Gmail. |

Tickets submitted through the intake form are linked to an account when the
person is logged in, or when their email matches a client account.

### How the conflict check decides

Each name is compared (ignoring case and spacing) against client accounts,
lawyer/admin accounts, intake tickets, and every party from earlier conflict
checks. A match is a **conflict** when the sides clash:

- the prospective client was named as an opposing or related party before, or
- an opposing, co-defendant, or related party is a client, an inquirer, or a firm lawyer.

Other matches (for example, the client matching their own intake ticket) are
shown as notes. "Possible" matches share every word of a name
("Casey Client" vs. "Casey A. Client") and need a human decision. Every check
is saved to the Conflict Check folder at the bottom of the page.

### Payments are mocked

The checkout doesn't charge anything or send card details anywhere. The card
fields aren't even submitted to the server. Clicking Pay marks the invoice as
paid. To take real payments, the checkout in `views/pay.pug` and
`routes/account.js` would be replaced with a processor such as Stripe,
PayPal, or Clio Payments.

## Customizing the look and text

| To change...                                  | Edit |
|-----------------------------------------------|------|
| Front-page text, firm name, contact info, disclaimer, footer | `content/home.json` (just refresh the browser; no restart needed) |
| Colors and fonts                              | the variables at the top of `public/stylesheets/theme.css` |
| Layout and component styling                  | `public/stylesheets/style.css` |
| Front-page structure                          | `views/index.pug` |

**Fonts:** headings use Cooper Black and body text uses Owners. Both are
licensed fonts, so they aren't in the repo. Put your web font files in
`public/fonts/` (see `public/fonts/README.md`). Until then, the site uses the
font if it's installed on the visitor's computer, and otherwise falls back to
Georgia / Segoe UI.

## Clio Manage integration (stub)

`services/clio.js` is a ready-made stub for the Clio Manage API v4. The
conflict check already calls `searchContacts()`, so once it's connected, Clio
contacts are included in every conflict check. Instructions for registering a
Clio developer app and getting an OAuth token are at the top of that file.
`createContactFromTicket()` and `createMatter()` are also stubbed for pushing
intake submissions and new matters into Clio.

## Project layout

```text
app.js                 Express setup: sessions, routes, error handling
bin/www                Starts the HTTP server
content/home.json      Editable front-page text
db/                    schema.sql (tables), db.js (connection), seed.js (demo data)
middleware/            auth.js (login + roles), flash.js (one-time messages)
routes/                index (front page + intake), auth, account, staff, admin
services/              conflicts, gmail links, clio stub, formatting helpers
views/                 Pug templates (staff/ and admin/ subfolders)
public/                CSS, small browser scripts, fonts
```

## Prototype limitations

- Sessions are stored in memory, so restarting the server logs everyone out.
- Forms rely on same-site cookies for cross-site request protection; add CSRF tokens before deploying.
- Emails open as Gmail drafts in the lawyer's browser; the server doesn't send email.

## Credits

Connor Gilger - Designer & Developer
