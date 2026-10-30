const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Makes text safe to put inside HTML: <script> shows up as the words "<script>", not as a script.
// Missing values (null, undefined) become empty text.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

// For email templates. Write html: safeHtml`<p>Dear ${name}</p>` and every ${value} is escaped
// automatically, while the template's own tags are left alone. Customers type the names, messages
// and so on that go into our emails, so never build an email's HTML without this.
// A piece of HTML that safeHtml already built: put inside another safeHtml it is kept as it is
// instead of being escaped a second time. Only the email layout (emails/layout.js) needs this.
class Trusted {
    constructor(html) { this.html = html; }
    toString() { return this.html; }
}
const trusted = (html) => new Trusted(html);

const escapeValue = (value) => {
    if (value instanceof Trusted) return value.html;
    if (Array.isArray(value)) return value.map(escapeValue).join('');
    return escapeHtml(value);
};

const safeHtml = (strings, ...values) =>
    strings.reduce((out, text, i) => out + text + (i < values.length ? escapeValue(values[i]) : ''), '');

module.exports = { escapeHtml, safeHtml, trusted };
