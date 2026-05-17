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

        /* ── Joystick visual (left bottom) ── */
        #joy-ring {
            position: absolute;
            left: 60px;
            bottom: 60px;
            width: 144px;
            height: 144px;
            border-radius: 50%;
            border: 2px solid rgba(0,255,200,0.25);
            background: rgba(0,255,200,0.05);
            pointer-events: none;
        }

        /* ── Buttons ── */
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
            color: #fff;
            font-family: sans-serif;
            cursor: pointer;
            transition: transform 0.08s, opacity 0.08s;
            border: 2px solid;
        }
        .t-btn:active {
            transform: scale(0.88);
            opacity: 0.75;
        }

        /* SHOOT — big red, right bottom */
        #tb-shoot {
            right: 28px; bottom: 40px;
            width: 100px; height: 100px;
            font-size: 28px;
            background: rgba(220,40,40,0.28);
            border-color: rgba(255,80,80,0.7);
            box-shadow: 0 0 20px rgba(255,50,50,0.3);
        }
        #tb-shoot.active {
            background: rgba(220,40,40,0.55);
            box-shadow: 0 0 32px rgba(255,50,50,0.6);
        }

        /* RELOAD */
        #tb-reload {
            right: 148px; bottom: 44px;
            width: 66px; height: 66px;
            font-size: 15px; letter-spacing: 1px;
            background: rgba(255,200,0,0.15);
            border-color: rgba(255,200,0,0.5);
        }

        /* DASH */
        #tb-dash {
            right: 142px; bottom: 126px;
            width: 66px; height: 66px;
            font-size: 20px;
            background: rgba(0,200,255,0.15);
            border-color: rgba(0,200,255,0.5);
        }

        /* JUMP */
        #tb-jump {
            right: 230px; bottom: 56px;
            width: 60px; height: 60px;
            font-size: 17px;
            background: rgba(100,255,100,0.12);
            border-color: rgba(120,255,120,0.45);
        }

        /* PAUSE — top right corner, square */
        #tb-pause {
            top: 14px; right: 14px;
            width: 50px; height: 50px;
            border-radius: 10px;
            font-size: 18px;
            background: rgba(0,0,0,0.55);
            border-color: rgba(255,255,255,0.2);
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
