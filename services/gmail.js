// =============================================================
// gmail.js
// Builds links that open a new Gmail draft with the To, Subject,
// and Body already filled in. Nothing is sent from the server: the
// lawyer reviews the draft in their own Gmail and clicks Send.
// =============================================================

// to can be one address or an array of addresses.
function composeUrl({ to, subject = '', body = '' }) {
  const recipients = Array.isArray(to) ? to.join(',') : to;
  const params = new URLSearchParams({ view: 'cm', fs: '1', to: recipients, su: subject, body });
  return 'https://mail.google.com/mail/?' + params.toString();
}

// "#0042" style ticket numbers, used in subjects and on screen.
function ticketNumber(id) {
  return '#' + String(id).padStart(4, '0');
}

function replyToTicketUrl(ticket) {
  return composeUrl({
    to: ticket.email,
    subject: `Reply to Ticket ${ticketNumber(ticket.id)}`,
    body: `Dear ${ticket.name},\n\nThank you for contacting us regarding:\n\n"${ticket.request}"\n\n`,
  });
}

function messageFromCounselUrl(user) {
  return composeUrl({
    to: user.email,
    subject: 'Message from Counsel',
    body: `Dear ${user.full_name},\n\n`,
  });
}

module.exports = { composeUrl, ticketNumber, replyToTicketUrl, messageFromCounselUrl };
