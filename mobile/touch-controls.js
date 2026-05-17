// ─────────────────────────────────────────────────────────────────────────────
//  NEON SIEGE — Touch Buttons Only
//  Movement + look are handled DIRECTLY in game.js (touchstart/move on document).
//  This file only renders the action buttons and the joystick visual ring.
//  Shoot sets window.mobileShootActive; other buttons dispatch key events.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    window.mobileShootActive = false;

    // ── Inject styles ─────────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = `
        #touch-ui {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 500;
            user-select: none;
            -webkit-user-select: none;
        }

        /* ── Joystick area indicator (very subtle) ── */
        #joy-ring {
            position: absolute;
            left: 44px;
            bottom: 44px;
            width: 140px;
            height: 140px;
            border-radius: 50%;
            border: 1.5px solid rgba(0,255,200,0.12);
            background: rgba(0,255,200,0.03);
            pointer-events: none;
        }

        /* ── Base button style — nearly invisible ── */
        .t-btn {
            position: absolute;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
            touch-action: none;
            -webkit-tap-highlight-color: transparent;
            font-weight: 900;
            color: rgba(255,255,255,0.75);
            font-family: sans-serif;
            cursor: pointer;
            background: rgba(255,255,255,0.04);
            border: 1.5px solid rgba(255,255,255,0.18);
            transition: transform 0.08s, background 0.08s, border-color 0.08s;
        }
        .t-btn:active {
            transform: scale(0.90);
            background: rgba(255,255,255,0.14);
            border-color: rgba(255,255,255,0.5);
        }

        /* SHOOT — slightly more visible so user can find it */
        #tb-shoot {
            right: 22px; bottom: 36px;
            width: 96px; height: 96px;
            font-size: 26px;
            background: rgba(255,60,60,0.08);
            border: 1.5px solid rgba(255,80,80,0.30);
            color: rgba(255,120,120,0.85);
        }
        #tb-shoot.active {
            background: rgba(255,60,60,0.28);
            border-color: rgba(255,80,80,0.65);
            color: #fff;
        }

        /* RELOAD */
        #tb-reload {
            right: 136px; bottom: 40px;
            width: 62px; height: 62px;
            font-size: 14px; letter-spacing: 1px;
            border-color: rgba(255,200,0,0.22);
            color: rgba(255,200,0,0.7);
        }

        /* DASH */
        #tb-dash {
            right: 130px; bottom: 118px;
            width: 62px; height: 62px;
            font-size: 18px;
            border-color: rgba(0,200,255,0.22);
            color: rgba(0,200,255,0.7);
        }

        /* JUMP */
        #tb-jump {
            right: 218px; bottom: 50px;
            width: 56px; height: 56px;
            font-size: 16px;
            border-color: rgba(120,255,120,0.22);
            color: rgba(120,255,120,0.7);
        }

        /* PAUSE — top right, square, barely visible */
        #tb-pause {
            top: 12px; right: 12px;
            width: 46px; height: 46px;
            border-radius: 8px;
            font-size: 16px;
            background: rgba(0,0,0,0.20);
            border: 1px solid rgba(255,255,255,0.12);
            color: rgba(255,255,255,0.40);
        }
    `;
    document.head.appendChild(style);

    // ── Create touch-ui container ─────────────────────────────────────────────
    var ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML = `
        <div id="joy-ring"></div>
        <div id="tb-shoot"  class="t-btn">🔥</div>
        <div id="tb-reload" class="t-btn">R</div>
        <div id="tb-dash"   class="t-btn">💨</div>
        <div id="tb-jump"   class="t-btn">↑</div>
        <div id="tb-pause"  class="t-btn">⏸</div>
    `;
    document.body.appendChild(ui);

    // ── Button helpers ────────────────────────────────────────────────────────
    function onBtn(el, down, up) {
        el.addEventListener('touchstart', function (e) {
            e.preventDefault();
            if (down) down();
        }, { passive: false });
        el.addEventListener('touchend', function (e) {
            e.preventDefault();
            if (up) up();
        }, { passive: false });
        el.addEventListener('touchcancel', function (e) {
            e.preventDefault();
            if (up) up();
        }, { passive: false });
        // Fallback for desktop testing
        el.addEventListener('mousedown', function () { if (down) down(); });
        el.addEventListener('mouseup',   function () { if (up)   up();   });
    }

    function key(code) {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: code, bubbles: true }));
    }

    var shootBtn = document.getElementById('tb-shoot');

    onBtn(shootBtn,
        function () { window.mobileShootActive = true;  shootBtn.classList.add('active'); },
        function () { window.mobileShootActive = false; shootBtn.classList.remove('active'); }
    );
    onBtn(document.getElementById('tb-reload'), function () { key('KeyR'); });
    onBtn(document.getElementById('tb-dash'),   function () { key('KeyE'); });
    onBtn(document.getElementById('tb-jump'),   function () { key('Space'); });
    onBtn(document.getElementById('tb-pause'),  function () { key('Escape'); });

})();
