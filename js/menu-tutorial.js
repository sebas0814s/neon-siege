// Tutorial interactivo: ilumina cada control al probarlo y lleva un contador.
(function () {
    'use strict';

    var PRESS_MS = 250;
    var TOTAL = 9;

    function init() {
        var screenEl = document.getElementById('tutorial-screen');
        if (!screenEl) return;

        var grid = screenEl.querySelector('.controls-grid');
        var items = Array.prototype.slice.call(screenEl.querySelectorAll('.ctrl-item'));

        /* key-box (texto normalizado) → .ctrl-item */
        var byLabel = {};
        var timers = {};
        var tried = {};

        function norm(text) {
            return String(text).replace(/\s+/g, ' ').trim().toUpperCase();
        }

        items.forEach(function (item) {
            var box = item.querySelector('.key-box');
            if (box) byLabel[norm(box.textContent)] = item;
        });

        if (items.length) TOTAL = items.length;

        /* Estilos de pressed / tried inyectados por JS */
        var style = document.createElement('style');
        style.textContent =
            '.ctrl-item .key-box{transition:transform 120ms ease,box-shadow 120ms ease,border-color 120ms ease,color 120ms ease}' +
            '.ctrl-item.pressed .key-box{transform:scale(.92) translateY(2px); box-shadow:0 0 18px var(--accent); border-color:var(--accent); color:#fff}' +
            '.ctrl-item.tried .key-box{border-color:var(--accent)}' +
            '.ctrl-item.tried .ctrl-label::after{content:" ✓"; color:var(--accent)}';
        document.head.appendChild(style);

        /* Contador encima de .controls-grid */
        var progress = document.getElementById('tut-progress');
        if (!progress && grid) {
            progress = document.createElement('div');
            progress.id = 'tut-progress';
            progress.style.textAlign = 'center';
            progress.style.letterSpacing = '2px';
            progress.style.color = 'rgba(255,255,255,.6)';
            progress.style.marginBottom = '14px';
            progress.style.transition = 'color .2s';
            progress.style.fontSize = '12px';
            grid.parentNode.insertBefore(progress, grid);
        }

        function updateProgress() {
            if (!progress) return;
            var n = Object.keys(tried).length;
            if (n >= TOTAL) {
                progress.textContent = '¡Listo para jugar!';
                progress.style.color = 'var(--accent)';
            } else {
                progress.textContent = 'Prueba los controles: ' + n + ' / ' + TOTAL;
                progress.style.color = 'rgba(255,255,255,.6)';
            }
        }

        function press(label) {
            var key = norm(label);
            var item = byLabel[key];
            if (!item) return;

            if (!tried[key]) {
                tried[key] = true;
                item.classList.add('tried');
                updateProgress();
            }

            item.classList.add('pressed');
            clearTimeout(timers[key]);
            timers[key] = setTimeout(function () {
                item.classList.remove('pressed');
            }, PRESS_MS);
        }

        function reset() {
            tried = {};
            Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); });
            timers = {};
            items.forEach(function (item) {
                item.classList.remove('pressed', 'tried');
            });
            updateProgress();
        }

        function visible() {
            return !screenEl.classList.contains('hidden');
        }

        var KEY_LABEL = {
            w: 'W A S D', a: 'W A S D', s: 'W A S D', d: 'W A S D',
            e: 'E',
            r: 'R',
            b: 'B',
            '1': '1 / 2 / 3', '2': '1 / 2 / 3', '3': '1 / 2 / 3'
        };

        document.addEventListener('keydown', function (ev) {
            if (!visible()) return;
            var key = ev.key;
            var label = null;

            if (key === ' ' || key === 'Spacebar' || ev.code === 'Space') {
                label = 'SPACE';
                ev.preventDefault();
            } else if (key === 'Escape' || key === 'Esc') {
                label = 'ESC';
            } else {
                label = KEY_LABEL[String(key).toLowerCase()] || null;
                if (label) ev.preventDefault();
            }

            if (label) press(label);
        });

        screenEl.addEventListener('mousemove', function () {
            if (visible()) press('RATÓN');
        });

        screenEl.addEventListener('mousedown', function () {
            if (visible()) press('CLIC');
        });

        /* Resetea al volver a abrirse la pantalla */
        new MutationObserver(function () {
            if (visible()) reset();
        }).observe(screenEl, { attributes: true, attributeFilter: ['class'] });

        updateProgress();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
