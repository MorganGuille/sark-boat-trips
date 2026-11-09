// The Express app: middleware and routes only. It does not read .env, connect to the database
// or listen on a port (index.js does that), so tests can load it with their own settings.
// Whoever loads this file must have set the environment first: settings are read when it loads.
const express = require("express");
const path = require("path");
const compression = require("compression");
const { securityHeaders, permissionsPolicy, corsFor } = require("./middleware/security");

const app = express();
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, "../client/dist");

// How many proxies sit in front of the app (Heroku, Render, Railway and Fly all have one). This
// keeps req.ip honest for rate limiting and lets req.secure see HTTPS. Set TRUST_PROXY if your
// host has a different number.
const proxyHops = Number.parseInt(process.env.TRUST_PROXY ?? "1", 10);
app.set("trust proxy", Number.isInteger(proxyHops) && proxyHops >= 0 ? proxyHops : 1);

// Security headers (HSTS, Content Security Policy and friends), see middleware/security.js
app.use(securityHeaders());
app.use(permissionsPolicy);

// Pages, scripts, styles and API answers are sent compressed (about a third of the size), which matters
// on a phone's data. Photos are already compressed, so they are left as they are.
app.use(compression());

// Force HTTPS (production only, so local http://localhost works)
app.use((req, res, next) => {
  if (req.secure || process.env.NODE_ENV !== "production") return next();
  res.redirect(301, `https://${req.headers.host}${req.url}`);
});

// Stripe webhooks need the raw request body to verify their signature, so this route
// is registered before express.json() and parses the body itself.
app.post(
  "/charters/webhook",
  express.raw({ type: "application/json" }),
  require("./middleware/asyncHandler")(require("./controllers/checkout").webhook),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// No-op in production unless CORS_ORIGINS is set: the site and its API are the same site
const corsMiddleware = corsFor();
if (corsMiddleware) app.use(corsMiddleware);

// robots.txt and sitemap.xml are made from the settings (PUBLIC_URL), so before the client build's files
const pages = require("./routes/pages")(clientDist);
app.get(["/robots.txt", "/sitemap.xml"], pages);

// Serve client build (index: false, so "/" goes to the pages router like every other page).
// Everything the build puts in /assets (scripts, styles, photos) has a fingerprint in its name that
// changes whenever the file does, so a browser can keep it for a year without asking again. Pages and
// anything else are still checked on every visit, so a new release shows up straight away.
app.use(express.static(clientDist, {
  index: false,
  setHeaders: (res, file) => {
    if (path.relative(clientDist, file).split(path.sep)[0] === "assets") {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
}));

// API routes
app.use("/bookings", require("./routes/bookings"));
app.use("/admin", require("./routes/admin"));
app.use("/charters", require("./routes/charters"));
app.use("/notes", require("./routes/notes"));
app.use("/vouchers", require("./routes/vouchers"));
app.use("/customers", require("./routes/customers"));

// Optional public folder
app.use(express.static("public"));

// Every other address: its prebuilt page, or the empty page the browser builds (routes/pages.js)
app.use(pages);

// Must come after every route
app.use(require("./middleware/errorHandler"));

module.exports = app;
