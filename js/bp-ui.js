/* ============================================================================
 * NEON SIEGE — PASE DE BATALLA (interfaz)
 * js/bp-ui.js
 *
 * Botón "PASE" del menú, pantalla del pase (recompensas / misiones / vestidor)
 * y el feedback en partida: popups de XP, banner de nivel, avisos de misión y
 * la barra fina de progreso.
 *
 * Depende de js/battlepass.js (window.BattlePass): sin él no hace nada.
 * Sólo crea nodos propios (#bp-*, #bp-title-tag) y clases xh-* en #crosshair.
 * ==========================================================================*/
(function () {
    'use strict';

    var BP = window.BattlePass;
    if (!BP) return;

    // ── Constantes ──────────────────────────────────────────────────────────
    var RARITY_LABEL = { comun: 'COMÚN', raro: 'RARO', epico: 'ÉPICO', legendario: 'LEGENDARIO' };
    var TYPE_LABEL   = { skin: 'Skin de arma', tracer: 'Trazadora', crosshair: 'Mira', title: 'Título' };
    var TAB_LABEL    = { rewards: 'RECOMPENSAS', missions: 'MISIONES', wardrobe: 'VESTIDOR' };
    var TABS         = ['rewards', 'missions', 'wardrobe'];
    var WARDROBE_TYPES = ['skin', 'tracer', 'crosshair', 'title'];
    var XH_STYLES    = ['cross', 'dot', 'circle', 'chevron', 'triangle', 'skull'];

    var XP_POPUP_MAX  = 4;
    var XP_MERGE_MS   = 300;
    var XP_POPUP_MS   = 1600;
    var LEVELUP_MS    = 2500;
    var TOAST_MS      = 3000;

    // ── Utilidades ──────────────────────────────────────────────────────────
    function createEl(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function createIcon(symbolId) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'ico');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + symbolId);
        svg.appendChild(use);
        return svg;
    }

    // Los colores de skin y tracer llegan como número (0xRRGGBB).
    function toHex(value, fallback) {
        if (typeof value !== 'number' || !isFinite(value)) return fallback;
        return '#' + ('000000' + (value >>> 0).toString(16)).slice(-6);
    }

    function rarityClass(reward) {
        return 'bp-r-' + (reward && reward.rarity ? reward.rarity : 'comun');
    }

    // Nivel de la pista que desbloquea una recompensa. 0 = no está en la pista
    // (las de prestigio sólo se consiguen completando su misión).
    function trackLevelOf(rewardId) {
        var tiers = BP.season.tiers;
        for (var i = 0; i < tiers.length; i++) {
            if (tiers[i].reward && tiers[i].reward.id === rewardId) return tiers[i].level;
        }
        return 0;
    }

    function percent(part, total) {
        return total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0;
    }

    function formatClock(ms) {
        var total = Math.max(0, Math.floor(ms / 1000));
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    // ── Estado local ────────────────────────────────────────────────────────
    var dom = {};
    var activeTab = 'rewards';
    var isOpen = false;
    var clockTimer = null;
    var levelQueue = [];
    var levelBusy = false;
    var lastPopup = null;   // último popup de XP vivo, para agrupar
    var lastPopupAt = 0;

    // ══════════════════════════════════════════════════════════════════════
    // ARTE DE LAS RECOMPENSAS (sin imágenes: todo CSS)
    // ══════════════════════════════════════════════════════════════════════
    function buildRewardArt(reward) {
        if (reward.type === 'skin') {
            var art = createEl('span', 'bp-art bp-art-skin');
            art.style.setProperty('--skin-body', toHex(reward.data.body, '#2a2f3a'));
            art.style.setProperty('--skin-accent', toHex(reward.data.accent, '#00ffcc'));
            return art;
        }
        if (reward.type === 'tracer') return buildTracerArt(reward);
        if (reward.type === 'crosshair') {
            return createEl('span', 'bp-art bp-art-xh xh-' + (reward.data.style || 'cross'));
        }
        return createEl('span', 'bp-art bp-art-title', reward.name);
    }

    function buildTracerArt(reward) {
        var art = createEl('span', 'bp-art bp-art-tracer');
        var line = createEl('span', 'bp-tracer-line');
        if (reward.data.color === 'rainbow') {
            line.classList.add('is-rainbow');
        } else {
            line.style.setProperty('--tracer', toHex(reward.data.color, '#00ffcc'));
        }
        art.appendChild(line);
        return art;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PESTAÑA 1 — RECOMPENSAS
    // ══════════════════════════════════════════════════════════════════════
    function renderTrack() {
        var state = BP.state();
        var previousScroll = dom.track.scrollLeft;
        dom.track.innerHTML = '';

        BP.season.tiers.forEach(function (tier) {
            var reward = tier.reward;
            if (!reward) return;

            var unlocked = BP.isUnlocked(reward.id);
            var card = createEl('button', 'bp-card ' + rarityClass(reward));
            card.type = 'button';
            card.dataset.id = reward.id;
            card.dataset.type = reward.type;
            card.dataset.level = String(tier.level);
            card.setAttribute('aria-label', 'Nivel ' + tier.level + ', ' + reward.name +
                (unlocked ? ', desbloqueado' : ', bloqueado'));
            if (!unlocked) card.dataset.locked = '1';
            if (state.equipped[reward.type] === reward.id) card.classList.add('is-equipped');

            card.appendChild(createEl('span', 'bp-card-level', 'NIVEL ' + tier.level));
            card.appendChild(buildRewardArt(reward));
            card.appendChild(createEl('span', 'bp-card-name', reward.name));
            card.appendChild(createEl('span', 'bp-card-rarity', RARITY_LABEL[reward.rarity] || ''));
            if (!unlocked) card.appendChild(createEl('span', 'bp-lock'));
            if (!state.seen[reward.id] && unlocked) card.appendChild(createEl('span', 'bp-new-tag', 'NUEVO'));

            dom.track.appendChild(card);
        });

        dom.track.scrollLeft = previousScroll; // equipar no debe saltar la pista
    }

    function centerTrack() {
        var currentLevel = BP.state().level;
        var cards = dom.track.querySelectorAll('.bp-card');
        var target = null;
        for (var i = 0; i < cards.length; i++) {
            if (Number(cards[i].dataset.level) >= currentLevel) { target = cards[i]; break; }
        }
        if (!target) return;
        dom.track.scrollLeft = Math.max(0,
            target.offsetLeft - (dom.track.clientWidth - target.offsetWidth) / 2);
    }

    // ══════════════════════════════════════════════════════════════════════
    // PESTAÑA 2 — MISIONES
    // ══════════════════════════════════════════════════════════════════════
    function buildMissionRow(mission, withReward) {
        var row = createEl('li', 'bp-mission' + (mission.done ? ' is-done' : ''));

        var top = createEl('div', 'bp-mission-top');
        top.appendChild(createEl('span', 'bp-mission-text', mission.text));
        top.appendChild(createEl('span', 'bp-mission-xp', '+' + mission.xp + ' XP'));
        row.appendChild(top);

        var bar = createEl('div', 'bp-mission-bar');
        var fill = createEl('span', 'bp-mission-fill');
        fill.style.width = percent(mission.progress, mission.goal) + '%';
        bar.appendChild(fill);
        row.appendChild(bar);

        var foot = createEl('div', 'bp-mission-foot');
        foot.appendChild(createEl('span', 'bp-mission-count', mission.progress + ' / ' + mission.goal));
        foot.appendChild(createEl('span', 'bp-mission-check', mission.done ? '✓' : ''));
        row.appendChild(foot);

        if (withReward && mission.reward) {
            var reward = createEl('span', 'bp-mission-reward ' + rarityClass(mission.reward));
            reward.appendChild(createEl('b', null, 'Recompensa: '));
            reward.appendChild(createEl('span', null, mission.reward.name));
            reward.appendChild(createEl('em', null, RARITY_LABEL[mission.reward.rarity] || ''));
            row.appendChild(reward);
        }
        return row;
    }

    function buildMissionSection(title, tag, missions, withReward) {
        var section = createEl('section', 'bp-section');
        var head = createEl('div', 'bp-section-head');
        head.appendChild(createEl('h3', 'bp-section-title', title));
        head.appendChild(tag);
        section.appendChild(head);

        var list = createEl('ul', 'bp-mission-list');
        missions.forEach(function (m) { list.appendChild(buildMissionRow(m, withReward)); });
        section.appendChild(list);
        return section;
    }

    function renderMissions() {
        var data = BP.missions();
        dom.missions.innerHTML = '';
        dom.countdown = createEl('span', 'bp-section-tag bp-countdown', 'Reinician en --:--:--');
        dom.missions.appendChild(buildMissionSection('DIARIAS', dom.countdown, data.daily, false));
        dom.missions.appendChild(buildMissionSection('SEMANALES',
            createEl('span', 'bp-section-tag', 'Se renuevan cada lunes'), data.weekly, false));
        dom.missions.appendChild(buildMissionSection('PRESTIGIO',
            createEl('span', 'bp-section-tag', 'Hitos de toda la temporada'), data.prestige, true));
        tickCountdown();
    }

    function msToMidnight() {
        var now = new Date();
        var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return midnight.getTime() - now.getTime();
    }

    function tickCountdown() {
        if (dom.countdown) dom.countdown.textContent = 'Reinician en ' + formatClock(msToMidnight());
    }

    // ══════════════════════════════════════════════════════════════════════
    // PESTAÑA 3 — VESTIDOR
    // ══════════════════════════════════════════════════════════════════════
    function renderWardrobe() {
        var equipped = BP.state().equipped;
        dom.wardrobe.innerHTML = '';

        WARDROBE_TYPES.forEach(function (type) {
            var section = createEl('section', 'bp-section');
            var head = createEl('div', 'bp-section-head');
            head.appendChild(createEl('h3', 'bp-section-title', TYPE_LABEL[type].toUpperCase()));
            section.appendChild(head);

            var grid = createEl('div', 'bp-ward-grid');
            BP.rewardsOf(type).forEach(function (reward) {
                grid.appendChild(buildWardItem(reward, equipped[type] === reward.id));
            });
            section.appendChild(grid);
            dom.wardrobe.appendChild(section);
        });
    }

    function buildWardItem(reward, isEquipped) {
        var unlocked = BP.isUnlocked(reward.id);
        var item = createEl('button', 'bp-ward ' + rarityClass(reward));
        item.type = 'button';
        item.dataset.id = reward.id;
        item.dataset.type = reward.type;
        item.setAttribute('aria-label', TYPE_LABEL[reward.type] + ': ' + reward.name +
            (unlocked ? (isEquipped ? ', equipada' : ', disponible') : ', bloqueada'));
        if (!unlocked) {
            item.dataset.locked = '1';
            item.setAttribute('aria-disabled', 'true');
        }
        if (isEquipped) {
            item.classList.add('is-equipped');
            item.setAttribute('aria-pressed', 'true');
        }

        item.appendChild(buildRewardArt(reward));
        item.appendChild(createEl('span', 'bp-ward-name', reward.name));
        item.appendChild(createEl('span', 'bp-ward-rarity', RARITY_LABEL[reward.rarity] || ''));
        if (!unlocked) {
            var level = trackLevelOf(reward.id);
            item.appendChild(createEl('span', 'bp-lock'));
            item.appendChild(createEl('span', 'bp-ward-lock', level ? 'Nivel ' + level : 'Prestigio'));
        } else if (isEquipped) {
            item.appendChild(createEl('span', 'bp-ward-on', 'EQUIPADA'));
        }
        return item;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PROGRESO (botón del menú, cabecera y barra de partida)
    // ══════════════════════════════════════════════════════════════════════
    function syncProgress() {
        var state = BP.state();
        var done = percent(state.xpInLevel, state.xpPerLevel) + '%';

        dom.btnFill.style.width = done;
        dom.barFill.style.width = done;
        if (dom.xpFill) dom.xpFill.style.width = done;
        dom.level.textContent = 'Nivel ' + state.level + ' / ' + state.maxLevel;
        dom.xpText.textContent = state.xpInLevel + ' / ' + state.xpPerLevel + ' XP';

        var unseen = BP.unseenCount();
        dom.badge.hidden = unseen === 0;
        if (unseen > 0) dom.badge.textContent = unseen > 99 ? '99+' : String(unseen);
    }

    function renderAll() {
        syncProgress();
        applyTitleTag();
        if (!isOpen) return;
        renderTrack();
        renderMissions();
        renderWardrobe();
    }

    // ══════════════════════════════════════════════════════════════════════
    // PANTALLA
    // ══════════════════════════════════════════════════════════════════════
    function setTab(name) {
        if (TABS.indexOf(name) === -1) return;
        activeTab = name;
        dom.tabButtons.forEach(function (btn) {
            var isCurrent = btn.dataset.tab === name;
            btn.classList.toggle('is-active', isCurrent);
            btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
        });
        TABS.forEach(function (tab) {
            dom.panes[tab].classList.toggle('hidden', tab !== name);
        });
        if (name === 'rewards') centerTrack();
    }

    function openScreen() {
        if (window.playMenuClick) window.playMenuClick();
        if (window.hideAllSubScreens) window.hideAllSubScreens();
        isOpen = true;
        dom.screen.classList.remove('hidden');
        renderAll();
        setTab(activeTab);
        if (!clockTimer) clockTimer = setInterval(tickCountdown, 1000);
    }

    function closeScreen() {
        isOpen = false;
        dom.screen.classList.add('hidden');
        if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
        if (window.showMainMenu) window.showMainMenu();
    }

    // ══════════════════════════════════════════════════════════════════════
    // FEEDBACK EN PARTIDA
    // ══════════════════════════════════════════════════════════════════════
    function isInGame() {
        var menu = document.getElementById('main-menu');
        if (!menu) return true;
        return getComputedStyle(menu).display === 'none' || menu.classList.contains('hidden');
    }

    function syncInGameVisibility() {
        dom.fx.classList.toggle('is-on', isInGame());
    }

    // Llamado en cada popup: si el observer aún no ha reaccionado a un cambio
    // de menú, la capa se sincroniza aquí en lugar de esperar al siguiente evento.
    function showInGame() {
        if (!isInGame()) return false;
        syncInGameVisibility();
        return true;
    }

    function restartAnimation(node, className) {
        node.classList.remove(className);
        void node.offsetWidth; // reflow: obliga al navegador a reiniciar la animación
        node.classList.add(className);
    }

    function scheduleRemoval(node, ms) {
        setTimeout(function () {
            if (node.parentNode) node.parentNode.removeChild(node);
        }, ms);
    }

    // "+40 XP Headshot" en el lateral derecho; los pops seguidos se suman.
    // BattlePass emite 'xp' con { amount, reason, total }.
    function pushXp(data) {
        if (!data || !(data.amount > 0) || !showInGame()) return;
        var amount = Math.round(data.amount);
        var reason = data.reason || '';
        var now = performance.now();
        var canMerge = lastPopup && lastPopup.parentNode && now - lastPopupAt < XP_MERGE_MS;

        if (canMerge) {
            lastPopup.bpTotal += amount;
            lastPopup.textContent = '+' + lastPopup.bpTotal + ' XP' +
                (lastPopup.bpReason ? ' ' + lastPopup.bpReason : '');
            restartAnimation(lastPopup, 'bp-pop');
        } else {
            var pop = createEl('div', 'bp-pop bp-xp-popup',
                '+' + amount + ' XP' + (reason ? ' ' + reason : ''));
            pop.bpTotal = amount;
            pop.bpReason = reason;
            dom.feed.appendChild(pop);
            while (dom.feed.children.length > XP_POPUP_MAX) dom.feed.removeChild(dom.feed.firstChild);
            scheduleRemoval(pop, XP_POPUP_MS);
            lastPopup = pop;
        }
        lastPopupAt = now;
    }

    // Banner central de nivel. SiLevela más de uno, se apilan en cola.
    function pushLevelUp(data) {
        if (!showInGame()) return;
        levelQueue.push(data);
        if (!levelBusy) showNextLevelUp();
    }

    function showNextLevelUp() {
        var data = levelQueue.shift();
        if (!data) { levelBusy = false; return; }
        levelBusy = true;

        dom.banner.innerHTML = '';
        dom.banner.appendChild(createEl('div', 'bp-banner-title',
            data.level ? '¡NIVEL ' + data.level + '!' : '¡DESBLOQUEADO!'));
        if (data.reward) {
            var card = createEl('div', 'bp-banner-card ' + rarityClass(data.reward));
            card.appendChild(buildRewardArt(data.reward));
            card.appendChild(createEl('span', 'bp-banner-name', data.reward.name));
            card.appendChild(createEl('span', 'bp-banner-rarity', RARITY_LABEL[data.reward.rarity] || ''));
            dom.banner.appendChild(card);
        }
        restartAnimation(dom.banner, 'bp-banner-in');
        playLevelUpSound();

        setTimeout(function () {
            dom.banner.innerHTML = '';   // sin resplandor residual en pantalla
            showNextLevelUp();
        }, LEVELUP_MS);
    }

    function playLevelUpSound() {
        if (typeof window.tone !== 'function') return;
        [523, 659, 784, 1046].forEach(function (freq, i) {
            setTimeout(function () { window.tone('sine', freq, freq * 1.4, 0.22, 0.14); }, i * 90);
        });
    }

    function pushMission(data) {
        if (!data.mission || !showInGame()) return;
        var toast = createEl('div', 'bp-pop bp-toast');
        toast.appendChild(createEl('span', 'bp-toast-head', 'MISIÓN COMPLETADA'));
        toast.appendChild(createEl('span', 'bp-toast-body', data.mission.text));
        toast.appendChild(createEl('span', 'bp-toast-xp', '+' + data.mission.xp + ' XP'));
        dom.toasts.appendChild(toast);
        while (dom.toasts.children.length > 3) dom.toasts.removeChild(dom.toasts.firstChild);
        scheduleRemoval(toast, TOAST_MS);
    }

    // ══════════════════════════════════════════════════════════════════════
    // COSMÉTICOS
    // ══════════════════════════════════════════════════════════════════════
    function applyCrosshair() {
        var crosshair = document.getElementById('crosshair');
        if (!crosshair) return;
        var reward = BP.equipped('crosshair');
        var style = reward && reward.data ? reward.data.style : 'cross';
        if (XH_STYLES.indexOf(style) === -1) style = 'cross';
        XH_STYLES.forEach(function (name) { crosshair.classList.remove('xh-' + name); });
        crosshair.classList.add('xh-' + style);
    }

    function applyTitleTag() {
        if (!dom.titleTag) return;
        var reward = BP.equipped('title');
        dom.titleTag.textContent = reward ? reward.name : '';
    }

    function applyCosmetics() {
        applyCrosshair();
        applyTitleTag();
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONSTRUCCIÓN DEL DOM
    // ══════════════════════════════════════════════════════════════════════
    function buildMenuButton() {
        var btn = createEl('button', 'menu-btn');
        btn.id = 'btn-battlepass';
        btn.type = 'button';
        btn.appendChild(createIcon('i-star'));

        var body = createEl('span', 'bp-btn-body');
        body.appendChild(createEl('span', 'bp-btn-label', 'PASE'));
        var track = createEl('span', 'bp-btn-track');
        dom.btnFill = createEl('span', 'bp-btn-fill');
        track.appendChild(dom.btnFill);
        body.appendChild(track);
        btn.appendChild(body);

        dom.badge = createEl('span', 'bp-badge');
        dom.badge.hidden = true;
        btn.appendChild(dom.badge);

        btn.addEventListener('click', openScreen);
        return btn;
    }

    function buildTabButton(name) {
        var btn = createEl('button', 'bp-tab', TAB_LABEL[name]);
        btn.type = 'button';
        btn.dataset.tab = name;
        btn.setAttribute('role', 'tab');
        btn.addEventListener('click', function () { setTab(name); });
        return btn;
    }

    function buildHead() {
        var head = createEl('div', 'bp-head');
        head.appendChild(createEl('div', 'bp-season', 'TEMPORADA 1 · ' + BP.season.name));

        var row = createEl('div', 'bp-head-row');
        dom.level = createEl('span', 'bp-level', 'Nivel 0 / 0');
        row.appendChild(dom.level);
        row.appendChild(createEl('span', 'bp-free', 'Gratis · no caduca'));
        head.appendChild(row);

        var bar = createEl('div', 'bp-xp-bar');
        dom.xpFill = createEl('span', 'bp-xp-fill');
        bar.appendChild(dom.xpFill);
        head.appendChild(bar);

        dom.xpText = createEl('div', 'bp-xp-text', '0 / 0 XP');
        head.appendChild(dom.xpText);
        return head;
    }

    function buildPanes() {
        dom.panes = {
            rewards: createEl('div', 'bp-track'),
            missions: createEl('div', 'bp-missions'),
            wardrobe: createEl('div', 'bp-wardrobe')
        };
        dom.track = dom.panes.rewards;
        dom.missions = dom.panes.missions;
        dom.wardrobe = dom.panes.wardrobe;
        TABS.forEach(function (name) { dom.panes[name].classList.add('hidden'); });

        dom.track.addEventListener('wheel', function (ev) {
            if (dom.track.scrollWidth <= dom.track.clientWidth) return;
            ev.preventDefault();
            dom.track.scrollLeft += ev.deltaY || ev.deltaX;
        }, { passive: false });

        dom.track.addEventListener('click', function (ev) {
            var card = ev.target.closest('.bp-card');
            if (card && !card.dataset.locked) equipReward(card.dataset.type, card.dataset.id);
        });

        dom.wardrobe.addEventListener('click', function (ev) {
            var item = ev.target.closest('.bp-ward');
            if (item && !item.dataset.locked) equipReward(item.dataset.type, item.dataset.id);
        });
    }

    function buildScreen() {
        var screen = createEl('div', 'sub-screen hidden');
        screen.id = 'bp-screen';

        var panel = createEl('div', 'sub-panel bp-panel');
        panel.appendChild(createEl('h2', null, 'Pase de Batalla'));
        panel.appendChild(buildHead());

        var tabs = createEl('div', 'bp-tabs');
        tabs.setAttribute('role', 'tablist');
        dom.tabButtons = TABS.map(buildTabButton);
        dom.tabButtons.forEach(function (btn) { tabs.appendChild(btn); });
        panel.appendChild(tabs);

        buildPanes();
        TABS.forEach(function (name) {
            dom.panes[name].setAttribute('role', 'tabpanel');
            panel.appendChild(dom.panes[name]);
        });

        var back = createEl('button', 'btn-back', '◀ Volver');
        back.type = 'button';
        back.addEventListener('click', closeScreen);
        panel.appendChild(back);

        screen.appendChild(panel);
        screen.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Escape') return;
            ev.preventDefault();
            closeScreen();
        });
        return screen;
    }

    function buildFxLayer() {
        var fx = createEl('div', 'bp-fx');
        fx.id = 'bp-fx';
        fx.setAttribute('aria-hidden', 'true');

        var bar = createEl('div', 'bp-game-bar');
        dom.barFill = createEl('span', 'bp-game-bar-fill');
        bar.appendChild(dom.barFill);

        dom.toasts = createEl('div', 'bp-toasts');
        dom.feed = createEl('div', 'bp-xp-feed');
        dom.banner = createEl('div', 'bp-banner');

        fx.appendChild(dom.barFill.parentNode);
        fx.appendChild(dom.toasts);
        fx.appendChild(dom.feed);
        fx.appendChild(dom.banner);
        return fx;
    }

    function buildTitleTag() {
        var subtitle = document.getElementById('menu-subtitle');
        if (!subtitle) return null;
        var tag = createEl('div', 'bp-title-tag');
        tag.id = 'bp-title-tag';
        subtitle.classList.add('bp-has-title');
        subtitle.insertAdjacentElement('afterend', tag);
        return tag;
    }

    function equipReward(type, id) {
        if (!type || !id) return;
        BP.markSeen(id);
        BP.equip(type, id);
    }

    // ══════════════════════════════════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════════════════════════════════
    function init() {
        var menuButtons = document.getElementById('menu-buttons');
        if (!menuButtons) return;

        dom.titleTag = buildTitleTag();
        menuButtons.insertBefore(buildMenuButton(), document.getElementById('btn-tutorial'));

        dom.screen = buildScreen();
        dom.fx = buildFxLayer();
        document.body.appendChild(dom.screen);
        document.body.appendChild(dom.fx);

        new MutationObserver(syncInGameVisibility).observe(
            document.getElementById('main-menu'),
            { attributes: true, attributeFilter: ['style', 'class'] }
        );

        BP.on('change', renderAll);
        BP.on('xp', pushXp);
        BP.on('levelup', pushLevelUp);
        BP.on('mission', pushMission);
        BP.on('equip', applyCosmetics);

        applyCosmetics();
        syncInGameVisibility();
        renderAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
