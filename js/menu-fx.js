/**
 * ============================================================================
 * NEON SIEGE — MENU FX INTERACTIVITY LAYER
 * js/menu-fx.js
 * ============================================================================
 */
(function () {
    'use strict';

    // ── Global Flags & Audio ──────────────────────────────────────────────────
    var audioCtx = null;
    var lastBlipTime = 0;

    function getAudioContext() {
        if (!audioCtx) {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioCtx = new AudioCtx();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(function () {});
        }
        return audioCtx;
    }

    function playHoverBlip() {
        // Respect settings.volume if available
        if (window.settings && typeof window.settings.volume === 'number' && window.settings.volume <= 0) {
            return;
        }

        var now = performance.now();
        if (now - lastBlipTime < 40) return; // Throttle to prevent audio mud
        lastBlipTime = now;

        try {
            var ctx = getAudioContext();
            if (!ctx) return;

            var volFactor = (window.settings && typeof window.settings.volume === 'number')
                ? (window.settings.volume / 100)
                : 0.8;

            var gainNode = ctx.createGain();
            var osc = ctx.createOscillator();
            var t = ctx.currentTime;
            var maxGain = 0.032 * volFactor; // Very soft and subtle

            gainNode.gain.setValueAtTime(0.0001, t);
            gainNode.gain.exponentialRampToValueAtTime(maxGain, t + 0.004);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(560, t);
            osc.frequency.exponentialRampToValueAtTime(840, t + 0.038);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start(t);
            osc.stop(t + 0.048);
        } catch (e) {
            // Audio context policy safe guard
        }
    }

    // ── Helper: Is Game Playing or Menu Active ────────────────────────────────
    // offsetParent is always null for position:fixed screens, so check computed display instead.
    function isShown(el) {
        return Boolean(el) && getComputedStyle(el).display !== 'none';
    }

    function isMenuModeActive() {
        // If pointer is locked, player is playing in-game
        if (document.pointerLockElement) return false;

        // Check if any sub-screen is currently visible
        var openSub = document.querySelector('.sub-screen:not(.hidden)');
        if (openSub && isShown(openSub)) return true;

        // Check if #main-menu is currently visible
        var mm = document.getElementById('main-menu');
        if (mm && mm.style.display !== 'none' && !mm.classList.contains('hidden') && isShown(mm)) {
            return true;
        }

        return false;
    }

    function isMainMenuOnlyActive() {
        var openSub = document.querySelector('.sub-screen:not(.hidden)');
        if (openSub && isShown(openSub)) return false;

        var mm = document.getElementById('main-menu');
        return Boolean(mm && mm.style.display !== 'none' && !mm.classList.contains('hidden') && isShown(mm));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1. LIVE BACKGROUND CANVAS (Perspective Neon Grid + Particles + Parallax)
    // ══════════════════════════════════════════════════════════════════════════
    var canvas = null;
    var ctx = null;
    var rafId = null;
    var isCanvasRunning = false;
    var width = 0;
    var height = 0;

    var isCoarse = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var prefersReducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var particles = [];
    var particleCount = isCoarse ? 20 : 55;
    var gridOffset = 0;

    var mouseX = -9999;
    var mouseY = -9999;
    var mouseInside = false;
    var currentPX = 0;
    var currentPY = 0;

    function initCanvas() {
        var mainMenu = document.getElementById('main-menu');
        if (!mainMenu) return;

        var menuOverlay = document.getElementById('menu-overlay');
        var menuContent = document.getElementById('menu-content');

        canvas = document.getElementById('menu-fx-bg');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'menu-fx-bg';
            if (menuContent && menuContent.parentNode === mainMenu) {
                mainMenu.insertBefore(canvas, menuContent);
            } else if (menuOverlay && menuOverlay.nextSibling) {
                mainMenu.insertBefore(canvas, menuOverlay.nextSibling);
            } else {
                mainMenu.appendChild(canvas);
            }
        }

        ctx = canvas.getContext('2d');
        resizeCanvas();

        window.addEventListener('resize', resizeCanvas, { passive: true });

        // Spawn particles
        particles = [];
        for (var i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.45,
                vy: (Math.random() - 0.5) * 0.45,
                size: Math.random() * 1.6 + 0.8,
                alpha: Math.random() * 0.5 + 0.25,
                pulse: Math.random() * Math.PI * 2
            });
        }

        // Mouse tracking for parallax & particle reaction
        window.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
            mouseInside = true;
        }, { passive: true });

        window.addEventListener('mouseleave', function () {
            mouseInside = false;
            mouseX = -9999;
            mouseY = -9999;
        }, { passive: true });

        checkCanvasState();
    }

    function resizeCanvas() {
        if (!canvas) return;
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    function renderCanvasFrame() {
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);

        var horizonY = Math.floor(height * 0.46);
        var vanishingX = (width * 0.5) + (currentPX * 30);

        // ── 1. Soft Horizon Glow ──────────────────────────────────────────────
        var horizonGrad = ctx.createLinearGradient(0, horizonY - 45, 0, horizonY + 70);
        horizonGrad.addColorStop(0, 'rgba(0, 255, 204, 0)');
        horizonGrad.addColorStop(0.35, 'rgba(0, 255, 204, 0.08)');
        horizonGrad.addColorStop(1, 'rgba(0, 255, 204, 0)');
        ctx.fillStyle = horizonGrad;
        ctx.fillRect(0, horizonY - 45, width, 115);

        // ── 2. Perspective Floor Grid ─────────────────────────────────────────
        var floorHeight = height - horizonY;
        if (floorHeight > 10) {
            var numH = 14;
            if (!prefersReducedMotion) {
                gridOffset = (gridOffset + 0.0035) % 1;
            }

            // Horizontal lines with perspective depth
            for (var i = 0; i <= numH; i++) {
                var p = (i + gridOffset) / numH;
                if (p <= 0 || p > 1) continue;

                var y = horizonY + floorHeight * Math.pow(p, 2.4);
                var alpha = Math.pow(p, 1.3) * 0.26;

                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.strokeStyle = 'rgba(0, 255, 204, ' + alpha.toFixed(3) + ')';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Perspective radiating lines from vanishing point
            var lineSpacing = Math.max(50, Math.floor(width / (isCoarse ? 12 : 22)));
            var minX = -width * 0.4;
            var maxX = width * 1.4;

            ctx.lineWidth = 1;
            for (var bx = minX; bx <= maxX; bx += lineSpacing) {
                var distFromCenter = Math.abs(bx - (width * 0.5)) / (width * 0.5);
                var radAlpha = Math.max(0.04, 0.16 - (distFromCenter * 0.06));

                ctx.beginPath();
                ctx.moveTo(vanishingX, horizonY);
                ctx.lineTo(bx, height);
                ctx.strokeStyle = 'rgba(0, 255, 204, ' + radAlpha.toFixed(3) + ')';
                ctx.stroke();
            }
        }

        // ── 3. Particles & Sparks ─────────────────────────────────────────────
        var repulseDist = isCoarse ? 80 : 130;

        for (var pIdx = 0; pIdx < particles.length; pIdx++) {
            var p = particles[pIdx];

            if (!prefersReducedMotion) {
                p.x += p.vx;
                p.y += p.vy;

                // Mouse gentle repulsion
                if (mouseInside && mouseX > 0 && mouseY > 0) {
                    var dx = p.x - mouseX;
                    var dy = p.y - mouseY;
                    var d = Math.sqrt((dx * dx) + (dy * dy));
                    if (d > 0 && d < repulseDist) {
                        var force = (1 - (d / repulseDist)) * 2.2;
                        p.x += (dx / d) * force;
                        p.y += (dy / d) * force;
                    }
                }

                // Wrap-around screen bounds
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                p.pulse += 0.03;
            }

            var currentAlpha = p.alpha * (0.8 + 0.2 * Math.sin(p.pulse));

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 204, ' + currentAlpha.toFixed(3) + ')';
            ctx.fill();
        }

        // Lines between nearby particles
        var maxLineDist = isCoarse ? 65 : 85;
        for (var j = 0; j < particles.length; j++) {
            for (var k = j + 1; k < particles.length; k++) {
                var p1 = particles[j];
                var p2 = particles[k];
                var pdist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (pdist < maxLineDist) {
                    var lineAlpha = (1 - (pdist / maxLineDist)) * 0.16;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = 'rgba(0, 255, 204, ' + lineAlpha.toFixed(3) + ')';
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            }
        }

        // ── 4. Parallax on Menu Content and Title ──────────────────────────────
        var menuContent = document.getElementById('menu-content');
        var gameTitle = document.getElementById('game-title');

        if (!prefersReducedMotion && isMainMenuOnlyActive()) {
            var targetPX = 0;
            var targetPY = 0;
            if (mouseInside && width > 0 && height > 0) {
                targetPX = ((mouseX / width) - 0.5) * 2;
                targetPY = ((mouseY / height) - 0.5) * 2;
            }
            // Smooth lerp
            currentPX += (targetPX - currentPX) * 0.055;
            currentPY += (targetPY - currentPY) * 0.055;

            if (menuContent) {
                menuContent.style.transform = 'translate3d(' + (currentPX * 6).toFixed(2) + 'px, ' + (currentPY * 6).toFixed(2) + 'px, 0)';
            }
            if (gameTitle) {
                gameTitle.style.transform = 'translate3d(' + (currentPX * 11).toFixed(2) + 'px, ' + (currentPY * 11).toFixed(2) + 'px, 0)';
            }
        }
    }

    function canvasLoop() {
        if (!isCanvasRunning) return;
        renderCanvasFrame();
        rafId = requestAnimationFrame(canvasLoop);
    }

    function resumeCanvas() {
        if (isCanvasRunning) return;
        isCanvasRunning = true;
        if (prefersReducedMotion) {
            renderCanvasFrame(); // Render static frame once
            isCanvasRunning = false;
        } else {
            rafId = requestAnimationFrame(canvasLoop);
        }
    }

    function pauseCanvas() {
        if (!isCanvasRunning && !rafId) return;
        isCanvasRunning = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        // Smoothly reset parallax transforms
        var menuContent = document.getElementById('menu-content');
        var gameTitle = document.getElementById('game-title');
        if (menuContent) menuContent.style.transform = '';
        if (gameTitle) gameTitle.style.transform = '';
    }

    function checkCanvasState() {
        var mm = document.getElementById('main-menu');
        var isMenuVisible = mm && mm.style.display !== 'none' && !mm.classList.contains('hidden') && !document.hidden;

        if (isMenuVisible) {
            resumeCanvas();
        } else {
            pauseCanvas();
        }
    }

    document.addEventListener('visibilitychange', checkCanvasState);

    // ══════════════════════════════════════════════════════════════════════════
    // 2. TITLE GLITCH / SCRAMBLE
    // ══════════════════════════════════════════════════════════════════════════
    var scrambleRunning = false;
    var SCRAMBLE_CHARS = '0123456789!<>-_\\/[]{}—=+*^?#_ABCDEF';

    function scrambleSpanText(element, targetWord, duration, onComplete) {
        if (!element) {
            if (onComplete) onComplete();
            return;
        }

        var startTime = performance.now();
        var wordLen = targetWord.length;

        function updateText(now) {
            var elapsed = now - startTime;
            var progress = Math.min(1, elapsed / duration);
            var settledCount = Math.floor(progress * wordLen);

            var result = '';
            for (var i = 0; i < wordLen; i++) {
                if (i < settledCount) {
                    result += targetWord[i];
                } else {
                    result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                }
            }
            element.textContent = result;

            if (progress < 1) {
                requestAnimationFrame(updateText);
            } else {
                element.textContent = targetWord;
                if (onComplete) onComplete();
            }
        }
        requestAnimationFrame(updateText);
    }

    function triggerTitleGlitch() {
        var title = document.getElementById('game-title');
        if (!title || scrambleRunning) return;
        scrambleRunning = true;

        title.classList.add('glitch-active');
        var neonSpan = title.querySelector('.title-neon');
        var siegeSpan = title.querySelector('.title-siege');

        var completed = 0;
        function onPartDone() {
            completed++;
            if (completed >= 2) {
                title.classList.remove('glitch-active');
                scrambleRunning = false;
            }
        }

        scrambleSpanText(neonSpan, 'NEON', 500, onPartDone);
        scrambleSpanText(siegeSpan, 'SIEGE', 680, onPartDone);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. MENU BUTTONS (Stagger, Ripple, Cursor Glow, Blip, Side Indicator)
    // ══════════════════════════════════════════════════════════════════════════
    function setupButtons() {
        var buttons = document.querySelectorAll('.menu-btn');
        buttons.forEach(function (btn) {
            if (btn.__fxReady) return;
            btn.__fxReady = true;

            // Ensure animated side indicator exists
            if (!btn.querySelector('.menu-btn-indicator')) {
                var indicator = document.createElement('span');
                indicator.className = 'menu-btn-indicator';
                indicator.setAttribute('aria-hidden', 'true');
                btn.appendChild(indicator);
            }

            // WebAudio hover sound
            btn.addEventListener('mouseenter', function () {
                playHoverBlip();
            }, { passive: true });

            // Cursor glow following mouse inside button (CSS vars --mx, --my)
            btn.addEventListener('mousemove', function (e) {
                var rect = btn.getBoundingClientRect();
                btn.style.setProperty('--mx', (e.clientX - rect.left).toFixed(1) + 'px');
                btn.style.setProperty('--my', (e.clientY - rect.top).toFixed(1) + 'px');
            }, { passive: true });

            btn.addEventListener('mouseleave', function () {
                btn.style.removeProperty('--mx');
                btn.style.removeProperty('--my');
            }, { passive: true });

            // Ripple effect on click / tap
            btn.addEventListener('pointerdown', function (e) {
                var rect = btn.getBoundingClientRect();
                var rx = (e.clientX && e.clientX > 0) ? (e.clientX - rect.left) : (rect.width * 0.5);
                var ry = (e.clientY && e.clientY > 0) ? (e.clientY - rect.top) : (rect.height * 0.5);

                var ripple = document.createElement('span');
                ripple.className = 'menu-btn-ripple';
                ripple.style.left = rx.toFixed(1) + 'px';
                ripple.style.top = ry.toFixed(1) + 'px';
                btn.appendChild(ripple);

                setTimeout(function () {
                    if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
                }, 520);
            }, { passive: true });
        });
    }

    function triggerButtonStagger() {
        var visibleButtons = Array.from(document.querySelectorAll('#menu-buttons .menu-btn')).filter(function (b) {
            return !b.classList.contains('hidden') && b.offsetParent !== null;
        });

        visibleButtons.forEach(function (btn, idx) {
            btn.classList.remove('btn-stagger-enter');
            void btn.offsetWidth; // Force CSS reflow
            btn.style.animationDelay = (idx * 55) + 'ms';
            btn.classList.add('btn-stagger-enter');
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 4. CARDS 3D TILT & SPECULAR SHINE (.mode-card and .diff-card)
    // ══════════════════════════════════════════════════════════════════════════
    function setupCards() {
        var cards = document.querySelectorAll('.mode-card, .diff-card');
        cards.forEach(function (card) {
            // Make cards focusable for keyboard navigation
            if (!card.getAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            if (!card.getAttribute('role')) {
                card.setAttribute('role', 'button');
            }

            if (card.__fxCardReady) return;
            card.__fxCardReady = true;

            // Specular shine layer
            if (!card.querySelector('.card-specular-shine')) {
                var shine = document.createElement('div');
                shine.className = 'card-specular-shine';
                shine.setAttribute('aria-hidden', 'true');
                card.appendChild(shine);
            }

            // WebAudio hover sound
            card.addEventListener('mouseenter', function () {
                playHoverBlip();
            }, { passive: true });

            // 3D Tilt calculation
            card.addEventListener('mousemove', function (e) {
                if (!window.matchMedia('(hover: hover)').matches) return;

                var rect = card.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;

                var relX = (e.clientX - rect.left) / rect.width;
                var relY = (e.clientY - rect.top) / rect.height;

                var rotX = (0.5 - relY) * 18; // Max ~9°
                var rotY = (relX - 0.5) * 18; // Max ~9°

                card.style.transform = 'perspective(600px) rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' + rotY.toFixed(2) + 'deg) translateY(-4px) scale(1.02)';
                card.style.setProperty('--card-mx', (relX * 100).toFixed(1) + '%');
                card.style.setProperty('--card-my', (relY * 100).toFixed(1) + '%');
            }, { passive: true });

            card.addEventListener('mouseleave', function () {
                card.style.transform = '';
                card.style.removeProperty('--card-mx');
                card.style.removeProperty('--card-my');
            }, { passive: true });
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5. KEYBOARD & GAMEPAD-LIKE NAVIGATION
    // ══════════════════════════════════════════════════════════════════════════
    function clearKeyboardFocus() {
        document.querySelectorAll('.keyboard-focused').forEach(function (el) {
            el.classList.remove('keyboard-focused');
        });
    }

    window.addEventListener('keydown', function (e) {
        // Strict guard: Never interfere during active gameplay!
        if (!isMenuModeActive()) return;

        var openSubScreen = document.querySelector('.sub-screen:not(.hidden)');
        var isMainMenuOpen = isMainMenuOnlyActive();

        // ── Sub-screen navigation ─────────────────────────────────────────────
        if (openSubScreen && isShown(openSubScreen)) {
            // Escape or Backspace triggers .btn-back
            if (e.key === 'Escape' || e.key === 'Backspace') {
                var btnBack = openSubScreen.querySelector('.btn-back');
                if (btnBack) {
                    e.preventDefault();
                    e.stopPropagation();
                    playHoverBlip();
                    btnBack.click();
                    return;
                }
            }

            // Mode or Difficulty select card navigation with Arrow Left/Right and A/D
            if (openSubScreen.id === 'mode-screen' || openSubScreen.id === 'difficulty-screen') {
                var cardSelector = openSubScreen.id === 'mode-screen' ? '.mode-card' : '.diff-card';
                var cards = Array.from(openSubScreen.querySelectorAll(cardSelector));
                if (cards.length > 0) {
                    var curCardIndex = cards.findIndex(function (c) {
                        return c === document.activeElement || c.classList.contains('keyboard-focused');
                    });

                    var isNext = (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'd' || e.key === 'D' || e.key === 's' || e.key === 'S');
                    var isPrev = (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'a' || e.key === 'A' || e.key === 'w' || e.key === 'W');

                    if (isNext) {
                        e.preventDefault();
                        var nextIdx = curCardIndex < 0 ? 0 : (curCardIndex + 1) % cards.length;
                        clearKeyboardFocus();
                        cards[nextIdx].classList.add('keyboard-focused');
                        cards[nextIdx].focus();
                        playHoverBlip();
                        return;
                    } else if (isPrev) {
                        e.preventDefault();
                        var prevIdx = curCardIndex < 0 ? cards.length - 1 : (curCardIndex - 1 + cards.length) % cards.length;
                        clearKeyboardFocus();
                        cards[prevIdx].classList.add('keyboard-focused');
                        cards[prevIdx].focus();
                        playHoverBlip();
                        return;
                    } else if (e.key === 'Enter' || e.key === ' ') {
                        if (curCardIndex >= 0 && cards[curCardIndex]) {
                            e.preventDefault();
                            cards[curCardIndex].click();
                            return;
                        }
                    }
                }
            }
            return;
        }

        // ── Main menu buttons navigation ──────────────────────────────────────
        if (isMainMenuOpen) {
            var buttons = Array.from(document.querySelectorAll('#menu-buttons .menu-btn')).filter(function (b) {
                return !b.classList.contains('hidden') && b.offsetParent !== null;
            });

            if (buttons.length === 0) return;

            var curBtnIndex = buttons.findIndex(function (b) {
                return b === document.activeElement || b.classList.contains('keyboard-focused');
            });

            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                var nextBtnIdx = curBtnIndex < 0 ? 0 : (curBtnIndex + 1) % buttons.length;
                clearKeyboardFocus();
                buttons[nextBtnIdx].classList.add('keyboard-focused');
                buttons[nextBtnIdx].focus();
                playHoverBlip();
                return;
            } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                var prevBtnIdx = curBtnIndex < 0 ? buttons.length - 1 : (curBtnIndex - 1 + buttons.length) % buttons.length;
                clearKeyboardFocus();
                buttons[prevBtnIdx].classList.add('keyboard-focused');
                buttons[prevBtnIdx].focus();
                playHoverBlip();
                return;
            } else if (e.key === 'Enter') {
                if (curBtnIndex >= 0 && buttons[curBtnIndex]) {
                    e.preventDefault();
                    buttons[curBtnIndex].click();
                    return;
                }
            }
        }
    });

    window.addEventListener('mousedown', clearKeyboardFocus, { passive: true });

    // ══════════════════════════════════════════════════════════════════════════
    // 6. SCREEN TRANSITIONS (MutationObserver)
    // ══════════════════════════════════════════════════════════════════════════
    function onScreenEntered(screenEl) {
        var panel = screenEl.querySelector('.sub-panel, .win-panel');
        if (panel) {
            panel.classList.remove('menu-panel-enter');
            void panel.offsetWidth; // Trigger reflow
            panel.classList.add('menu-panel-enter');
        }

        // Stagger child elements
        var childSelectors = [
            '.mode-card',
            '.diff-card',
            '.stat-card',
            '.opt-group',
            '.ctrl-item',
            '.tips-box',
            '.win-stat',
            '.win-panel .menu-btn'
        ].join(',');

        var children = screenEl.querySelectorAll(childSelectors);
        children.forEach(function (child, i) {
            child.classList.remove('child-stagger-in');
            void child.offsetWidth;
            child.style.animationDelay = (i * 35) + 'ms';
            child.classList.add('child-stagger-in');
        });

        // Screen-specific hooks
        if (screenEl.id === 'stats-screen') {
            animateStatsNumbers();
        } else if (screenEl.id === 'options-screen') {
            updateAllRangeFills();
        } else if (screenEl.id === 'mode-screen' || screenEl.id === 'difficulty-screen') {
            setupCards();
        }
    }

    function onMainMenuEntered() {
        var content = document.getElementById('menu-content');
        if (content) {
            content.classList.remove('menu-panel-enter');
            void content.offsetWidth;
            content.classList.add('menu-panel-enter');
        }
        triggerButtonStagger();
        triggerTitleGlitch();
        resumeCanvas();
    }

    function initScreenObserver() {
        var prevStates = new WeakMap();

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                var target = m.target;
                if (!target) return;

                if (target.id === 'main-menu') {
                    var isMMVisible = target.style.display !== 'none' && !target.classList.contains('hidden');
                    var wasMMVisible = prevStates.get(target) || false;
                    if (isMMVisible !== wasMMVisible) {
                        prevStates.set(target, isMMVisible);
                        if (isMMVisible) {
                            onMainMenuEntered();
                        } else {
                            pauseCanvas();
                        }
                    }
                } else if (target.classList && target.classList.contains('sub-screen')) {
                    var isSubVisible = !target.classList.contains('hidden') && target.style.display !== 'none';
                    var wasSubVisible = prevStates.get(target) || false;
                    if (isSubVisible !== wasSubVisible) {
                        prevStates.set(target, isSubVisible);
                        if (isSubVisible) {
                            onScreenEntered(target);
                        }
                    }
                }
            });
        });

        var mainMenu = document.getElementById('main-menu');
        if (mainMenu) {
            observer.observe(mainMenu, { attributes: true, attributeFilter: ['style', 'class'] });
            prevStates.set(mainMenu, mainMenu.style.display !== 'none' && !mainMenu.classList.contains('hidden'));
        }

        var subScreens = document.querySelectorAll('.sub-screen');
        subScreens.forEach(function (sub) {
            observer.observe(sub, { attributes: true, attributeFilter: ['style', 'class'] });
            prevStates.set(sub, !sub.classList.contains('hidden') && sub.style.display !== 'none');
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 7. STATS NUMBERS COUNTER ANIMATION
    // ══════════════════════════════════════════════════════════════════════════
    function animateStatsNumbers() {
        var statsScreen = document.getElementById('stats-screen');
        if (!statsScreen) return;

        var statVals = statsScreen.querySelectorAll('.stat-val');
        statVals.forEach(function (el) {
            var rawText = (el.textContent || '').trim();

            var pctMatch = rawText.match(/^(\d+(?:\.\d+)?)%$/);
            var timeMatch = rawText.match(/^(\d+):(\d{2})$/);
            var intMatch = rawText.match(/^(\d+)$/);

            var duration = 720;
            var start = performance.now();

            if (pctMatch) {
                var targetPct = parseFloat(pctMatch[1]);
                (function (target) {
                    function step(now) {
                        var p = Math.min(1, (now - start) / duration);
                        var ease = 1 - Math.pow(1 - p, 3);
                        var v = Math.round(target * ease);
                        el.textContent = v + '%';
                        if (p < 1) requestAnimationFrame(step);
                        else el.textContent = target + '%';
                    }
                    requestAnimationFrame(step);
                })(targetPct);
            } else if (timeMatch) {
                var totalSec = (parseInt(timeMatch[1], 10) * 60) + parseInt(timeMatch[2], 10);
                (function (targetSec) {
                    function step(now) {
                        var p = Math.min(1, (now - start) / duration);
                        var ease = 1 - Math.pow(1 - p, 3);
                        var curSec = Math.round(targetSec * ease);
                        var mins = Math.floor(curSec / 60);
                        var secs = curSec % 60;
                        el.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
                        if (p < 1) requestAnimationFrame(step);
                        else {
                            var fMin = Math.floor(targetSec / 60);
                            var fSec = targetSec % 60;
                            el.textContent = fMin + ':' + (fSec < 10 ? '0' : '') + fSec;
                        }
                    }
                    requestAnimationFrame(step);
                })(totalSec);
            } else if (intMatch) {
                var targetInt = parseInt(intMatch[1], 10);
                (function (target) {
                    function step(now) {
                        var p = Math.min(1, (now - start) / duration);
                        var ease = 1 - Math.pow(1 - p, 3);
                        var v = Math.round(target * ease);
                        el.textContent = v;
                        if (p < 1) requestAnimationFrame(step);
                        else el.textContent = target;
                    }
                    requestAnimationFrame(step);
                })(targetInt);
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 8. OPTIONS: PROGRESS FILL FOR RANGE INPUTS & POP VALUE
    // ══════════════════════════════════════════════════════════════════════════
    function updateRangeFill(input) {
        if (!input) return;
        var min = parseFloat(input.min !== '' ? input.min : '0');
        var max = parseFloat(input.max !== '' ? input.max : '100');
        var val = parseFloat(input.value !== '' ? input.value : '0');
        var pct = 50;
        if (max > min) {
            pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
        }
        input.style.setProperty('--fill', pct.toFixed(1) + '%');
    }

    function updateAllRangeFills() {
        var ranges = document.querySelectorAll('#options-screen input[type="range"]');
        ranges.forEach(updateRangeFill);
    }

    function setupOptionsListeners() {
        document.addEventListener('input', function (e) {
            var target = e.target;
            if (target && target.matches && target.matches('input[type="range"]')) {
                updateRangeFill(target);

                var row = target.closest('.opt-row');
                if (row) {
                    var valEl = row.querySelector('.opt-val');
                    if (valEl) {
                        valEl.classList.remove('opt-val-pop');
                        void valEl.offsetWidth; // Force reflow
                        valEl.classList.add('opt-val-pop');
                    }
                }
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ══════════════════════════════════════════════════════════════════════════
    function init() {
        var mainMenu = document.getElementById('main-menu');
        if (!mainMenu) return;

        initCanvas();
        setupButtons();
        setupCards();
        setupOptionsListeners();
        updateAllRangeFills();
        initScreenObserver();

        // Title glitch on load & hover
        var gameTitle = document.getElementById('game-title');
        if (gameTitle) {
            gameTitle.addEventListener('mouseenter', triggerTitleGlitch, { passive: true });
        }
        setTimeout(triggerTitleGlitch, 250);

        // Initial button stagger on load
        triggerButtonStagger();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
