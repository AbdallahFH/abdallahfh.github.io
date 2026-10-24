// Fills the links section of a page from links/<page>.json (generated from links/<page>.txt).
// If the page has no links, the section stays hidden and nothing is shown.
(async () => {
    const section = document.getElementById('page-links');
    if (!section) return;
    const page = section.dataset.page;
    if (!page) return;

    let data;
    try {
        const res = await fetch('links/' + encodeURIComponent(page) + '.json', { cache: 'no-cache' });
        if (!res.ok) return;
        data = await res.json();
    } catch (err) {
        return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const cards = [];

    for (const item of items) {
        let url;
        try {
            url = new URL(item.url);
        } catch (e) {
            continue;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;

        const host = url.hostname.replace(/^www\./, '');
        const showTitle = item.showTitle !== false;
        const label = item.title || host;

        const info = document.createElement('div');
        info.className = 'link-info';
        if (showTitle) {
            const title = document.createElement('h3');
            title.textContent = label;
            info.appendChild(title);
        }
        if (showTitle && !item.video) {
            const hostLine = document.createElement('p');
            hostLine.className = 'link-host';
            hostLine.textContent = host;
            info.appendChild(hostLine);
        }
        if (item.description) {
            const desc = document.createElement('p');
            desc.className = 'link-desc';
            desc.textContent = item.description;
            info.appendChild(desc);
        }

        let card;
        if (item.video && /^https:\/\/www\.youtube\.com\/embed\//.test(item.video)) {
            // YouTube video: embedded player
            card = document.createElement('div');
            card.className = 'link-card video-card';
            const frameBox = document.createElement('div');
            frameBox.className = 'link-video';
            const frame = document.createElement('iframe');
            frame.src = item.video;
            frame.title = label;
            frame.loading = 'lazy';
            frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            frame.allowFullscreen = true;
            frame.referrerPolicy = 'strict-origin-when-cross-origin';
            frameBox.appendChild(frame);
            card.appendChild(frameBox);
        } else {
            // Normal link: header screenshot, opens in a new tab
            card = document.createElement('a');
            card.className = 'link-card';
            card.href = url.href;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.setAttribute('aria-label', label);

            const shot = document.createElement('div');
            shot.className = 'link-shot';
            const showInitial = () => {
                shot.replaceChildren();
                const initial = document.createElement('span');
                initial.className = 'link-initial';
                initial.textContent = host.charAt(0);
                shot.appendChild(initial);
            };
            if (item.image) {
                const img = document.createElement('img');
                img.loading = 'lazy';
                img.alt = 'Screenshot of ' + host;
                img.src = item.image + (item.updated ? '?v=' + encodeURIComponent(item.updated) : '');
                img.addEventListener('error', showInitial);
                shot.appendChild(img);
            } else {
                showInitial();
            }
            card.appendChild(shot);
        }
        if (info.childNodes.length) card.appendChild(info);
        cards.push(card);
    }

    if (cards.length === 0) return; // nothing to show, section stays hidden

    const parts = [];
    if (data.heading) {
        const h = document.createElement('h2');
        h.textContent = data.heading;
        parts.push(h);
    }
    if (data.intro) {
        const p = document.createElement('p');
        p.className = 'links-intro';
        p.textContent = data.intro;
        parts.push(p);
    }
    const grid = document.createElement('div');
    grid.className = 'links-grid';
    grid.append(...cards);
    parts.push(grid);

    section.replaceChildren(...parts);
    section.hidden = false;
})();
