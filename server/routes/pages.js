// The website's pages, robots.txt and sitemap.xml (spec P2-9).
// client/prerender.js builds each public page to its own file, with its own title and description, so
// search engines and the first paint see the real page: the home page is dist/index.html (sent by
// express.static), the others dist/pages/<name>.html. Pages that only make sense in the browser
// (the dashboard, success, canceled, manage my booking, the gift voucher thank-you page) get dist/app.html, the empty page marked noindex,
// and anything else gets it with a 404 status (React shows the "page not found" page).
const express = require("express");
const fs = require("fs");
const path = require("path");
const { settings } = require("../utils/settings");

// Must match PAGES in client/prerender.js
const PUBLIC_PAGES = ["/", "/bookings", "/charters", "/gift-vouchers", "/terms", "/privacy"];
// The other routes in client/src/App.jsx
const BROWSER_PAGES = ["/dashboard", "/success", "/canceled", "/gift-vouchers/thanks"];
const isBrowserPage = (page) => BROWSER_PAGES.includes(page) || /^\/manage\/[^/]+$/.test(page);

// As the website compares addresses (client/src/hooks/usePage.js): the router also opens /Bookings or
// /bookings/, so the case and a trailing slash are ignored
const pagePath = (pathname) => pathname.toLowerCase().replace(/\/+$/, "") || "/";

module.exports = (clientDist) => {
  const router = express.Router();
  const file = (name) => path.join(clientDist, name);
  const exists = (name) => fs.existsSync(file(name));

  router.get("/robots.txt", (req, res) => {
    const lines = ["User-agent: *", "Allow: /", "Disallow: /dashboard", "Disallow: /manage/"];
    if (settings.publicUrl) lines.push(`Sitemap: ${settings.publicUrl}/sitemap.xml`);
    res.type("text/plain").send(`${lines.join("\n")}\n`);
  });

  // Needs the site's public address (PUBLIC_URL): a sitemap lists full addresses
  router.get("/sitemap.xml", (req, res) => {
    if (!settings.publicUrl) return res.status(404).type("text/plain").send("No sitemap: PUBLIC_URL is not set.\n");
    const urls = PUBLIC_PAGES.map((page) => `  <url><loc>${settings.publicUrl}${page === "/" ? "/" : page}</loc></url>`);
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    );
  });

  // Every other address: its prebuilt page, or the empty page for the browser to build
  router.get("/*", (req, res) => {
    const page = pagePath(req.path);
    const prebuilt = page === "/" ? "index.html" : `pages${page}.html`;
    if (PUBLIC_PAGES.includes(page) && exists(prebuilt)) return res.sendFile(file(prebuilt));
    if (!PUBLIC_PAGES.includes(page) && !isBrowserPage(page)) res.status(404);
    // a build from before P2-9 has no app.html
    res.sendFile(file(exists("app.html") ? "app.html" : "index.html"));
  });

  return router;
};

module.exports.PUBLIC_PAGES = PUBLIC_PAGES;
