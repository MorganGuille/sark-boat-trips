// The Express app: middleware and routes only. It does not read .env, connect to the database
// or listen on a port (index.js does that), so tests can load it with their own settings.
// Whoever loads this file must have set the environment first: settings are read when it loads.
const express = require("express");
const path = require("path");
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

// Serve client build (index: false, so "/" goes to the pages router like every other page)
app.use(express.static(clientDist, { index: false }));

// API routes
app.use("/bookings", require("./routes/bookings"));
app.use("/admin", require("./routes/admin"));
app.use("/charters", require("./routes/charters"));
app.use("/notes", require("./routes/notes"));

// Optional public folder
app.use(express.static("public"));

// Every other address: its prebuilt page, or the empty page the browser builds (routes/pages.js)
app.use(pages);

// Must come after every route
app.use(require("./middleware/errorHandler"));

module.exports = app;
