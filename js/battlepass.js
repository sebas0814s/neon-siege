/* Pase de batalla — Temporada 1 "NEÓN CERO".
 * Gratis, sin caducidad y sin azar: cada recompensa se ve antes de
 * desbloquearla. El progreso vive en localStorage.
 *
 * API (window.BattlePass):
 *   season                      datos de la temporada (tiers, recompensas)
 *   state()                     { level, xp, xpInLevel, xpPerLevel, maxLevel, unlocked{}, equipped{}, seen{} }
 *   track(event, data)          eventos del juego → XP + progreso de misiones
 *   addXP(amount, reason)
 *   missions()                  { daily:[], weekly:[], prestige:[] } con progress/goal/done
 *   reward(id) / rewardsOf(type)
 *   isUnlocked(id), equip(slot, id), equipped(slot) → reward|null
 *   markSeen(id), unseenCount()
 *   on(evt, fn)                 'xp' | 'levelup' | 'mission' | 'equip' | 'change'
 *   reset()                     solo para pruebas
 */
(function (root) {
    'use strict';

    var STORE_KEY = 'neon_bp_s1';
    var XP_PER_LEVEL = 1000;

    // ── Recompensas ─────────────────────────────────────────────────────────
    // type: skin | tracer | crosshair | title
    // skin.data:      { body, accent, emissive, anim? ('pulse'|'rainbow'|'gold') }
    // tracer.data:    { color }
    // crosshair.data: { style: 'cross'|'dot'|'circle'|'chevron'|'triangle' }
    // rarity: comun | raro | epico | legendario
    var REWARDS = [
        { id: 'skin_default',   type: 'skin',      name: 'Estándar',        rarity: 'comun',      data: { body: 0x1f2329, accent: 0x00eeff, emissive: 0x0099bb } },
        { id: 'tracer_default', type: 'tracer',    name: 'Latón',           rarity: 'comun',      data: { color: null } },
        { id: 'xh_default',     type: 'crosshair', name: 'Cruz',            rarity: 'comun',      data: { style: 'cross' } },
        { id: 'title_default',  type: 'title',     name: 'Recluta',         rarity: 'comun',      data: {} },

        { id: 'title_novato',   type: 'title',     name: 'Superviviente',   rarity: 'comun',      data: {} },
        { id: 'skin_carbon',    type: 'skin',      name: 'Carbono',         rarity: 'comun',      data: { body: 0x0b0c0f, accent: 0x5a6270, emissive: 0x000000 } },
        { id: 'tracer_cian',    type: 'tracer',    name: 'Cian',            rarity: 'comun',      data: { color: 0x00ffee } },
        { id: 'xh_dot',         type: 'crosshair', name: 'Punto',           rarity: 'comun',      data: { style: 'dot' } },
        { id: 'skin_arena',     type: 'skin',      name: 'Desierto',        rarity: 'comun',      data: { body: 0x8a7350, accent: 0x3b3326, emissive: 0x000000 } },
        { id: 'skin_bosque',    type: 'skin',      name: 'Bosque',          rarity: 'raro',       data: { body: 0x2f4a2a, accent: 0x9bd46a, emissive: 0x1a3310 } },
        { id: 'title_tirador',  type: 'title',     name: 'Tirador',         rarity: 'raro',       data: {} },
        { id: 'tracer_rojo',    type: 'tracer',    name: 'Carmesí',         rarity: 'raro',       data: { color: 0xff2244 } },
        { id: 'skin_hielo',     type: 'skin',      name: 'Hielo',           rarity: 'raro',       data: { body: 0xcfe8ff, accent: 0x55bbff, emissive: 0x2266aa } },
        { id: 'xh_circle',      type: 'crosshair', name: 'Anillo',          rarity: 'raro',       data: { style: 'circle' } },
        { id: 'skin_magma',     type: 'skin',      name: 'Magma',           rarity: 'raro',       data: { body: 0x2a0d05, accent: 0xff5a1f, emissive: 0xaa2200, anim: 'pulse' } },
        { id: 'title_cazador',  type: 'title',     name: 'Cazador',         rarity: 'raro',       data: {} },
        { id: 'tracer_verde',   type: 'tracer',    name: 'Tóxico',          rarity: 'raro',       data: { color: 0x66ff33 } },
        { id: 'skin_sakura',    type: 'skin',      name: 'Sakura',          rarity: 'epico',      data: { body: 0xf2b5c8, accent: 0xff4f9a, emissive: 0x88204a } },
        { id: 'xh_chevron',     type: 'crosshair', name: 'Chevrón',         rarity: 'epico',      data: { style: 'chevron' } },
        { id: 'skin_vacio',     type: 'skin',      name: 'Vacío',           rarity: 'epico',      data: { body: 0x12051f, accent: 0xb44cff, emissive: 0x6a1fb0, anim: 'pulse' } },
        { id: 'title_verdugo',  type: 'title',     name: 'Verdugo',         rarity: 'epico',      data: {} },
        { id: 'tracer_violeta', type: 'tracer',    name: 'Plasma',          rarity: 'epico',      data: { color: 0xc04cff } },
        { id: 'skin_sintetico', type: 'skin',      name: 'Synthwave',       rarity: 'epico',      data: { body: 0x1a0b2e, accent: 0xff2fd0, emissive: 0x00e5ff, anim: 'pulse' } },
        { id: 'xh_triangle',    type: 'crosshair', name: 'Delta',           rarity: 'epico',      data: { style: 'triangle' } },
        { id: 'title_leyenda',  type: 'title',     name: 'Leyenda de Neón', rarity: 'epico',      data: {} },
        { id: 'tracer_oro',     type: 'tracer',    name: 'Oro',             rarity: 'legendario', data: { color: 0xffd23f } },
        { id: 'skin_prisma',    type: 'skin',      name: 'Prisma',          rarity: 'legendario', data: { body: 0x202020, accent: 0xffffff, emissive: 0xff00ff, anim: 'rainbow' } },
        { id: 'title_asedio',   type: 'title',     name: 'Rompe-Asedios',   rarity: 'legendario', data: {} },
        { id: 'skin_oro',       type: 'skin',      name: 'Oro Puro',        rarity: 'legendario', data: { body: 0xffc93c, accent: 0xfff2a8, emissive: 0x6b4a00, anim: 'gold' } },
        { id: 'tracer_arcoiris',type: 'tracer',    name: 'Arcoíris',        rarity: 'legendario', data: { color: 'rainbow' } },
        // Recompensas de misiones de prestigio (no están en la pista)
        { id: 'skin_coloso',    type: 'skin',      name: 'Coloso',          rarity: 'legendario', data: { body: 0x3a2a00, accent: 0xffcc00, emissive: 0xaa7700, anim: 'pulse' } },
        { id: 'title_dorado',   type: 'title',     name: 'Pistolero Dorado',rarity: 'legendario', data: {} },
        { id: 'xh_skull',       type: 'crosshair', name: 'Calavera',        rarity: 'legendario', data: { style: 'skull' } },
    ];
    var DEFAULTS = { skin: 'skin_default', tracer: 'tracer_default', crosshair: 'xh_default', title: 'title_default' };

    // Nivel N → recompensa (nivel 1 = primer desbloqueo tras 1000 XP)
    var TRACK = [
        'title_novato', 'skin_carbon', 'tracer_cian', 'xh_dot', 'skin_arena',
        'skin_bosque', 'title_tirador', 'tracer_rojo', 'skin_hielo', 'xh_circle',
        'skin_magma', 'title_cazador', 'tracer_verde', 'skin_sakura', 'xh_chevron',
        'skin_vacio', 'title_verdugo', 'tracer_violeta', 'skin_sintetico', 'xh_triangle',
        'title_leyenda', 'tracer_oro', 'skin_prisma', 'title_asedio', 'skin_oro',
        'tracer_arcoiris',
    ];
    var MAX_LEVEL = TRACK.length;

    var byId = {};
    REWARDS.forEach(function (r) { byId[r.id] = r; });

    // ── XP por evento ───────────────────────────────────────────────────────
    var XP = {
        kill: 40, headshot: 25, boss: 400, wave: 60 /* × nº de oleada, tope 600 */,
        streak10: 150, ggLevel: 60, ggWin: 1200, match: 100,
    };

    // ── Misiones ────────────────────────────────────────────────────────────
    // kind: contador que avanza con track(). filter opcional.
    var DAILY_POOL = [
        { key: 'd_kills',     text: 'Consigue 40 bajas',                  kind: 'kills',     goal: 40, xp: 900 },
        { key: 'd_heads',     text: 'Haz 12 headshots',                   kind: 'headshots', goal: 12, xp: 1000 },
        { key: 'd_shotgun',   text: '15 bajas con escopeta',              kind: 'kills', filter: 'shotgun', goal: 15, xp: 1000 },
        { key: 'd_rifle',     text: '20 bajas con rifle',                 kind: 'kills', filter: 'rifle',   goal: 20, xp: 1000 },
        { key: 'd_wave5',     text: 'Llega a la oleada 5',                kind: 'wave',      goal: 5,  xp: 1100 },
        { key: 'd_streak',    text: 'Racha de 8 impactos seguidos',       kind: 'streak',    goal: 8,  xp: 800 },
        { key: 'd_gg',        text: 'Llega al arma 5 en Gun Game',        kind: 'ggLevel',   goal: 5,  xp: 1000 },
        { key: 'd_matches',   text: 'Juega 3 partidas',                   kind: 'matches',   goal: 3,  xp: 700 },
        { key: 'd_chacal',    text: 'Elimina 10 Chacales',                kind: 'kills', filter: 'e:chacal', goal: 10, xp: 900 },
    ];
    var WEEKLY_POOL = [
        { key: 'w_kills',     text: 'Consigue 300 bajas',                 kind: 'kills',     goal: 300, xp: 4000 },
        { key: 'w_heads',     text: 'Haz 80 headshots',                   kind: 'headshots', goal: 80,  xp: 4000 },
        { key: 'w_wave10',    text: 'Llega a la oleada 10',               kind: 'wave',      goal: 10,  xp: 4500 },
        { key: 'w_boss',      text: 'Derrota 2 Colosos',                  kind: 'boss',      goal: 2,   xp: 5000 },
        { key: 'w_ggwin',     text: 'Gana 1 partida de Gun Game',         kind: 'ggWin',     goal: 1,   xp: 5000 },
        { key: 'w_sniper',    text: '40 bajas con francotirador',         kind: 'kills', filter: 'sniper', goal: 40, xp: 4000 },
        { key: 'w_mastodonte',text: 'Elimina 25 Mastodontes',             kind: 'kills', filter: 'e:mastodonte', goal: 25, xp: 4000 },
    ];
    // Hitos a largo plazo: dan recompensas exclusivas, no XP extra grande
    var PRESTIGE = [
        { key: 'p_kills',  text: '2.000 bajas en total',           kind: 'kills',     goal: 2000, xp: 3000, reward: 'skin_coloso' },
        { key: 'p_ggwin',  text: 'Gana 5 partidas de Gun Game',     kind: 'ggWin',     goal: 5,    xp: 3000, reward: 'title_dorado' },
        { key: 'p_heads',  text: '500 headshots en total',          kind: 'headshots', goal: 500,  xp: 3000, reward: 'xh_skull' },
    ];

    // ── Persistencia ────────────────────────────────────────────────────────
    function blank() {
        var unlocked = {};
        Object.keys(DEFAULTS).forEach(function (k) { unlocked[DEFAULTS[k]] = true; });
        return {
            v: 1, xp: 0, unlocked: unlocked, seen: {}, equipped: Object.assign({}, DEFAULTS),
            daily: { day: '', list: [] }, weekly: { week: '', list: [] }, prestige: {},
        };
    }
    var S = load();

    function load() {
        try {
            var raw = localStorage.getItem(STORE_KEY);
            if (raw) {
                var s = Object.assign(blank(), JSON.parse(raw));
                s.equipped = Object.assign({}, DEFAULTS, s.equipped);
                return s;
            }
        } catch (e) { /* almacenamiento bloqueado: se juega sin guardar */ }
        return blank();
    }
    var saveTimer = null;
    function save() {
        if (saveTimer) return;
        saveTimer = setTimeout(function () {
            saveTimer = null;
            try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* sin espacio o bloqueado */ }
        }, 300);
    }

    // ── Eventos ─────────────────────────────────────────────────────────────
    var listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
    function emit(evt, data) {
        (listeners[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
        if (evt !== 'change') emit('change', { evt: evt, data: data });
    }

    // ── Niveles ─────────────────────────────────────────────────────────────
    function levelOf(xp) { return Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL)); }

    function addXP(amount, reason) {
        amount = Math.round(amount);
        if (!(amount > 0)) return;
        var before = levelOf(S.xp);
        S.xp += amount;
        var after = levelOf(S.xp);
        emit('xp', { amount: amount, reason: reason || '', total: S.xp });
        for (var lv = before + 1; lv <= after; lv++) {
            var rid = TRACK[lv - 1];
            if (rid) S.unlocked[rid] = true;
            emit('levelup', { level: lv, reward: byId[rid] || null });
        }
        save();
    }

    // ── Misiones: rotación diaria/semanal determinista por fecha ────────────
    function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function weekKey(d) {
        d = d || new Date();
        var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        var dayNum = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - dayNum);
        var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 86400000 + 1) / 7);
    }
    function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function pick(pool, n, seed) {
        var idx = pool.map(function (_, i) { return i; });
        var h = hash(seed);
        for (var i = idx.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0; var j = h % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
        return idx.slice(0, n).map(function (i) { return { key: pool[i].key, progress: 0, done: false }; });
    }
    function refreshRotations() {
        var d = dayKey(), w = weekKey();
        if (S.daily.day !== d)  { S.daily  = { day: d,  list: pick(DAILY_POOL, 3, 'd' + d) }; save(); }
        if (S.weekly.week !== w){ S.weekly = { week: w, list: pick(WEEKLY_POOL, 3, 'w' + w) }; save(); }
    }
    function def(pool, key) { for (var i = 0; i < pool.length; i++) if (pool[i].key === key) return pool[i]; return null; }

    // Aplica un avance a una misión; 'max' para metas de "llegar a" (oleada, racha)
    function advance(entry, d, amount, isMax) {
        if (entry.done || !d) return;
        entry.progress = isMax ? Math.max(entry.progress, amount) : entry.progress + amount;
        if (entry.progress >= d.goal) {
            entry.progress = d.goal; entry.done = true;
            emit('mission', { mission: d });
            addXP(d.xp, 'Misión: ' + d.text);
            if (d.reward) { S.unlocked[d.reward] = true; emit('levelup', { level: null, reward: byId[d.reward] }); }
        }
    }

    function matches(d, ev) {
        if (!d.filter) return true;
        if (d.filter.indexOf('e:') === 0) return ev.enemy === d.filter.slice(2);
        return ev.weapon && ev.weapon.replace(/^gg_/, '') === d.filter;
    }

    function progressMissions(kind, amount, isMax, ev) {
        refreshRotations();
        ev = ev || {};
        S.daily.list.forEach(function (m) { var d = def(DAILY_POOL, m.key); if (d && d.kind === kind && matches(d, ev)) advance(m, d, amount, isMax); });
        S.weekly.list.forEach(function (m) { var d = def(WEEKLY_POOL, m.key); if (d && d.kind === kind && matches(d, ev)) advance(m, d, amount, isMax); });
        PRESTIGE.forEach(function (d) {
            if (d.kind !== kind || !matches(d, ev)) return;
            var m = S.prestige[d.key] = S.prestige[d.key] || { key: d.key, progress: 0, done: false };
            advance(m, d, amount, isMax);
        });
    }

    // ── Entrada del juego ───────────────────────────────────────────────────
    // kill     { weapon, headshot, enemy, boss, mode }
    // wave     { wave }            oleada completada
    // streak   { n }               racha actual de impactos
    // ggLevel  { level }           nivel de arma alcanzado (1..10)
    // ggWin    {}
    // matchEnd { mode, kills, wave }
    function track(event, ev) {
        ev = ev || {};
        switch (event) {
            case 'kill':
                addXP(XP.kill + (ev.headshot ? XP.headshot : 0) + (ev.boss ? XP.boss : 0), ev.headshot ? 'Headshot' : 'Baja');
                progressMissions('kills', 1, false, ev);
                if (ev.headshot) progressMissions('headshots', 1, false, ev);
                if (ev.boss) progressMissions('boss', 1, false, ev);
                break;
            case 'wave':
                addXP(Math.min(600, XP.wave * ev.wave), 'Oleada ' + ev.wave);
                progressMissions('wave', ev.wave + 1, true);
                break;
            case 'streak':
                if (ev.n > 0 && ev.n % 10 === 0) addXP(XP.streak10, 'Racha x' + ev.n);
                progressMissions('streak', ev.n, true);
                break;
            case 'ggLevel':
                addXP(XP.ggLevel, 'Arma ' + ev.level);
                progressMissions('ggLevel', ev.level, true);
                break;
            case 'ggWin':
                addXP(XP.ggWin, 'Victoria Gun Game');
                progressMissions('ggWin', 1, false);
                break;
            case 'matchEnd':
                addXP(XP.match, 'Partida');
                progressMissions('matches', 1, false);
                break;
        }
        save();
    }

    function missionView(entry, pool) {
        var d = def(pool, entry.key);
        return d ? { key: d.key, text: d.text, goal: d.goal, xp: d.xp, reward: d.reward ? byId[d.reward] : null, progress: entry.progress, done: entry.done } : null;
    }
    function missions() {
        refreshRotations();
        return {
            daily:    S.daily.list.map(function (m) { return missionView(m, DAILY_POOL); }).filter(Boolean),
            weekly:   S.weekly.list.map(function (m) { return missionView(m, WEEKLY_POOL); }).filter(Boolean),
            prestige: PRESTIGE.map(function (d) { return missionView(S.prestige[d.key] || { key: d.key, progress: 0, done: false }, PRESTIGE); }),
        };
    }

    // ── Cosméticos ──────────────────────────────────────────────────────────
    function isUnlocked(id) { return !!S.unlocked[id]; }
    function equip(slot, id) {
        var r = byId[id];
        if (!r || r.type !== slot || !isUnlocked(id)) return false;
        S.equipped[slot] = id; save();
        emit('equip', { slot: slot, reward: r });
        return true;
    }
    function equipped(slot) { return byId[S.equipped[slot]] || byId[DEFAULTS[slot]] || null; }
    function markSeen(id) { if (!S.seen[id]) { S.seen[id] = true; save(); emit('change', {}); } }
    function unseenCount() {
        var n = 0;
        Object.keys(S.unlocked).forEach(function (id) { if (!S.seen[id] && !/_default$/.test(id)) n++; });
        return n;
    }

    function state() {
        var level = levelOf(S.xp);
        return {
            level: level, maxLevel: MAX_LEVEL, xp: S.xp,
            xpInLevel: level >= MAX_LEVEL ? XP_PER_LEVEL : S.xp - level * XP_PER_LEVEL,
            xpPerLevel: XP_PER_LEVEL,
            unlocked: Object.assign({}, S.unlocked), equipped: Object.assign({}, S.equipped), seen: Object.assign({}, S.seen),
        };
    }

    root.BattlePass = {
        season: {
            id: 's1', name: 'NEÓN CERO', xpPerLevel: XP_PER_LEVEL, maxLevel: MAX_LEVEL,
            tiers: TRACK.map(function (id, i) { return { level: i + 1, reward: byId[id] }; }),
        },
        state: state, track: track, addXP: addXP, missions: missions,
        reward: function (id) { return byId[id] || null; },
        rewardsOf: function (type) { return REWARDS.filter(function (r) { return r.type === type; }); },
        isUnlocked: isUnlocked, equip: equip, equipped: equipped,
        markSeen: markSeen, unseenCount: unseenCount, on: on,
        reset: function () { S = blank(); save(); emit('change', {}); },
    };
})(window);
