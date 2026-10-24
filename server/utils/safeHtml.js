const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Makes text safe to put inside HTML: <script> shows up as the words "<script>", not as a script.
// Missing values (null, undefined) become empty text.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

// For email templates. Write html: safeHtml`<p>Dear ${name}</p>` and every ${value} is escaped
// automatically, while the template's own tags are left alone. Customers type the names, messages
// and so on that go into our emails, so never build an email's HTML without this.
const safeHtml = (strings, ...values) =>
    strings.reduce((out, text, i) => out + text + (i < values.length ? escapeHtml(values[i]) : ''), '');

module.exports = { escapeHtml, safeHtml };
