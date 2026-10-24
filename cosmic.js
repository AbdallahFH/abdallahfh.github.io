/* Cosmic animated background for Phantom Tale.
   - Twinkling parallax starfield, drifting nebula clouds, occasional shooting stars
   - Follows the existing dark / light toggle (body.light-mode)
   - Respects "reduce motion": draws one still frame instead of animating
   Loaded with <script src="cosmic.js" defer></script>; it creates its own <canvas>. */
(() => {
    const canvas = document.createElement('canvas');
    canvas.id = 'cosmos';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Depth layers: far stars are small and slow, near stars are bigger, faster and glow.
    const LAYERS = [
        { share: 0.62, size: [0.4, 0.9], drift: 3,  depth: 0.15, alpha: [0.35, 0.8] },
        { share: 0.28, size: [0.8, 1.4], drift: 7,  depth: 0.4,  alpha: [0.5, 0.9] },
        { share: 0.10, size: [1.3, 2.1], drift: 13, depth: 0.9,  alpha: [0.7, 1.0], glow: true }
    ];
    const TINTS = ['255,255,255', '200,220,255', '255,236,210', '215,200,255'];

    const THEMES = {
        dark: {
            sky: ['#04020d', '#0a0820', '#05040f'],
            nebula: [
                [0.22, 0.28, 0.55, '125,70,230', 0.30],
                [0.78, 0.22, 0.50, '40,110,240', 0.24],
                [0.60, 0.80, 0.60, '0,190,210', 0.15],
                [0.12, 0.85, 0.45, '225,70,150', 0.16],
                [0.90, 0.70, 0.40, '90,60,220', 0.18]
            ],
            blend: 'lighter',
            star: null,
            shooting: true
        },
        light: {
            sky: ['#f5f3fc', '#ebe7f8', '#f3f1fa'],
            nebula: [
                [0.22, 0.28, 0.55, '170,140,255', 0.30],
                [0.78, 0.22, 0.50, '120,170,255', 0.26],
                [0.60, 0.80, 0.60, '110,220,230', 0.20],
                [0.12, 0.85, 0.45, '255,150,205', 0.20],
                [0.90, 0.70, 0.40, '150,130,255', 0.20]
            ],
            blend: 'source-over',
            star: '60,50,120',
            shooting: false
        }
    };

    let w = 0, h = 0, dpr = 1;
    let stars = [];
    let shooters = [];
    let nebulaCanvas = null;
    let nebulaTheme = '';
    let nextShooter = 3;
    let running = false;
    let last = 0;
    let clock = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const rand = (a, b) => a + Math.random() * (b - a);
    const themeName = () => (document.body.classList.contains('light-mode') ? 'light' : 'dark');

    function buildStars() {
        const total = Math.max(90, Math.min(480, Math.round((w * h) / 4200)));
        stars = [];
        LAYERS.forEach((layer, li) => {
            const count = Math.round(total * layer.share);
            for (let i = 0; i < count; i++) {
                stars.push({
                    layer: li,
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: rand(layer.size[0], layer.size[1]),
                    a: rand(layer.alpha[0], layer.alpha[1]),
                    tint: TINTS[Math.floor(Math.random() * TINTS.length)],
                    phase: Math.random() * Math.PI * 2,
                    rate: rand(0.6, 2.2)
                });
            }
        });
    }

    function buildNebula(name) {
        const theme = THEMES[name];
        const nw = Math.ceil(w * 1.3 / 2);
        const nh = Math.ceil(h * 1.3 / 2);
        const off = document.createElement('canvas');
        off.width = nw;
        off.height = nh;
        const c = off.getContext('2d');
        c.globalCompositeOperation = theme.blend;
        theme.nebula.forEach(([fx, fy, fr, rgb, alpha]) => {
            const cx = fx * nw;
            const cy = fy * nh;
            const radius = fr * Math.max(nw, nh);
            c.save();
            c.translate(cx, cy);
            c.scale(1.5, 1); // stretch clouds sideways so they feel like wisps
            const g = c.createRadialGradient(0, 0, 0, 0, 0, radius / 1.5);
            g.addColorStop(0, `rgba(${rgb},${alpha})`);
            g.addColorStop(0.5, `rgba(${rgb},${alpha * 0.35})`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            c.fillStyle = g;
            c.fillRect(-radius * 1.5, -radius, radius * 3, radius * 2);
            c.restore();
        });
        nebulaCanvas = off;
        nebulaTheme = name;
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        buildStars();
        nebulaCanvas = null;
        if (!running) draw(0);
    }

    function drawSky(theme) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, theme.sky[0]);
        g.addColorStop(0.55, theme.sky[1]);
        g.addColorStop(1, theme.sky[2]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    function drawNebula(theme, name) {
        if (!nebulaCanvas || nebulaTheme !== name) buildNebula(name);
        const nw = w * 1.3;
        const nh = h * 1.3;
        const sway = Math.sin(clock * 0.05) * 0.5 + 0.5;
        const bob = Math.cos(clock * 0.037) * 0.5 + 0.5;
        const breathe = 1 + Math.sin(clock * 0.08) * 0.03;
        const ox = -(nw - w) * sway - pointer.x * 14;
        const oy = -(nh - h) * bob - pointer.y * 10 - window.scrollY * 0.02;
        ctx.save();
        ctx.globalCompositeOperation = theme.blend;
        ctx.globalAlpha = 1;
        ctx.translate(w / 2, h / 2);
        ctx.scale(breathe, breathe);
        ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(nebulaCanvas, ox, oy, nw, nh);
        ctx.restore();
    }

    function drawStars(theme, dt) {
        const animate = running;
        const scroll = window.scrollY;
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const layer = LAYERS[s.layer];
            if (animate) {
                s.x -= layer.drift * dt;
                s.y -= layer.drift * 0.35 * dt;
                if (s.x < -4) s.x += w + 8;
                if (s.y < -4) s.y += h + 8;
            }
            let px = s.x - pointer.x * 22 * layer.depth;
            let py = s.y - pointer.y * 16 * layer.depth - scroll * 0.06 * layer.depth;
            // wrap the parallax offset so the field never shows gaps
            px = ((px % (w + 8)) + (w + 8)) % (w + 8) - 4;
            py = ((py % (h + 8)) + (h + 8)) % (h + 8) - 4;

            const twinkle = animate ? 0.65 + 0.35 * Math.sin(clock * s.rate + s.phase) : 1;
            const alpha = s.a * twinkle;
            const rgb = theme.star || s.tint;
            const a = theme.star ? alpha * 0.7 : alpha;

            if (layer.glow && !theme.star) {
                const gr = s.r * 5;
                const g = ctx.createRadialGradient(px, py, 0, px, py, gr);
                g.addColorStop(0, `rgba(${rgb},${a * 0.55})`);
                g.addColorStop(1, `rgba(${rgb},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(px - gr, py - gr, gr * 2, gr * 2);
            }
            ctx.fillStyle = `rgba(${rgb},${a})`;
            if (s.r < 1.1) {
                ctx.fillRect(px - s.r / 2, py - s.r / 2, s.r, s.r);
            } else {
                ctx.beginPath();
                ctx.arc(px, py, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawShooters(dt) {
        for (let i = shooters.length - 1; i >= 0; i--) {
            const s = shooters[i];
            s.life += dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            const t = s.life / s.dur;
            if (t >= 1) {
                shooters.splice(i, 1);
                continue;
            }
            const fade = Math.sin(Math.PI * t);
            const tx = s.x - s.vx * 0.16;
            const ty = s.y - s.vy * 0.16;
            const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
            g.addColorStop(0, 'rgba(180,200,255,0)');
            g.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`);
            ctx.strokeStyle = g;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(s.x, s.y);
            ctx.stroke();
        }
    }

    function spawnShooter() {
        const angle = rand(0.35, 0.65); // radians below horizontal
        const speed = rand(650, 950);
        shooters.push({
            x: rand(w * 0.05, w * 0.8),
            y: rand(-20, h * 0.4),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            dur: rand(0.8, 1.3)
        });
    }

    function draw(dt) {
        const name = themeName();
        const theme = THEMES[name];
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        drawSky(theme);
        drawNebula(theme, name);
        ctx.globalCompositeOperation = 'source-over';
        drawStars(theme, dt);
        if (theme.shooting && running) {
            nextShooter -= dt;
            if (nextShooter <= 0) {
                spawnShooter();
                nextShooter = rand(4, 9);
            }
            drawShooters(dt);
        }
    }

    function frame(now) {
        if (!running) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        clock += dt;
        pointer.x += (pointer.tx - pointer.x) * Math.min(dt * 2.5, 1);
        pointer.y += (pointer.ty - pointer.y) * Math.min(dt * 2.5, 1);
        draw(dt);
        requestAnimationFrame(frame);
    }

    function start() {
        if (running) return;
        running = true;
        last = performance.now();
        requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        shooters = [];
        draw(0);
    }

    function applyMotionPreference() {
        if (motionQuery.matches) stop();
        else start();
    }

    window.addEventListener('resize', () => {
        clearTimeout(resize.timer);
        resize.timer = setTimeout(resize, 150);
    });
    window.addEventListener('pointermove', (e) => {
        pointer.tx = e.clientX / window.innerWidth - 0.5;
        pointer.ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    window.addEventListener('scroll', () => {
        if (!running) draw(0);
    }, { passive: true });

    // Redraw when the dark / light toggle flips (matters most for the still frame).
    new MutationObserver(() => { if (!running) draw(0); })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (motionQuery.addEventListener) motionQuery.addEventListener('change', applyMotionPreference);

    resize();
    applyMotionPreference();
})();
