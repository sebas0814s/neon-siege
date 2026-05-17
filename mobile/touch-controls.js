// ─────────────────────────────────────────────────────────────────────────────
//  NEON SIEGE — Touch Controls for Mobile
//  Injects a virtual joystick (left) and action buttons (right) into the game.
//  Designed for landscape orientation on Android phones.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    // ── State exposed to the game ─────────────────────────────────────────────
    window.touchInput = {
        moveX: 0,   // -1 to 1 (left/right)
        moveY: 0,   // -1 to 1 (forward/back)
        lookDX: 0,  // accumulated look delta X this frame
        lookDY: 0,  // accumulated look delta Y this frame
        shooting: false,
    };

    var JOYSTICK_RADIUS = 60;
    var DEAD_ZONE = 8;

    // ── DOM injection ─────────────────────────────────────────────────────────
    var css = document.createElement('style');
    css.textContent = `
        #touch-ui {
            position: fixed; inset: 0;
            pointer-events: none;
            z-index: 500;
            user-select: none;
        }

        /* ── Left zone: joystick ── */
        #joy-zone {
            position: absolute;
            left: 0; top: 0;
            width: 45%; height: 100%;
            pointer-events: auto;
        }
        #joy-base {
            position: absolute;
            width: 120px; height: 120px;
            border-radius: 50%;
            background: rgba(0,255,200,0.08);
            border: 2px solid rgba(0,255,200,0.25);
            transform: translate(-50%,-50%);
            display: none;
        }
        #joy-stick {
            position: absolute;
            width: 52px; height: 52px;
            border-radius: 50%;
            background: rgba(0,255,200,0.35);
            border: 2px solid rgba(0,255,200,0.7);
            box-shadow: 0 0 16px rgba(0,255,200,0.3);
            transform: translate(-50%,-50%);
            display: none;
        }

        /* ── Right zone: look + buttons ── */
        #look-zone {
            position: absolute;
            right: 0; top: 0;
            width: 55%; height: 100%;
            pointer-events: auto;
        }

        /* ── Action buttons ── */
        #btn-shoot {
            position: absolute;
            right: 28px; bottom: 60px;
            width: 90px; height: 90px;
            border-radius: 50%;
            background: rgba(255,50,50,0.25);
            border: 3px solid rgba(255,80,80,0.7);
            box-shadow: 0 0 20px rgba(255,50,50,0.3);
            color: #fff; font-size: 28px;
            display: flex; align-items: center; justify-content: center;
            pointer-events: auto;
            touch-action: none;
        }
        #btn-shoot.active {
            background: rgba(255,50,50,0.55);
            box-shadow: 0 0 30px rgba(255,50,50,0.6);
        }

        #btn-dash {
            position: absolute;
            right: 135px; bottom: 68px;
            width: 68px; height: 68px;
            border-radius: 50%;
            background: rgba(0,200,255,0.18);
            border: 2px solid rgba(0,200,255,0.5);
            color: #fff; font-size: 18px;
            display: flex; align-items: center; justify-content: center;
            pointer-events: auto;
            touch-action: none;
        }

        #btn-jump {
            position: absolute;
            right: 130px; bottom: 148px;
            width: 58px; height: 58px;
            border-radius: 50%;
            background: rgba(100,255,100,0.18);
            border: 2px solid rgba(100,255,100,0.4);
            color: #fff; font-size: 16px;
            display: flex; align-items: center; justify-content: center;
            pointer-events: auto;
            touch-action: none;
        }

        #btn-reload {
            position: absolute;
            right: 230px; bottom: 68px;
            width: 58px; height: 58px;
            border-radius: 50%;
            background: rgba(255,200,0,0.15);
            border: 2px solid rgba(255,200,0,0.4);
            color: #fff; font-size: 14px;
            display: flex; align-items: center; justify-content: center;
            pointer-events: auto;
            touch-action: none;
            letter-spacing: 1px; font-weight: 800;
        }

        #btn-pause-touch {
            position: absolute;
            top: 16px; right: 16px;
            width: 50px; height: 50px;
            border-radius: 10px;
            background: rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.7);
            font-size: 20px;
            display: flex; align-items: center; justify-content: center;
            pointer-events: auto;
            touch-action: none;
        }
    `;
    document.head.appendChild(css);

    var ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML = `
        <div id="joy-zone">
            <div id="joy-base"></div>
            <div id="joy-stick"></div>
        </div>
        <div id="look-zone"></div>
        <div id="btn-shoot">🔥</div>
        <div id="btn-dash">💨</div>
        <div id="btn-jump">↑</div>
        <div id="btn-reload">R</div>
        <div id="btn-pause-touch">⏸</div>
    `;
    document.body.appendChild(ui);

    var joyZone  = document.getElementById('joy-zone');
    var joyBase  = document.getElementById('joy-base');
    var joyStick = document.getElementById('joy-stick');
    var lookZone = document.getElementById('look-zone');
    var btnShoot = document.getElementById('btn-shoot');

    // ── Joystick logic ────────────────────────────────────────────────────────
    var joyOriginX = 0, joyOriginY = 0;
    var joyTouchId = null;

    joyZone.addEventListener('touchstart', function (e) {
        if (joyTouchId !== null) return;
        var t = e.changedTouches[0];
        joyTouchId = t.identifier;
        joyOriginX = t.clientX;
        joyOriginY = t.clientY;

        joyBase.style.left  = t.clientX + 'px';
        joyBase.style.top   = t.clientY + 'px';
        joyStick.style.left = t.clientX + 'px';
        joyStick.style.top  = t.clientY + 'px';
        joyBase.style.display  = 'block';
        joyStick.style.display = 'block';
    }, { passive: true });

    joyZone.addEventListener('touchmove', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier !== joyTouchId) continue;

            var dx = t.clientX - joyOriginX;
            var dy = t.clientY - joyOriginY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var clamp = Math.min(dist, JOYSTICK_RADIUS);
            var angle = Math.atan2(dy, dx);

            var sx = Math.cos(angle) * clamp;
            var sy = Math.sin(angle) * clamp;

            joyStick.style.left = (joyOriginX + sx) + 'px';
            joyStick.style.top  = (joyOriginY + sy) + 'px';

            if (dist < DEAD_ZONE) {
                window.touchInput.moveX = 0;
                window.touchInput.moveY = 0;
            } else {
                window.touchInput.moveX =  Math.cos(angle) * (clamp / JOYSTICK_RADIUS);
                window.touchInput.moveY =  Math.sin(angle) * (clamp / JOYSTICK_RADIUS);
            }
        }
    }, { passive: true });

    function joyEnd(e) {
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
    joyZone.addEventListener('touchend',    joyEnd, { passive: true });
    joyZone.addEventListener('touchcancel', joyEnd, { passive: true });

    // ── Look zone (right side swipe to aim) ───────────────────────────────────
    var lookTouches = {};
    var LOOK_SENSITIVITY = 0.35;

    lookZone.addEventListener('touchstart', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            lookTouches[t.identifier] = { x: t.clientX, y: t.clientY };
        }
    }, { passive: true });

    lookZone.addEventListener('touchmove', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            var prev = lookTouches[t.identifier];
            if (!prev) continue;
            window.touchInput.lookDX += (t.clientX - prev.x) * LOOK_SENSITIVITY;
            window.touchInput.lookDY += (t.clientY - prev.y) * LOOK_SENSITIVITY;
            lookTouches[t.identifier] = { x: t.clientX, y: t.clientY };
        }
    }, { passive: true });

    function lookEnd(e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            delete lookTouches[e.changedTouches[i].identifier];
        }
    }
    lookZone.addEventListener('touchend',    lookEnd, { passive: true });
    lookZone.addEventListener('touchcancel', lookEnd, { passive: true });

    // ── Action buttons ────────────────────────────────────────────────────────
    function fireBtn(el, onDown, onUp) {
        el.addEventListener('touchstart', function (e) {
            e.preventDefault(); onDown();
        });
        el.addEventListener('touchend',    function (e) { e.preventDefault(); if (onUp) onUp(); });
        el.addEventListener('touchcancel', function (e) { e.preventDefault(); if (onUp) onUp(); });
    }

    fireBtn(btnShoot,
        function () { window.touchInput.shooting = true;  btnShoot.classList.add('active'); },
        function () { window.touchInput.shooting = false; btnShoot.classList.remove('active'); }
    );

    fireBtn(document.getElementById('btn-dash'), function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    });

    fireBtn(document.getElementById('btn-jump'), function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    });

    fireBtn(document.getElementById('btn-reload'), function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    });

    fireBtn(document.getElementById('btn-pause-touch'), function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    });

    // ── Expose delta reader (called by game loop) ─────────────────────────────
    window.consumeTouchLook = function () {
        var dx = window.touchInput.lookDX;
        var dy = window.touchInput.lookDY;
        window.touchInput.lookDX = 0;
        window.touchInput.lookDY = 0;
        return { dx: dx, dy: dy };
    };

    // ── Lock landscape orientation ────────────────────────────────────────────
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function () {});
    }

    // ── Prevent browser gestures interfering ─────────────────────────────────
    document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

})();
