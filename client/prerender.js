import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p) => path.resolve(__dirname, p);

// The public pages search engines should find (spec P2-9). Each is built to its own file with its own
// title and description: the home page to dist/index.html, the others to dist/pages/<name>.html, which
// the server sends for that address (server/routes/pages.js, whose PUBLIC_PAGES must match this list).
// Every other page (dashboard, success, canceled, manage, 404) is built in the browser from
// dist/app.html, the empty page, marked noindex.
const PAGES = ["/", "/bookings", "/charters", "/terms", "/privacy"];

// The page's HTML put into the template, with React's title and description moved into the <head>
const fill = (template, appHtml) => {
  // 1. Grab the metadata React generated
  const titleMatch = appHtml.match(/<title>(.*?)<\/title>/i);
  const metaDescMatch = appHtml.match(/<meta name="description" content="(.*?)"\s?\/?>/i);

  // 2. THE CLEAN SWEEP: Remove ALL <title>, <meta>, and <link> tags from the React string
  // This prevents them from showing up inside your <body> as "ghost text"
  appHtml = appHtml.replace(/<title[\s\S]*?<\/title>/gi, "");
  appHtml = appHtml.replace(/<meta[\s\S]*?>/gi, "");
  appHtml = appHtml.replace(/<link[\s\S]*?>/gi, "");

  // 3. Update the template's Head with the page's metadata
  let page = template;
  if (titleMatch) page = page.replace(/<title>(.*?)<\/title>/, () => `<title>${titleMatch[1]}</title>`);
  // the template's tag is spread over several lines
  if (metaDescMatch) page = page.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, () => metaDescMatch[0]);

  // 4. Inject the CLEAN content into the #root div
  return page.replace(/(<div id="root">)([\s\S]*?)(<\/div>)/, (all, open, inner, close) => `${open}${appHtml}${close}`);
};

async function build() {
  const templatePath = toAbsolute("dist/index.html");
  const template = fs.readFileSync(templatePath, "utf-8");
  const { render } = await import("./dist-server/entry-server.js");

  // The empty page for everything built in the browser. Kept out of search results.
  const shell = template.replace("</head>", '    <meta name="robots" content="noindex" />\n  </head>');
  fs.writeFileSync(toAbsolute("dist/app.html"), shell);

  fs.mkdirSync(toAbsolute("dist/pages"), { recursive: true });
  for (const url of PAGES) {
    const html = fill(template, render(url));
    if (!/<div id="root">\s*<\S/.test(html)) throw new Error(`${url} rendered nothing`);
    const file = url === "/" ? "dist/index.html" : `dist/pages${url}.html`;
    fs.writeFileSync(toAbsolute(file), html);
    console.log(`Prerendered ${url} -> ${file}`);
  }
}

build().catch((error) => {
  console.error("PRERENDER ERROR:", error);
  process.exitCode = 1; // fail the build rather than deploy a site without its pages
});
