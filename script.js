const toggle = document.getElementById('dark-mode-toggle');
const icon = document.getElementById('theme-icon');
const topBar = document.getElementById('top-bar');

let lastScroll = 0;

/* Default Dark Mode */
const savedTheme = localStorage.getItem('theme');

if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    icon.src = "DarkModeOff.png";
} else {
    icon.src = "DarkModeOn.png";
}

/* Scroll hide top bar */
window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > lastScroll && currentScroll > 50) {
        topBar.style.transform = 'translateY(-100%)';
    } else {
        topBar.style.transform = 'translateY(0)';
    }
    lastScroll = currentScroll;
});

/* Toggle Theme */
toggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');

    if (document.body.classList.contains('light-mode')) {
        icon.src = "DarkModeOff.png";
        localStorage.setItem('theme', 'light');
    } else {
        icon.src = "DarkModeOn.png";
        localStorage.setItem('theme', 'dark');
    }
});
