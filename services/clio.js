// =============================================================
// clio.js
// STUB for the Clio Manage API (v4). Nothing here talks to Clio yet:
// every function returns an empty/placeholder result until the
// environment variables below are set and the TODOs are filled in.
//
// The rest of the app already calls these functions, so connecting
// Clio later only means editing THIS file.
//
// --- How to connect it (summary; Clio's docs have the details) ---
// 1. In Clio Manage: Settings -> Developer Applications -> Add.
//    Set the redirect URI to  http://localhost:3000/clio/callback
//    (and add the production URL later).
// 2. Copy the app key + secret into environment variables:
//       CLIO_CLIENT_ID, CLIO_CLIENT_SECRET
// 3. Do the OAuth 2 flow once to get an access + refresh token:
//       GET https://app.clio.com/oauth/authorize?response_type=code
//           &client_id=...&redirect_uri=...
//       POST https://app.clio.com/oauth/token  (code -> tokens)
//    Store them as CLIO_ACCESS_TOKEN / CLIO_REFRESH_TOKEN (or in the
//    database). Access tokens expire; use the refresh token to renew.
// 4. Fill in the TODOs below. API base: https://app.clio.com/api/v4
//    (EU accounts use eu.app.clio.com, Canada ca.app.clio.com).
//
// Docs: https://docs.developers.clio.com/
// =============================================================

const API_BASE = process.env.CLIO_API_BASE || 'https://app.clio.com/api/v4';

function isConfigured() {
  return !!process.env.CLIO_ACCESS_TOKEN;
}

// Shared request helper. Node 18+ has fetch built in.
async function clioRequest(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLIO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Clio ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Used by the Conflict Check page. Should return [{ id, name }].
async function searchContacts(name) {
  if (!isConfigured()) return [];

  // TODO: confirm field names against the docs, then remove the early return.
  //   const { data } = await clioRequest('GET',
  //     `/contacts.json?query=${encodeURIComponent(name)}&fields=id,name`);
  //   return data.map(c => ({ id: c.id, name: c.name }));
  return [];
}

// Could be called after an intake form is submitted, to create the
// person as a Contact in Clio. Not wired up yet: add a call in
// routes/index.js (POST /intake) once this works.
async function createContactFromTicket(ticket) {
  if (!isConfigured()) return null;

  // TODO:
  //   const [first, ...rest] = ticket.name.split(' ');
  //   return clioRequest('POST', '/contacts.json', { data: {
  //     type: 'Person',
  //     first_name: first,
  //     last_name: rest.join(' '),
  //     email_addresses: [{ name: 'Work', address: ticket.email, default_email: true }],
  //     phone_numbers:   [{ name: 'Work', number: ticket.phone, default_number: true }],
  //   }});
  return null;
}

// Could create a Matter once a conflict check is cleared and the
// engagement letter is signed. Not wired up yet.
async function createMatter({ clioContactId, description }) {
  if (!isConfigured()) return null;

  // TODO:
  //   return clioRequest('POST', '/matters.json', { data: {
  //     client: { id: clioContactId },
  //     description,
  //   }});
  return null;
}

module.exports = { isConfigured, clioRequest, searchContacts, createContactFromTicket, createMatter };
