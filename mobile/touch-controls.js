// ─────────────────────────────────────────────────────────────────────────────
//  NEON SIEGE — Touch Controls for Mobile
//  Starts hidden. game.js calls updateTouchUI() to show/hide via .game-active.
//  Joystick (left) + look swipe (right) + action buttons (right side).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    // ── State exposed to the game ─────────────────────────────────────────────
    window.touchInput = {
        moveX: 0,   // -1 to 1
        moveY: 0,   // -1 to 1
        lookDX: 0,  // accumulated look delta this frame
        lookDY: 0,
        shooting: false,
    };

    var JOYSTICK_RADIUS = 65;
    var DEAD_ZONE       = 10;

    // ── CSS injection ─────────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = `
        #touch-ui {
            position: fixed; inset: 0;
            pointer-events: none;
            z-index: 500;
            user-select: none;
            -webkit-user-select: none;
        }

        /* Left 45% — joystick movement */
        #joy-zone {
            position: absolute;
            left: 0; top: 0;
            width: 45%; height: 100%;
            pointer-events: auto;
            touch-action: none;
        }

        #joy-base {
            position: absolute;
            width: 130px; height: 130px;
            border-radius: 50%;
            background: rgba(0,255,200,0.07);
            border: 2px solid rgba(0,255,200,0.3);
            transform: translate(-50%, -50%);
            display: none;
            pointer-events: none;
        }
        #joy-stick {
            position: absolute;
            width: 56px; height: 56px;
            border-radius: 50%;
            background: rgba(0,255,200,0.4);
            border: 2px solid rgba(0,255,200,0.8);
            box-shadow: 0 0 18px rgba(0,255,200,0.35);
            transform: translate(-50%, -50%);
            display: none;
            pointer-events: none;
        }

        /* Right 55% — look + shoot */
        #look-zone {
            position: absolute;
            right: 0; top: 0;
            width: 55%; height: 100%;
            pointer-events: auto;
            touch-action: none;
        }

        /* ── Action buttons ── */
        .touch-btn {
            position: absolute;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
            touch-action: none;
            -webkit-tap-highlight-color: transparent;
            font-weight: 800;
            color: #fff;
            transition: transform 0.08s, background 0.08s;
        }
        .touch-btn:active { transform: scale(0.9); }

        #btn-shoot {
            right: 24px; bottom: 48px;
            width: 96px; height: 96px;
            font-size: 30px;
            background: rgba(255,50,50,0.22);
            border: 3px solid rgba(255,80,80,0.65);
            box-shadow: 0 0 22px rgba(255,50,50,0.25);
        }
        #btn-shoot.active {
            background: rgba(255,50,50,0.5);
            box-shadow: 0 0 34px rgba(255,50,50,0.55);
        }

        #btn-dash {
            right: 138px; bottom: 54px;
            width: 72px; height: 72px;
            font-size: 22px;
            background: rgba(0,200,255,0.18);
            border: 2px solid rgba(0,200,255,0.5);
        }

        #btn-jump {
            right: 132px; bottom: 142px;
            width: 62px; height: 62px;
            font-size: 18px;
            background: rgba(100,255,100,0.15);
            border: 2px solid rgba(100,255,100,0.4);
        }

        #btn-reload {
            right: 230px; bottom: 58px;
            width: 62px; height: 62px;
            font-size: 15px;
            letter-spacing: 1px;
            background: rgba(255,200,0,0.14);
            border: 2px solid rgba(255,200,0,0.4);
        }

        #btn-pause-touch {
            top: 14px; right: 14px;
            width: 52px; height: 52px;
            border-radius: 10px !important;
            font-size: 20px;
            background: rgba(0,0,0,0.55);
            border: 1px solid rgba(255,255,255,0.2);
        }
    `;
    document.head.appendChild(style);

    // ── DOM ───────────────────────────────────────────────────────────────────
    var ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML = `
        <div id="joy-zone">
            <div id="joy-base"></div>
            <div id="joy-stick"></div>
        </div>
        <div id="look-zone"></div>
        <div id="btn-shoot"  class="touch-btn">🔥</div>
        <div id="btn-dash"   class="touch-btn">💨</div>
        <div id="btn-jump"   class="touch-btn">↑</div>
        <div id="btn-reload" class="touch-btn">R</div>
        <div id="btn-pause-touch" class="touch-btn">⏸</div>
    `;
    document.body.appendChild(ui);

    var joyZone  = document.getElementById('joy-zone');
    var joyBase  = document.getElementById('joy-base');
    var joyStick = document.getElementById('joy-stick');
    var lookZone = document.getElementById('look-zone');
    var btnShoot = document.getElementById('btn-shoot');

    // ── Virtual joystick ──────────────────────────────────────────────────────
    var joyTouchId = null;
    var joyOriginX = 0, joyOriginY = 0;

    joyZone.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (joyTouchId !== null) return;
        var t = e.changedTouches[0];
        joyTouchId = t.identifier;
        joyOriginX = t.clientX;
        joyOriginY = t.clientY;
        joyBase.style.left = t.clientX + 'px';
        joyBase.style.top  = t.clientY + 'px';
        joyStick.style.left = t.clientX + 'px';
        joyStick.style.top  = t.clientY + 'px';
        joyBase.style.display  = 'block';
        joyStick.style.display = 'block';
    }, { passive: false });

    joyZone.addEventListener('touchmove', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier !== joyTouchId) continue;

            var dx   = t.clientX - joyOriginX;
            var dy   = t.clientY - joyOriginY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var ang  = Math.atan2(dy, dx);
            var cl   = Math.min(dist, JOYSTICK_RADIUS);

            joyStick.style.left = (joyOriginX + Math.cos(ang) * cl) + 'px';
            joyStick.style.top  = (joyOriginY + Math.sin(ang) * cl) + 'px';

            if (dist < DEAD_ZONE) {
                window.touchInput.moveX = 0;
                window.touchInput.moveY = 0;
            } else {
                window.touchInput.moveX =  Math.cos(ang) * (cl / JOYSTICK_RADIUS);
                window.touchInput.moveY =  Math.sin(ang) * (cl / JOYSTICK_RADIUS);
            }
        }
    }, { passive: false });

    function joyEnd(e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joyTouchId) {
                joyTouchId = null;
                window.touchInput.moveX = 0;
                window.touchInput.moveY = 0;
                joyBase.style.display  = 'none';
                joyStick.style.display = 'none';
            }
        }
    }
    joyZone.addEventListener('touchend',    joyEnd, { passive: false });
    joyZone.addEventListener('touchcancel', joyEnd, { passive: false });

    // ── Look / aim zone ───────────────────────────────────────────────────────
    var lookPrev = {};
    var LOOK_SENS = 0.4;

    lookZone.addEventListener('touchstart', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            lookPrev[t.identifier] = { x: t.clientX, y: t.clientY };
        }
    }, { passive: false });

    lookZone.addEventListener('touchmove', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t    = e.changedTouches[i];
            var prev = lookPrev[t.identifier];
            if (!prev) continue;
            window.touchInput.lookDX += (t.clientX - prev.x) * LOOK_SENS;
            window.touchInput.lookDY += (t.clientY - prev.y) * LOOK_SENS;
            lookPrev[t.identifier] = { x: t.clientX, y: t.clientY };
        }
    }, { passive: false });

    function lookEnd(e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            delete lookPrev[e.changedTouches[i].identifier];
        }
    }
    lookZone.addEventListener('touchend',    lookEnd, { passive: false });
    lookZone.addEventListener('touchcancel', lookEnd, { passive: false });

    // ── Action buttons ────────────────────────────────────────────────────────
    function touchBtn(el, onDown, onUp) {
        el.addEventListener('touchstart', function (e) {
            e.preventDefault(); e.stopPropagation();
            onDown();
        }, { passive: false });
        el.addEventListener('touchend', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (onUp) onUp();
        }, { passive: false });
        el.addEventListener('touchcancel', function (e) {
            e.preventDefault();
            if (onUp) onUp();
        }, { passive: false });
    }

    function fakeKey(code) {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: code, bubbles: true }));
    }

    touchBtn(btnShoot,
        function () { window.touchInput.shooting = true;  btnShoot.classList.add('active'); },
        function () { window.touchInput.shooting = false; btnShoot.classList.remove('active'); }
    );
    touchBtn(document.getElementById('btn-dash'),        function () { fakeKey('KeyE'); });
    touchBtn(document.getElementById('btn-jump'),        function () { fakeKey('Space'); });
    touchBtn(document.getElementById('btn-reload'),      function () { fakeKey('KeyR'); });
    touchBtn(document.getElementById('btn-pause-touch'), function () { fakeKey('Escape'); });

    // ── Expose delta reader (cleared after each read by game loop) ────────────
    window.consumeTouchLook = function () {
        var dx = window.touchInput.lookDX;
        var dy = window.touchInput.lookDY;
        window.touchInput.lookDX = 0;
        window.touchInput.lookDY = 0;
        return { dx: dx, dy: dy };
    };

    // ── Prevent browser bounce / scroll only inside game zones ────────────────
    // (We use e.preventDefault() directly on each zone above, so no global block needed)

})();
