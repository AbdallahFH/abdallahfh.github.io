// Reads every links/<page>.txt, takes a header screenshot of each normal link,
// recognises YouTube videos (embedded, no screenshot needed), and writes links/<page>.json.
// Run by .github/workflows/screenshots.yml, or by hand:
//   npm install --no-save playwright && npx playwright install chromium
//   node scripts/screenshots.mjs [links-folder] [--parse-only]
// --parse-only skips the browser and the network (handy for checking your txt files).
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const args = process.argv.slice(2);
const PARSE_ONLY = args.includes('--parse-only');
const DIR = args.find((a) => !a.startsWith('--')) || 'links';
const SHOT_DIR = 'screenshots';

const SHOW_WORDS = /^(title|showtitle)$/i;
const HIDE_WORDS = /^(notitle|hidetitle)$/i;
const OFF_VALUES = /^(off|no|false|hide|0)$/i;

/** YouTube video / playlist links become embeds. Anything else (channels, other sites) is a normal link. */
function youtube(url) {
    const host = url.hostname.replace(/^(www|m)\./, '');
    let id = null;
    let list = null;
    if (host === 'youtu.be') {
        id = url.pathname.slice(1).split('/')[0];
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (url.pathname === '/watch') id = url.searchParams.get('v');
        const m = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
        if (m) id = m[2];
        if (url.pathname === '/playlist') list = url.searchParams.get('list');
    }
    if (id && /^[\w-]{6,}$/.test(id)) {
        return { watch: `https://www.youtube.com/watch?v=${id}`, embed: `https://www.youtube.com/embed/${id}` };
    }
    if (list && /^[\w-]+$/.test(list)) {
        return { watch: url.href, embed: `https://www.youtube.com/embed/videoseries?list=${list}` };
    }
    return null;
}

function parseFile(text, name) {
    const cfg = { heading: '', intro: '', showTitle: true, entries: [] };
    const seen = new Set();
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;

        // Settings for the whole page, e.g. "@title: off"
        if (line.startsWith('@')) {
            const m = line.match(/^@(\w+)\s*:\s*(.*)$/);
            if (!m) continue;
            const key = m[1].toLowerCase();
            const value = m[2].trim();
            if (key === 'heading') cfg.heading = value;
            else if (key === 'intro') cfg.intro = value;
            else if (key === 'title') cfg.showTitle = !OFF_VALUES.test(value);
            else console.warn(`${name}: unknown setting "@${m[1]}" ignored`);
            continue;
        }

        const fields = line.split('|').map((s) => s.trim());
        const urlPart = fields.shift();
        let showTitle;
        const text = [];
        for (const f of fields) {
            if (HIDE_WORDS.test(f)) showTitle = false;
            else if (SHOW_WORDS.test(f)) showTitle = true;
            else text.push(f);
        }

        // Links pasted without "https://" (example.com, localhost:8080/x) get https:// added.
        const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(urlPart) ? urlPart : 'https://' + urlPart;
        let url;
        try {
            url = new URL(withScheme);
        } catch {
            console.warn(`${name}: skipping (not a valid URL): ${line}`);
            continue;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            console.warn(`${name}: skipping (only http/https links): ${line}`);
            continue;
        }
        if (seen.has(url.href)) continue;
        seen.add(url.href);

        cfg.entries.push({
            url: url.href,
            title: text[0] || '',
            description: text.slice(1).join(' | '),
            showTitle,
            video: youtube(url)
        });
    }
    for (const e of cfg.entries) if (e.showTitle === undefined) e.showTitle = cfg.showTitle;
    return cfg;
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

async function readPrevious(files) {
    const map = new Map();
    for (const f of files) {
        try {
            const data = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
            for (const item of data.items || []) if (!map.has(item.url)) map.set(item.url, item);
        } catch {
            /* no previous data */
        }
    }
    return map;
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

async function videoTitle(watchUrl) {
    try {
        const res = await fetch(
            'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(watchUrl),
            { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) return '';
        return String((await res.json()).title || '').trim().slice(0, 100);
    } catch {
        return '';
    }
}

// ---------- read every links/<page>.txt ----------
const dirFiles = await readdir(DIR);
const txtFiles = dirFiles.filter((n) => n.endsWith('.txt')).sort();
const pages = [];
for (const file of txtFiles) {
    const name = file.slice(0, -4);
    pages.push({ name, ...parseFile(await readFile(path.join(DIR, file), 'utf8'), name) });
}
const previous = await readPrevious(dirFiles.filter((n) => n.endsWith('.json')));
await mkdir(SHOT_DIR, { recursive: true });

// ---------- screenshots (each URL once, even if several pages use it) ----------
const shots = new Map(); // url -> { image, updated, pageTitle }
const needShot = [...new Set(pages.flatMap((p) => p.entries.filter((e) => !e.video).map((e) => e.url)))];

if (!PARSE_ONLY && needShot.length) {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    for (const href of needShot) {
        const image = `${SHOT_DIR}/${slugFor(href)}.jpg`;
        let ok = false;
        let pageTitle = '';
        for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
            try {
                pageTitle = await capture(context, href, image);
                ok = true;
            } catch (err) {
                console.warn(`Attempt ${attempt} failed for ${href}: ${err.message.split('\n')[0]}`);
            }
        }
        if (ok) {
            shots.set(href, { image, updated: new Date().toISOString(), pageTitle });
            console.log(`Captured ${href}`);
        } else if (previous.get(href)?.image) {
            console.warn(`Keeping previous screenshot for ${href}`);
        } else {
            console.warn(`No screenshot for ${href}`);
        }
    }
    await browser.close();
}

// ---------- titles for videos without one ----------
const videoTitles = new Map();
if (!PARSE_ONLY) {
    const wanted = new Set(
        pages.flatMap((p) => p.entries.filter((e) => e.video && !e.title).map((e) => e.video.watch))
    );
    for (const watch of wanted) videoTitles.set(watch, await videoTitle(watch));
}

// ---------- write links/<page>.json ----------
const keepImages = new Set();
let total = 0;
for (const page of pages) {
    const items = page.entries.map((e) => {
        const old = previous.get(e.url);
        const shot = shots.get(e.url);
        const item = {
            url: e.url,
            title:
                e.title ||
                (e.video ? videoTitles.get(e.video.watch) : shot?.pageTitle) ||
                old?.title ||
                '',
            description: e.description,
            showTitle: e.showTitle,
            image: null
        };
        if (e.video) {
            item.video = e.video.embed;
        } else if (shot) {
            item.image = shot.image;
            item.updated = shot.updated;
        } else if (old?.image) {
            item.image = old.image; // keep the last good screenshot
            item.updated = old.updated;
        }
        if (item.image) keepImages.add(path.basename(item.image));
        return item;
    });
    total += items.length;
    const out = { heading: page.heading, intro: page.intro, items };
    await writeFile(path.join(DIR, `${page.name}.json`), JSON.stringify(out, null, 2) + '\n');
}

// ---------- tidy up ----------
const pageNames = new Set(pages.map((p) => p.name));
for (const f of dirFiles) {
    if (f.endsWith('.json') && !pageNames.has(f.slice(0, -5))) await rm(path.join(DIR, f));
}
for (const f of await readdir(SHOT_DIR)) {
    if (f.endsWith('.jpg') && !keepImages.has(f)) await rm(path.join(SHOT_DIR, f));
}

console.log(`Done: ${pages.length} pages, ${total} links.`);
