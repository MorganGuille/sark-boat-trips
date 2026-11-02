const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;

const MINUTE = 60 * 1000;

const limiter = ({ windowMs, limit, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, data: message },
    ...(keyGenerator && { keyGenerator }),
  });

const tryLater = "Too many booking attempts. Please wait a few minutes and try again, or contact us to book.";

module.exports = {
  // Booking and charter checkout: a real customer needs one or two attempts
  bookingByIp: limiter({ windowMs: 15 * MINUTE, limit: 10, message: tryLater }),
  checkoutByIp: limiter({ windowMs: 15 * MINUTE, limit: 10, message: tryLater }),

  // Bots can use many IP addresses to email one victim, so also limit per email address
  bookingByEmail: limiter({
    windowMs: 60 * MINUTE,
    limit: 3,
    message: "We've already had several booking requests for this email address. Please wait an hour, or contact us to book.",
    keyGenerator: (req) => {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
      return email ? `email:${email}` : ipKeyGenerator(req.ip);
    },
  }),

  // Gift vouchers: each attempt opens a Stripe payment page, and each voucher emails the buyer
  voucherByIp: limiter({ windowMs: 15 * MINUTE, limit: 10, message: "Too many attempts. Please wait a few minutes and try again, or contact us." }),
  voucherByEmail: limiter({
    windowMs: 60 * MINUTE,
    limit: 5,
    message: "We've had several voucher orders for this email address. Please wait an hour, or contact us.",
    keyGenerator: (req) => {
      const email = typeof req.body?.buyerEmail === "string" ? req.body.buyerEmail.trim().toLowerCase().slice(0, 254) : "";
      return email ? `voucher:${email}` : ipKeyGenerator(req.ip);
    },
  }),

  // The calendar asks for one month at a time, so this is generous
  availabilityByIp: limiter({ windowMs: MINUTE, limit: 60, message: "Too many requests. Please wait a moment and try again." }),

  // Manage my booking: opening the page, and the changes and messages (each one emails the owner)
  manageViewByIp: limiter({ windowMs: MINUTE, limit: 30, message: "Too many requests. Please wait a moment and try again." }),
  manageChangeByIp: limiter({ windowMs: 15 * MINUTE, limit: 10, message: "Too many changes. Please wait a few minutes and try again, or contact us." }),
  manageMessageByBooking: limiter({
    windowMs: 60 * MINUTE,
    limit: 5,
    message: "You've sent us several messages already. Please wait an hour, or email or phone us.",
    keyGenerator: (req) => `manage:${String(req.params.token).slice(0, 40)}`,
  }),

  // Each call asks Stripe about a payment, and the success page makes one
  verifyPaymentByIp: limiter({ windowMs: 15 * MINUTE, limit: 30, message: "Too many requests. Please wait a few minutes and try again." }),
};
