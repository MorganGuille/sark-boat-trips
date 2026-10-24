const helmet = require("helmet");
const cors = require("cors");
const { settings } = require("../utils/settings");

// Any page on this computer (any port), so `npm run dev` works however Vite numbers its port
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Security headers sent with every response.
// The Content Security Policy tells the browser what a page may load, so injected code can't pull
// in scripts or send data to other sites. This site needs very little from outside: Google Fonts
// and the Vimeo player. If a new outside service is added (an analytics script, a map, an image
// host), it must be added here too or the browser will block it.
// Set CSP_REPORT_ONLY=true to make the browser only log problems (in its console) instead of
// blocking, if a deploy ever breaks something and you need the site back before fixing the policy.
const securityHeaders = () =>
  helmet({
    strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true, preload: true },
    // The browser default. (helmet's stricter "no-referrer" can break embedded Vimeo videos.)
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      useDefaults: false,
      reportOnly: process.env.CSP_REPORT_ONLY === "true",
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        // 'unsafe-inline' is needed because React puts style="..." attributes on elements
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["https://player.vimeo.com"],
        // 'self' covers the API (same site). Vimeo's player looks up the video's details here.
        connectSrc: ["'self'", "https://vimeo.com"],
        // Left out when testing on http://localhost, where it would stop the page loading
        ...(settings.isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
  });

// Features this site never uses, switched off for the page and anything embedded in it
const permissionsPolicy = (req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  next();
};

// In production the website and the API are the same site, so no other website needs access and
// no CORS headers are sent at all. Other sites are only let in if listed in CORS_ORIGINS
// (comma separated), and when not in production, any page on this computer and PUBLIC_URL are
// allowed too so local development works. Returns null when nothing needs allowing.
const corsFor = () => {
  const extra = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const local = !settings.isProduction;
  if (!local && extra.length === 0) return null;

  const publicOrigin = settings.publicUrl ? new URL(settings.publicUrl).origin : null;
  return cors({
    origin: (origin, callback) => {
      // No Origin header means not a browser cross-site request (curl, the webhook, same-site)
      const allowed = !origin || extra.includes(origin) || (local && (LOCAL_ORIGIN.test(origin) || origin === publicOrigin));
      callback(null, allowed);
    },
  });
};

const corsSummary = () =>
  corsFor() === null
    ? "CORS: off (same site only)"
    : `CORS: ${settings.isProduction ? "" : "local development pages, "}${process.env.CORS_ORIGINS || ""}`.replace(/, $/, "");

module.exports = { securityHeaders, permissionsPolicy, corsFor, corsSummary };
