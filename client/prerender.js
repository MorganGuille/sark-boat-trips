import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p) => path.resolve(__dirname, p);

async function build() {
  console.log('🔍 Running the final "Clean Sweep" polish...');

  try {
    const templatePath = toAbsolute("dist/index.html");
    let template = fs.readFileSync(templatePath, "utf-8");

    const { render } = await import("./dist-server/entry-server.js");
    let appHtml = render();

    // 1. Grab the metadata React generated
    const titleMatch = appHtml.match(/<title>(.*?)<\/title>/i);
    const metaDescMatch = appHtml.match(
      /<meta name="description" content="(.*?)"\s?\/?>/i,
    );

    // 2. THE CLEAN SWEEP: Remove ALL <title>, <meta>, and <link> tags from the React string
    // This prevents them from showing up inside your <body> as "ghost text"
    appHtml = appHtml.replace(/<title[\s\S]*?<\/title>/gi, "");
    appHtml = appHtml.replace(/<meta[\s\S]*?>/gi, "");
    appHtml = appHtml.replace(/<link[\s\S]*?>/gi, "");

    // 3. Update the template's Head with the best metadata
    if (titleMatch) {
      template = template.replace(
        /<title>(.*?)<\/title>/,
        `<title>${titleMatch[1]}</title>`,
      );
    }
    // We only replace the description if React gave us a specific one
    if (metaDescMatch) {
      template = template.replace(
        /<meta name="description" content="(.*?)"\s?\/?>/,
        metaDescMatch[0],
      );
    }

    // 4. Inject the CLEAN content into the #root div
    const rootRegex = /(<div id="root">)([\s\S]*?)(<\/div>)/;
    const finalHtml = template.replace(rootRegex, `$1${appHtml}$3`);

    fs.writeFileSync(templatePath, finalHtml);
    console.log("🚀 SARK BOAT TRIPS IS READY FOR LAUNCH!");
  } catch (error) {
    console.error("❌ PRERENDER ERROR:", error);
  }
}

build();
