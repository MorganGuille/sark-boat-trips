// One look for every email: a white card under a blue header with the logo, readable on a phone and
// in every email app. Email apps ignore most web layout (Gmail and Outlook drop flexbox, heights and
// style sheets), so this uses only tables and inline styles. Each email also gets the same words as
// plain text, which spam filters like to see and some people prefer.
//
// An email is written as blocks (see the builders in emails/index.js):
//   'text' or ['text ', { bold: 'text' }, { link: 'https://...', text: 'words' }]   a paragraph
//   { details: [['Date', 'Monday 9 November 2026'], ...] }                          a box of facts
//   { list: ['first', 'second'] }                                                    a bulleted list
//   { button: { text: 'Open the dashboard', link: 'https://...' } }                  a button
// Everything a customer typed is escaped by safeHtml, however it is placed.
const path = require('path');
const { safeHtml, trusted } = require('../utils/safeHtml');
const { settings } = require('../utils/settings');

const BLUE = '#405e77'; // the blue of the old email card and the website
const INK = '#1f2d3a';
const MUTED = '#5b6b78';
const SOFT = '#f2f5f8';
const FONT = 'Arial, Helvetica, sans-serif';

// Contact details shown at the foot of customer emails (spec P2-11: the phone could become a setting)
const PHONE = '+44 7911 764 246';
const MAP_LINK = 'https://maps.app.goo.gl/E2XLJqrGku7eDePZ8';
const HARBOUR = 'Creux Harbour, Sark';

// The logo travels inside the email (an inline attachment), so it shows even when the email app
// blocks pictures from other websites
const LOGO_ID = 'logo@sarkboattrips';
const logo = { filename: 'sark-boat-trips.png', path: path.join(__dirname, 'logo.png'), cid: LOGO_ID };

const segments = (paragraph) => (Array.isArray(paragraph) ? paragraph : [paragraph]);

const inlineHtml = (paragraph) => trusted(segments(paragraph).map((part) => {
    if (part && typeof part === 'object' && 'bold' in part) return safeHtml`<strong>${part.bold}</strong>`;
    if (part && typeof part === 'object' && 'link' in part) return safeHtml`<a href="${part.link}" style="color: ${BLUE};">${part.text}</a>`;
    return safeHtml`${part}`;
}).join(''));

const inlineText = (paragraph) => segments(paragraph).map((part) => {
    if (part && typeof part === 'object' && 'bold' in part) return part.bold;
    if (part && typeof part === 'object' && 'link' in part) return `${part.text} (${part.link})`;
    return part ?? '';
}).join('');

const blockHtml = (block) => {
    if (block.details) {
        const rows = block.details.map(([label, value]) => safeHtml`<tr>
                <td style="padding: 8px 12px 8px 16px; font-size: 14px; color: ${MUTED}; vertical-align: top; width: 32%;">${label}</td>
                <td style="padding: 8px 16px 8px 0; font-size: 16px; color: ${INK}; font-weight: bold; vertical-align: top;">${inlineHtml(value)}</td>
            </tr>`);
        return safeHtml`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${SOFT}; border-radius: 8px; margin: 0 0 16px; padding: 8px 0; font-family: ${FONT};">${trusted(rows.join(''))}</table>`;
    }
    if (block.list) {
        return safeHtml`<ul style="margin: 0 0 16px; padding-left: 20px;">${trusted(block.list.map((item) => safeHtml`<li style="margin: 0 0 6px;">${inlineHtml(item)}</li>`).join(''))}</ul>`;
    }
    if (block.button) {
        return safeHtml`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 16px;"><tr>
            <td style="background: ${BLUE}; border-radius: 6px;"><a href="${block.button.link}" style="display: inline-block; padding: 12px 20px; font-family: ${FONT}; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">${block.button.text}</a></td>
        </tr></table>`;
    }
    return safeHtml`<p style="margin: 0 0 16px;">${inlineHtml(block)}</p>`;
};

const blockText = (block) => {
    if (block.details) return block.details.map(([label, value]) => `${label}: ${inlineText(value)}`).join('\n');
    if (block.list) return block.list.map((item) => `- ${inlineText(item)}`).join('\n');
    if (block.button) return `${block.button.text}: ${block.button.link}`;
    return inlineText(block);
};

// preheader: the line email apps show next to the subject in the inbox
// signoff: for customer emails, e.g. 'Thank you so much,'. Customer emails end with the contact
// details; the owner's own emails (forOwner) don't need them.
const renderEmail = ({ heading, preheader = '', blocks, signoff = '', forOwner = false }) => {
    const contact = settings.mail.from;
    const signoffHtml = signoff ? safeHtml`<p style="margin: 24px 0 0;">${signoff}<br><strong>Sark Boat Trips</strong></p>` : '';
    const footerHtml = forOwner ? '' : safeHtml`<tr><td style="padding: 0 24px 24px;">
            <p style="margin: 0; padding-top: 16px; border-top: 1px solid #dde3e8; font-family: ${FONT}; font-size: 14px; line-height: 1.6; color: ${MUTED}; text-align: center;">
                <a href="${MAP_LINK}" style="color: ${MUTED};">${HARBOUR}</a><br>
                <a href="tel:${PHONE.replace(/\s/g, '')}" style="color: ${MUTED};">${PHONE}</a> &middot; <a href="mailto:${contact}" style="color: ${MUTED};">${contact}</a>
            </p>
        </td></tr>`;

    const html = safeHtml`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background: ${SOFT};">
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${SOFT};"><tr><td align="center" style="padding: 24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background: #ffffff; border-radius: 12px;">
        <tr><td style="background: ${BLUE}; border-radius: 12px 12px 0 0; padding: 16px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-right: 12px; vertical-align: middle;"><img src="cid:${LOGO_ID}" width="56" height="56" alt="" style="display: block; border: 0;"></td>
                <td style="vertical-align: middle; font-family: ${FONT}; font-size: 20px; font-weight: bold; color: #ffffff;">Sark Boat Trips</td>
            </tr></table>
        </td></tr>
        <tr><td style="padding: 28px 24px 16px; font-family: ${FONT}; font-size: 16px; line-height: 1.5; color: ${INK};">
            <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.3; color: ${INK};">${heading}</h1>
            ${trusted(blocks.map(blockHtml).join(''))}
            ${trusted(signoffHtml)}
        </td></tr>
        ${trusted(footerHtml)}
    </table>
</td></tr></table>
</body>
</html>`;

    const text = [
        heading,
        ...blocks.map(blockText),
        signoff ? `${signoff}\nSark Boat Trips` : '',
        forOwner ? '' : `--\nSark Boat Trips, ${HARBOUR}\n${PHONE} | ${contact}`,
    ].filter(Boolean).join('\n\n');

    return { html, text, attachments: [logo] };
};

module.exports = { renderEmail, PHONE, MAP_LINK, HARBOUR };
