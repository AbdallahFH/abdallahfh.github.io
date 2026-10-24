// Reads links.txt, takes a screenshot of every link, and writes links.json.
// Run by .github/workflows/screenshots.yml, or by hand:
//   npm install --no-save playwright && npx playwright install chromium
//   node scripts/screenshots.mjs [links-file] [output-json]
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const LINKS_FILE = process.argv[2] || 'links.txt';
const OUT_JSON = process.argv[3] || 'links.json';
const SHOT_DIR = 'screenshots';

function parseLinks(text) {
    const links = [];
    const seen = new Set();
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;

        const [urlPart, title = '', ...rest] = line.split('|').map((s) => s.trim());
        // Links pasted without "https://" (example.com, localhost:8080/x) get https:// added.
        const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(urlPart) ? urlPart : 'https://' + urlPart;
        let url;
        try {
            url = new URL(withScheme);
        } catch {
            console.warn(`Skipping (not a valid URL): ${line}`);
            continue;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            console.warn(`Skipping (only http/https links): ${line}`);
            continue;
        }
        if (seen.has(url.href)) continue;
        seen.add(url.href);
        links.push({ url: url.href, title, description: rest.join(' | ') });
    }
    return links;
}

function slugFor(href) {
    const url = new URL(href);
    const base = (url.hostname.replace(/^www\./, '') + url.pathname)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
    const hash = createHash('sha1').update(href).digest('hex').slice(0, 6);
    return `${base || 'link'}-${hash}`;
}

async function readPrevious() {
    try {
        const prev = JSON.parse(await readFile(OUT_JSON, 'utf8'));
        return new Map(prev.map((p) => [p.url, p]));
    } catch {
        return new Map();
    }
}

async function capture(context, href, file) {
    const page = await context.newPage();
    try {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const pageTitle = (await page.title()).trim().slice(0, 80);
        await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
        return pageTitle;
    } finally {
        await page.close();
    }
}

const links = parseLinks(await readFile(LINKS_FILE, 'utf8'));
const previous = await readPrevious();
await mkdir(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US'
});

const manifest = [];
for (const link of links) {
    const slug = slugFor(link.url);
    const image = `${SHOT_DIR}/${slug}.jpg`;
    const old = previous.get(link.url);
    let pageTitle = '';
    let ok = false;

    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        try {
            pageTitle = await capture(context, link.url, image);
            ok = true;
        } catch (err) {
            console.warn(`Attempt ${attempt} failed for ${link.url}: ${err.message.split('\n')[0]}`);
        }
    }

    const entry = {
        url: link.url,
        title: link.title || pageTitle || (old && old.title) || '',
        description: link.description,
        image: null
    };
    if (ok) {
        entry.image = image;
        entry.updated = new Date().toISOString();
        console.log(`Captured ${link.url}`);
    } else if (old && old.image) {
        entry.image = old.image; // keep the last good screenshot
        entry.updated = old.updated;
        console.warn(`Keeping previous screenshot for ${link.url}`);
    } else {
        console.warn(`No screenshot for ${link.url}`);
    }
    manifest.push(entry);
}

await browser.close();

// Delete screenshots for links that were removed from links.txt.
const keep = new Set(manifest.filter((m) => m.image).map((m) => path.basename(m.image)));
for (const name of await readdir(SHOT_DIR)) {
    if (name.endsWith('.jpg') && !keep.has(name)) await rm(path.join(SHOT_DIR, name));
}

await writeFile(OUT_JSON, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Done: ${manifest.filter((m) => m.image).length}/${manifest.length} screenshots.`);
