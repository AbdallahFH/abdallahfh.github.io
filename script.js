const toggle = document.getElementById('dark-mode-toggle');
const icon = document.getElementById('theme-icon');
const topBar = document.getElementById('top-bar');

let lastScroll = 0;

// Saved theme lives in localStorage, which can throw (private mode, blocked storage).
// Never let that stop the toggle from working.
function readTheme() {
    try {
        return localStorage.getItem('theme');
    } catch (e) {
        return null;
    }
}

function saveTheme(value) {
    try {
        localStorage.setItem('theme', value);
    } catch (e) {
        /* ignore */
    }
}

function applyTheme(light) {
    document.body.classList.toggle('light-mode', light);
    if (icon) icon.src = light ? 'DarkModeOff.png' : 'DarkModeOn.png';
}

applyTheme(readTheme() === 'light');

if (topBar) {
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > lastScroll && currentScroll > 50) {
            topBar.style.transform = 'translateY(-100%)';
        } else {
            topBar.style.transform = 'translateY(0)';
        }
        lastScroll = currentScroll;
    });
}

if (toggle) {
    toggle.setAttribute('aria-label', 'Switch between dark and light mode');
    toggle.setAttribute('title', 'Switch between dark and light mode');
    toggle.addEventListener('click', () => {
        const light = !document.body.classList.contains('light-mode');
        applyTheme(light);
        saveTheme(light ? 'light' : 'dark');
    });
}
