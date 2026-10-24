// Language support (English at the root, Arabic in /ar/).
// Loaded in <head> of every page, before the page is drawn:
//  - if the visitor already chose a language with the button, send them to that language's twin page
//  - remember the choice when the language button is clicked
// Search engines have no saved choice, so they always see both versions.
(() => {
    const KEY = 'lang';
    const LANGS = ['en', 'ar'];
    const here = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    const file = location.pathname.split('/').pop() || 'index.html';

    // The same page in the other language, as a path relative to this page.
    function twin(lang) {
        if (lang === here) return null;
        return lang === 'ar' ? 'ar/' + file : '../' + file;
    }

    try {
        const saved = localStorage.getItem(KEY);
        if (saved && saved !== here && LANGS.includes(saved)) {
            const target = new URL(twin(saved), location.href);
            target.search = location.search;
            target.hash = location.hash;
            location.replace(target.href);
        }
    } catch (e) {
        /* storage blocked: just stay on this page */
    }

    document.addEventListener('click', (e) => {
        const button = e.target.closest && e.target.closest('#lang-toggle');
        if (!button) return;
        try {
            localStorage.setItem(KEY, button.dataset.lang);
        } catch (err) {
            /* ignore */
        }
    });
})();
