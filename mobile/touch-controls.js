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

        /* ── Joystick zone marker — ultra subtle ── */
        #joy-ring {
            position: absolute;
            left: 44px;
            bottom: 44px;
            width: 130px;
            height: 130px;
            border-radius: 50%;
            border: 1px solid rgba(0,255,200,0.07);
            background: transparent;
            pointer-events: none;
        }

        /* ── Base button — transparent, just a ghost outline ── */
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
            color: rgba(255,255,255,0.35);
            font-family: sans-serif;
            cursor: pointer;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.10);
            transition: transform 0.07s, background 0.07s, border-color 0.07s, color 0.07s;
        }
        .t-btn:active {
            transform: scale(0.88);
            background: rgba(255,255,255,0.10);
            border-color: rgba(255,255,255,0.40);
            color: rgba(255,255,255,0.90);
        }

        /* SHOOT — just a faint red tint, bigger hit area */
        #tb-shoot {
            right: 22px; bottom: 36px;
            width: 96px; height: 96px;
            font-size: 24px;
            border: 1px solid rgba(255,80,80,0.18);
            color: rgba(255,100,100,0.50);
        }
        #tb-shoot.active {
            background: rgba(255,60,60,0.18);
            border-color: rgba(255,80,80,0.55);
            color: rgba(255,180,180,0.95);
        }

        /* RELOAD */
        #tb-reload {
            right: 136px; bottom: 40px;
            width: 60px; height: 60px;
            font-size: 13px; letter-spacing: 1px;
            border-color: rgba(255,200,0,0.14);
            color: rgba(255,200,0,0.40);
        }

        /* DASH */
        #tb-dash {
            right: 130px; bottom: 116px;
            width: 60px; height: 60px;
            font-size: 17px;
            border-color: rgba(0,200,255,0.14);
            color: rgba(0,200,255,0.40);
        }

        /* JUMP */
        #tb-jump {
            right: 216px; bottom: 50px;
            width: 54px; height: 54px;
            font-size: 15px;
            border-color: rgba(120,255,120,0.14);
            color: rgba(120,255,120,0.40);
        }

        /* PAUSE — almost invisible */
        #tb-pause {
            top: 12px; right: 12px;
            width: 44px; height: 44px;
            border-radius: 8px;
            font-size: 15px;
            border: 1px solid rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.22);
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
