// The gift voucher as a PDF to print or forward (owner's choice, 2 Nov 2026: their own photo, made
// personal with who it's for, the message, what it covers, the code and the expiry date). One A4 page,
// landscape: the photo on the left, the words on the right. Attached to the voucher email.
const path = require('path');
const PDFDocument = require('pdfkit');
const { settings } = require('../utils/settings');
const { coversText, validUntil } = require('../utils/vouchers');
const { PHONE } = require('./layout');

const NAVY = '#2b3a7a';
const INK = '#213547';
const MUTED = '#4a5d6e';
const GOLD = '#d9a404';
const LINE = '#dfe4e9';
const PHOTO = path.join(__dirname, 'voucher-photo.jpg');
const LOGO = path.join(__dirname, 'logo.png');

const website = () => (settings.publicUrl || 'https://www.sarkboattrips.com').replace(/^https?:\/\//, '');

// Resolves to the PDF as a Buffer
const voucherPdf = (voucher) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `Sark Boat Trips gift voucher ${voucher.code}`, Author: 'Sark Boat Trips' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width; // 842
    const height = doc.page.height; // 595
    const photoWidth = 380;

    doc.save().rect(0, 0, photoWidth, height).clip(); // the photo fills its column and no further
    doc.image(PHOTO, 0, 0, { cover: [photoWidth, height], align: 'center', valign: 'center' });
    doc.restore();
    doc.rect(0, height - 90, photoWidth, 90).fillOpacity(0.35).fill('#000000').fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text('See Sark from the sea', 28, height - 56, { width: photoWidth - 56 });

    const left = photoWidth + 44;
    const textWidth = width - left - 44;
    let y = 44;

    doc.image(LOGO, left, y, { width: 44, height: 44 });
    doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text('Sark Boat Trips', left + 56, y + 6);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('G I F T   V O U C H E R', left + 56, y + 28);
    y += 76;

    const heading = voucher.recipientName
        ? `A ${voucher.kind === 'charter' ? 'private charter' : 'boat trip'} around Sark for ${voucher.recipientName}`
        : `A ${voucher.kind === 'charter' ? 'private charter' : 'boat trip'} around Sark`;
    doc.font('Helvetica-Bold').fontSize(26).fillColor(NAVY).text(heading, left, y, { width: textWidth, lineGap: 2 });
    y = doc.y + 18;

    if (voucher.message) {
        const top = y;
        doc.font('Helvetica-Oblique').fontSize(13).fillColor(MUTED).text(voucher.message, left + 14, top, { width: textWidth - 14, lineGap: 2 });
        doc.rect(left, top, 3, doc.y - top).fill(GOLD);
        y = doc.y + 8;
        if (voucher.buyerName) {
            doc.font('Helvetica').fontSize(11).fillColor(MUTED).text(`From ${voucher.buyerName}`, left + 14, y, { width: textWidth - 14 });
            y = doc.y;
        }
        y += 18;
    }

    const row = (label, value, { mono = false } = {}) => {
        doc.font('Helvetica').fontSize(11).fillColor(MUTED).text(label, left, y + 2, { width: 92 });
        doc.font(mono ? 'Courier-Bold' : 'Helvetica-Bold').fontSize(mono ? 15 : 13).fillColor(INK).text(value, left + 96, y, { width: textWidth - 96 });
        y = doc.y + 8;
    };
    row('Covers', coversText(voucher));
    row('Valid until', validUntil(voucher));
    row('Code', voucher.code, { mono: true });

    y = Math.max(y + 10, height - 120);
    doc.moveTo(left, y).lineTo(left + textWidth, y).lineWidth(1).strokeColor(LINE).stroke();
    y += 14;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('How to book', left, y, { width: textWidth });
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(
        `Call or WhatsApp ${PHONE}, or email ${settings.mail.from || 'us'}, with your code. ${website()}`,
        left, doc.y + 3, { width: textWidth, lineGap: 1 },
    );
    doc.fontSize(8).text('This voucher can be passed on to someone else, but it cannot be exchanged for money or refunded.', left, doc.y + 6, { width: textWidth });

    doc.end();
});

module.exports = { voucherPdf };
