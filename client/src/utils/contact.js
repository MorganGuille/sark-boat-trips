// The email address customers are told to write to. The server's emails use MAIL_FROM from its
// settings (server/.env): keep the two the same.
export const CONTACT_EMAIL = 'info@sarkboattrips.com'

// The owner's mobile, for calls and WhatsApp (shown in the header menu, footer, success and manage pages)
export const CONTACT_PHONE = '+44 7911 764 246'
export const PHONE_LINK = `tel:${CONTACT_PHONE.replace(/\s/g, '')}`
export const WHATSAPP_LINK = `https://wa.me/${CONTACT_PHONE.replace(/\D/g, '')}`
