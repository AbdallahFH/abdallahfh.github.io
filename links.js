// Builds the cards on links.html from links.json.
// links.json is generated from links.txt by scripts/screenshots.mjs (run by GitHub Actions).
(async () => {
    const grid = document.getElementById('links-grid');
    if (!grid) return;

    const empty = (message) => {
        const p = document.createElement('p');
        p.className = 'links-empty';
        p.textContent = message;
        grid.replaceChildren(p);
    };

    let links;
    try {
        const res = await fetch('links.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        links = await res.json();
    } catch (err) {
        empty('Could not load the links right now.');
        return;
    }

    if (!Array.isArray(links) || links.length === 0) {
        empty('No links yet. Add some to links.txt.');
        return;
    }

    const cards = [];
    for (const item of links) {
        let url;
        try {
            url = new URL(item.url);
        } catch (e) {
            continue;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;

        const host = url.hostname.replace(/^www\./, '');

        const card = document.createElement('a');
        card.className = 'link-card';
        card.href = url.href;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

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

        const info = document.createElement('div');
        info.className = 'link-info';
        const title = document.createElement('h3');
        title.textContent = item.title || host;
        const hostLine = document.createElement('p');
        hostLine.className = 'link-host';
        hostLine.textContent = host;
        info.append(title, hostLine);
        if (item.description) {
            const desc = document.createElement('p');
            desc.className = 'link-desc';
            desc.textContent = item.description;
            info.appendChild(desc);
        }

        card.append(shot, info);
        cards.push(card);
    }

    if (cards.length === 0) {
        empty('No valid links found in links.txt.');
        return;
    }
    grid.replaceChildren(...cards);
})();
