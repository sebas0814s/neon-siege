/* global THREE */
// ═══════════════════════════════════════════════════════════════════════════
//  3D SHOOTER  —  CONFIG · DIFICULTAD · SETTINGS · STATS · STATE · AUDIO ·
//                 SCENE · PLAYER · SCREEN SHAKE · UI · ENEMIES ·
//                 HEALTH PICKUPS · STAR PICKUP · GUN GAME · COMBAT ·
//                 GAME STATE MANAGER · INPUT · GAME LOOP
// ═══════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────── CONFIG ────────
var WEAPONS = {
    pistol:  { name: 'Pistol',  damage: 20, fireRate: 300, clip: 12, maxAmmo: 90,  reloadTime: 1400, price: 0,    color: 0x444444 },
    rifle:   { name: 'Rifle',   damage: 35, fireRate: 100, clip: 30, maxAmmo: 180, reloadTime: 2000, price: 2700, color: 0x555555 },
    shotgun: { name: 'Shotgun', damage: 60, fireRate: 800, clip: 8,  maxAmmo: 40,  reloadTime: 2500, price: 2000, color: 0x222222 },
    // Reutilizan el ajuste ya probado en Gun Game, con precio y reservas propias
    smg:     { name: 'SMG',     damage: 15, fireRate: 75,  clip: 30, maxAmmo: 240, reloadTime: 1600, price: 3400, color: 0x3344BB },
    sniper:  { name: 'Sniper',  damage: 160, fireRate: 1800, clip: 5, maxAmmo: 35, reloadTime: 3000, price: 5200, color: 0x004422 },
};

var GUN_GAME_WEAPONS = [
    { id: 'gg_bat',      name: 'Bate',          damage: 80,   fireRate: 1000, clip: 1,   maxAmmo: 9999, reloadTime: 500,  price: 0, color: 0x8B4513 },
    { id: 'gg_pistol',   name: 'Pistola',        damage: 22,   fireRate: 320,  clip: 12,  maxAmmo: 9999, reloadTime: 1400, price: 0, color: 0x4444AA },
    { id: 'gg_revolver', name: 'Revólver',       damage: 55,   fireRate: 700,  clip: 6,   maxAmmo: 9999, reloadTime: 1800, price: 0, color: 0xBB8800 },
    { id: 'gg_smg',      name: 'SMG',            damage: 15,   fireRate: 75,   clip: 30,  maxAmmo: 9999, reloadTime: 1600, price: 0, color: 0x3344BB },
    { id: 'gg_rifle',    name: 'Rifle AR',       damage: 38,   fireRate: 110,  clip: 30,  maxAmmo: 9999, reloadTime: 2000, price: 0, color: 0x225533 },
    { id: 'gg_shotgun',  name: 'Escopeta',       damage: 65,   fireRate: 850,  clip: 8,   maxAmmo: 9999, reloadTime: 2500, price: 0, color: 0x664422 },
    { id: 'gg_sniper',   name: 'Francotirador',  damage: 160,  fireRate: 1800, clip: 5,   maxAmmo: 9999, reloadTime: 3000, price: 0, color: 0x004422 },
    { id: 'gg_minigun',  name: 'Minigun',        damage: 12,   fireRate: 55,   clip: 100, maxAmmo: 9999, reloadTime: 4000, price: 0, color: 0x880000 },
    { id: 'gg_rpg',      name: 'Lanzacohetes',   damage: 350,  fireRate: 3000, clip: 1,   maxAmmo: 9999, reloadTime: 3500, price: 0, color: 0xFF4400 },
    { id: 'gg_golden',   name: 'Pistola Dorada', damage: 9999, fireRate: 2000, clip: 1,   maxAmmo: 9999, reloadTime: 2000, price: 0, color: 0xFFD700 },
];
GUN_GAME_WEAPONS.forEach(function(w) { WEAPONS[w.id] = w; });

// Armas disponibles en Oleadas, en orden de ranura (teclas 1..n)
var WAVE_SLOTS = ['pistol', 'rifle', 'shotgun', 'smg', 'sniper'];

var LOW_HEALTH    = 30; // por debajo: latido, vineta roja
var MAP_HALF      = 90;
var PLAYER_HEIGHT = 3;
// [x, z, ancho, alto, fondo] — el trazado define dos pasillos largos que
// cruzan el centro y bloques bajos alrededor para romper la linea de tiro sin
// dejar al jugador sin salida.
var COVER_LAYOUT = [
    // Muros largos: crean los pasillos
    [-14,  -4, 2.5, 4.5, 26], [ 14,   4, 2.5, 4.5, 26],
    [ -4,  16, 24,  3.2, 2.5], [  4, -16, 24,  3.2, 2.5],
    // Bloques medios en las bocas de los pasillos
    [-26,  18, 5,   6.5, 5  ], [ 26, -18, 5,   6.5, 5  ],
    [ 24,  20, 4,   2.2, 7  ], [-24, -20, 4,   2.2, 7  ],
    // Coberturas bajas de duelo cercano
    [  0,   0, 3.5, 1.4, 3.5], [ -8,  -9, 3,   1.8, 3  ],
    [  9,  -6, 3,   1.2, 4  ], [ -9,   7, 4,   1.6, 3  ],
    [ 18,  12, 3.5, 2.6, 3.5], [-18, -12, 3.5, 2.6, 3.5],
    // Torres altas de referencia visual en las esquinas del area jugable
    [ 34,  34, 6,  11,   6  ], [-34,  34, 6,  11,   6  ],
    [ 34, -34, 6,  11,   6  ], [-34, -34, 6,  11,   6  ],
];
var ENEMY_COLORS = [0x3366cc, 0xcc3333, 0x33cc66, 0xcc6633, 0x9933cc, 0xcc3399];

// ─────────────────────────────────────────────────────── ROSTER ─────────────
// Cada arquetipo se lee por silueta (ancho/alto) y color antes de llegar al
// rango de tiro. Los multiplicadores se aplican sobre waveConfig() y sobre la
// dificultad, asi que el balance global sigue viviendo en un solo sitio.
var ENEMY_TYPES = {
    recluta: {
        key:'recluta', name:'RECLUTA', color:0x3366cc, hp:1.00, speed:1.00, dmg:1.00,
        money:200, w:1.00, h:1.00, radius:0.6, behavior:'chase', voice:[5, 9],
        desc:'La base. Camina recto hacia ti.'
    },
    chacal: {
        key:'chacal', name:'CHACAL', color:0xff7a18, hp:0.45, speed:1.95, dmg:0.60,
        money:260, w:0.72, h:0.92, radius:0.45, behavior:'orbit', voice:[2.5, 5],
        desc:'Flaco y rapidisimo. Orbita mientras cierra distancia.'
    },
    mastodonte: {
        key:'mastodonte', name:'MASTODONTE', color:0x8b1a1a, hp:3.20, speed:0.55, dmg:1.90,
        money:420, w:1.45, h:1.30, radius:0.95, behavior:'chase', voice:[4, 7], stomp:true,
        desc:'Enorme y lento, pega durisimo. Gasta cargador o esquivalo.'
    },
    zumbador: {
        key:'zumbador', name:'ZUMBADOR', color:0x9d3cff, hp:0.80, speed:1.30, dmg:1.00,
        money:300, w:1.00, h:0.95, radius:0.6, behavior:'chase', voice:[0.9, 1.6],
        explode:{ radius:7, damage:18 },
        desc:'Explota al morir. Matarlo de cerca te cuesta vida.'
    },
    coloso: {
        key:'coloso', name:'COLOSO', color:0xffcc00, hp:14.0, speed:0.85, dmg:2.40,
        money:1500, w:2.20, h:1.90, radius:1.5, behavior:'chase', boss:true, voice:[5, 8], stomp:true,
        desc:'Jefe. Cada 5 oleadas. Emite luz propia.'
    }
};

// El minimapa se repinta a 30 Hz con N enemigos: construir el hex del color en
// cada dibujo generaba basura continua. Se calcula una vez por arquetipo.
for (var _tk in ENEMY_TYPES) {
    ENEMY_TYPES[_tk].hex = '#' + ('000000' + ENEMY_TYPES[_tk].color.toString(16)).slice(-6);
}

// Modificadores: cada tres oleadas (y nunca en la de jefe) entra una regla
// que cambia como se juega esa ronda, no solo cuanto aguantan los enemigos.
var WAVE_MODS = {
    jauria:  { name: 'JAURÍA',        desc: 'Solo Chacales' },
    niebla:  { name: 'NIEBLA DENSA',  desc: 'Visibilidad reducida' },
    sinKits: { name: 'SIN SUMINISTROS', desc: 'No caen botiquines' }
};
var WAVE_MOD_ORDER = ['jauria', 'niebla', 'sinKits'];

function waveModifier(wave) {
    if (wave % 5 === 0 || wave < 3) return null;
    if (wave % 3 !== 0) return null;
    return WAVE_MOD_ORDER[Math.floor(wave / 3 - 1) % WAVE_MOD_ORDER.length];
}

var activeMod = null;
var FOG_NEAR = 45, FOG_FAR = 175;

function applyWaveModifier(mod) {
    activeMod = mod;
    if (mod === 'niebla') { scene.fog.near = 8; scene.fog.far = 46; }
    else                  { scene.fog.near = FOG_NEAR; scene.fog.far = FOG_FAR; }
    var el = document.getElementById('mod-display');
    if (el) {
        if (mod) { _text('mod-value', WAVE_MODS[mod].name + ' · ' + WAVE_MODS[mod].desc); el.classList.remove('hidden'); }
        else el.classList.add('hidden');
    }
}

// Composicion de oleada: quien puede aparecer y con que peso.
function waveRoster(wave, count) {
    if (waveModifier(wave) === 'jauria') {
        var pack = [];
        for (var j = 0; j < count + 2; j++) pack.push('chacal');
        return pack;
    }
    if (wave % 5 === 0) {
        // Oleada de jefe: el Coloso mas una escolta reducida.
        var escort = [];
        var escortN = Math.max(2, Math.floor(count * 0.5));
        for (var e = 0; e < escortN; e++) escort.push(e % 2 === 0 ? 'recluta' : 'chacal');
        escort.push('coloso');
        return escort;
    }
    var pool = ['recluta'];
    if (wave >= 3) pool.push('chacal');
    if (wave >= 4) pool.push('mastodonte');
    if (wave >= 5) pool.push('zumbador');
    if (wave >= 8) pool.push('chacal', 'chacal'); // desde la 8 el Chacal domina

    var out = [];
    for (var i = 0; i < count; i++) {
        // Los dos primeros de cada oleada siempre son Reclutas: dan un momento
        // de lectura antes de que entre lo raro.
        out.push(i < 2 ? 'recluta' : pool[Math.floor(Math.random() * pool.length)]);
    }
    return out;
}

// ───────────────────────────────────────────────────────── MEJORAS ──────────
// Cuatro lineas de mejora compradas con el dinero de las bajas. Cada nivel
// aplica un factor sobre las stats base del arma equipada, asi que sirven para
// todas por igual y no hay que duplicar tablas.
var UPGRADES = {
    clip:   { name: 'CARGADOR',  desc: '+30% balas por cargador', max: 4, base: 900,  step: 700 },
    reload: { name: 'RECARGA',   desc: '-15% tiempo de recarga',  max: 4, base: 800,  step: 650 },
    damage: { name: 'DAÑO',      desc: '+15% daño de arma',       max: 4, base: 1200, step: 1000 },
    speed:  { name: 'VELOCIDAD', desc: '+8% velocidad al correr', max: 3, base: 1100, step: 900 }
};

function upgradePrice(key) {
    var u = UPGRADES[key], lvl = state.upgrades[key] || 0;
    return u.base + u.step * lvl;
}

function buyUpgrade(key) {
    var u = UPGRADES[key], lvl = state.upgrades[key] || 0;
    if (lvl >= u.max) return false;
    var price = upgradePrice(key);
    if (state.money < price) return false;
    state.money -= price;
    state.upgrades[key] = lvl + 1;
    playBuySound();
    // El cargador mayor se nota al instante: se rellena hasta el nuevo tope.
    if (key === 'clip') state.ammo[state.currentWeapon] = weaponClip(state.currentWeapon);
    updateUI();
    return true;
}

// Stats efectivas = base del arma x mejoras compradas
function weaponClip(id)   { return Math.round(WEAPONS[id].clip * (1 + 0.30 * (state.upgrades.clip || 0))); }
function weaponReload(id) { return Math.round(WEAPONS[id].reloadTime * Math.pow(0.85, state.upgrades.reload || 0)); }
function weaponDamage(id) { return WEAPONS[id].damage * (1 + 0.15 * (state.upgrades.damage || 0)); }
function playerSpeed()    { return 9 * (1 + 0.08 * (state.upgrades.speed || 0)); }
var SPRINT_MULT = 1.55;

// Balistica por arma: dispersion (rad), perdigones, perforacion y empuje.
// Las automaticas disparan mientras se mantiene el clic.
var BALLISTICS = {
    pistol:      { spread: 0.006, auto: false },
    rifle:       { spread: 0.014, auto: true,  push: 0.25 },
    shotgun:     { spread: 0.075, pellets: 9, push: 1.4 },
    smg:         { spread: 0.03,  auto: true },
    sniper:      { spread: 0,     pierce: 3, push: 1.2 },
    gg_bat:      { melee: 3.4,    push: 2.5 },
    gg_pistol:   { spread: 0.006 },
    gg_revolver: { spread: 0.004, push: 0.6 },
    gg_smg:      { spread: 0.03,  auto: true },
    gg_rifle:    { spread: 0.014, auto: true, push: 0.25 },
    gg_shotgun:  { spread: 0.075, pellets: 9, push: 1.4 },
    gg_sniper:   { spread: 0,     pierce: 3, push: 1.2 },
    gg_minigun:  { spread: 0.04,  auto: true, push: 0.15 },
    gg_rpg:      { rocket: { speed: 48, radius: 6.5 } },
    gg_golden:   { spread: 0,     pierce: 10 },
};
function ballistics(id) { return BALLISTICS[id] || { spread: 0.01 }; }

// ──────────────────────────────────────────────────── DIFICULTAD ─────────────
var DIFFICULTIES = {
    facil: {
        name: 'Fácil', color: '#00ff88',
        enemyHpMult: 0.65, enemySpeedMult: 0.70, enemyDamage: 8,
        attackCooldown: 2200, dropChance: 0.45, healAmount: 35,
        startMoney: 1500, waveCountOffset: -1,
    },
    medioTonto: {
        name: 'Medio Tonto', color: '#ffcc00',
        enemyHpMult: 1.00, enemySpeedMult: 1.00, enemyDamage: 15,
        attackCooldown: 1500, dropChance: 0.28, healAmount: 30,
        startMoney: 800, waveCountOffset: 0,
    },
    medioLoco: {
        name: 'Medio Loco', color: '#ff6600',
        enemyHpMult: 1.40, enemySpeedMult: 1.30, enemyDamage: 22,
        attackCooldown: 1100, dropChance: 0.12, healAmount: 25,
        startMoney: 600, waveCountOffset: 1,
    },
    muyLoco: {
        name: 'Muy Loco', color: '#ff2222',
        enemyHpMult: 2.00, enemySpeedMult: 1.70, enemyDamage: 35,
        attackCooldown: 700, dropChance: 0.05, healAmount: 20,
        startMoney: 400, waveCountOffset: 2,
    },
};

function getDiff() { return DIFFICULTIES[settings.difficulty] || DIFFICULTIES.medioTonto; }

// El HUD no usa emoji: la dificultad se lee como una escala de cuatro pasos.
var DIFF_ORDER = ['facil', 'medioTonto', 'medioLoco', 'muyLoco'];
function diffPips() {
    var i = DIFF_ORDER.indexOf(settings.difficulty);
    if (i < 0) i = 1;
    var out = '';
    for (var k = 0; k < 4; k++) out += (k <= i ? '\u25B0' : '\u25B1');
    return out;
}

function waveConfig(wave) {
    var diff  = getDiff();
    var count = Math.max(1, 3 + wave * 2 + diff.waveCountOffset);
    return {
        count:  count,
        health: Math.round((50 + (wave - 1) * 15) * diff.enemyHpMult),
        speed:  (3 + (wave - 1) * 0.3) * diff.enemySpeedMult,
    };
}

// ──────────────────────────────────────────────────────────── SETTINGS ───────
// Deteccion de movil TEMPRANA: tiene que existir antes de leer settings para
// poder elegir el preset por defecto (mas abajo) y antes de crear la camara.
var _isMobileEarly = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

var settings = (function() {
    // Sin ajustes guardados, movil arranca en 'rendimiento': es la primera
    // partida de cualquiera en Android/Capacitor y ahi es donde mas se nota.
    // Si el jugador ya guardo preferencias, mandan las suyas.
    var def = { sensitivity: 1.0, touchSensitivity: 1.0, crosshairColor: '#00ff00', crosshairSize: 20, showMinimap: true, volume: 80, difficulty: 'medioTonto', quality: _isMobileEarly ? 'rendimiento' : 'medio', showFps: false, music: true };
    try { return Object.assign({}, def, JSON.parse(localStorage.getItem('shooter_settings') || '{}')); }
    catch(e) { return def; }
})();

// Presets de rendimiento. 'aa' solo se aplica al crear el renderer (requiere recargar).
var QUALITY = {
    rendimiento: { aa: false, scale: 0.75, maxDpr: 1,   shadows: false, shadowSize: 512,  enemyShadows: false },
    medio:       { aa: false, scale: 1.0,  maxDpr: 1,   shadows: true,  shadowSize: 1024, enemyShadows: true  },
    alto:        { aa: true,  scale: 1.0,  maxDpr: 2,   shadows: true,  shadowSize: 2048, enemyShadows: true  }
};
function getQuality() { return QUALITY[settings.quality] || QUALITY.medio; }

function saveSettings() { try { localStorage.setItem('shooter_settings', JSON.stringify(settings)); } catch(e) {} }

// Escala de render: el coste de pintar crece con el CUADRADO de esta cifra.
// A 1440p con pixelRatio 2 se rasterizaban 4x mas pixeles que a escala 1.
function applyRenderScale() {
    var q = getQuality();
    var dpr = Math.min(window.devicePixelRatio || 1, _isMobileEarly ? 1 : q.maxDpr);
    renderer.setPixelRatio(dpr * q.scale);
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function applyQuality() {
    var q = getQuality();
    applyRenderScale();
    renderer.shadowMap.enabled = q.shadows;
    if (sun.shadow.map && sun.shadow.mapSize.width !== q.shadowSize) {
        sun.shadow.map.dispose(); sun.shadow.map = null;
    }
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = q.shadowSize;
    sun.castShadow = q.shadows;
    for (var i = 0; i < arenaLights.length; i++) arenaLights[i].visible = (settings.quality !== 'rendimiento');
    if (window.WorldFX) WorldFX.setQuality(settings.quality);
    scene.traverse(function(o) { if (o.material) o.material.needsUpdate = true; });
    var fps = document.getElementById('fps-display');
    if (fps) fps.style.display = settings.showFps ? 'block' : 'none';
}

function applySettings() {
    document.documentElement.style.setProperty('--ch-color', settings.crosshairColor);
    document.documentElement.style.setProperty('--ch-size',  settings.crosshairSize + 'px');
    document.getElementById('minimap').style.display = settings.showMinimap ? 'block' : 'none';
    if (masterGain) masterGain.gain.value = settings.volume / 100;
    applyQuality();
    var pv = document.getElementById('ch-preview-v');
    if (pv) { pv.style.background = settings.crosshairColor; document.getElementById('ch-preview-h').style.background = settings.crosshairColor; }
}

// ──────────────────────────────────────────────────────────── STATS ──────────
var globalStats = (function() {
    var def = { bestWave: 0, totalKills: 0, gamesPlayed: 0, totalTimeSec: 0, bestStreak: 0, bestAccuracy: 0 };
    try { return Object.assign({}, def, JSON.parse(localStorage.getItem('shooter_stats') || '{}')); }
    catch(e) { return def; }
})();

function accuracy() {
    return state.shotsFired ? Math.round(state.shotsHit / state.shotsFired * 100) : 0;
}

function saveStats(wave, kills, elapsedSec) {
    globalStats.bestWave      = Math.max(globalStats.bestWave, wave - 1);
    globalStats.totalKills   += kills;
    globalStats.gamesPlayed  += 1;
    globalStats.totalTimeSec += elapsedSec;
    globalStats.bestStreak    = Math.max(globalStats.bestStreak || 0, state.bestStreak || 0);
    // La puntería solo cuenta si hubo partida de verdad, si no un tiro suelto
    // acertado dejaria un 100% imposible de superar.
    if (state.shotsFired >= 20) globalStats.bestAccuracy = Math.max(globalStats.bestAccuracy || 0, accuracy());
    try { localStorage.setItem('shooter_stats', JSON.stringify(globalStats)); } catch(e) {}
}

function formatTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
}

// ──────────────────────────────────────────────────────────── STATE ──────────
// El inventario se deriva de WAVE_SLOTS para no repetir la lista de armas
// cada vez que se anade una nueva.
function freshAmmo()     { var o={}; WAVE_SLOTS.forEach(function(id){o[id]=WEAPONS[id].clip;}); return o; }
function freshReserves() { var o={}; WAVE_SLOTS.forEach(function(id){o[id]=WEAPONS[id].maxAmmo-WEAPONS[id].clip;}); return o; }
function freshOwned()    { var o={}; WAVE_SLOTS.forEach(function(id,i){o[id]=(i===0);}); return o; }

var state = {
    health: 100, money: 800, currentWeapon: 'pistol',
    isPaused: false, isBuying: false, isGameOver: false,
    isJumping: false, yVelocity: 0, isReloading: false,
    lastFireTime: 0, lastDashTime: 0, dashCooldown: 5000,
    ammo:     freshAmmo(), reserves: freshReserves(), owned: freshOwned(),
    upgrades: { clip: 0, reload: 0, damage: 0, speed: 0 },
    wave: 1, kills: 0, totalKills: 0, startTime: Date.now(),
    // Game mode
    gameMode: 'normal', // 'normal' | 'gungame'
    ggLevel: 0,
    // Power-ups
    starActive: false,
    starEndTime: 0,
    ammoRushEnd: 0,
    slowmoEnd: 0,
    // Puntería y racha de la partida en curso
    shotsFired: 0, shotsHit: 0, streak: 0, bestStreak: 0,
};

function initGGAmmo() {
    GUN_GAME_WEAPONS.forEach(function(w) {
        state.ammo[w.id]     = w.clip;
        state.reserves[w.id] = 9999;
        state.owned[w.id]    = true;
    });
    state.currentWeapon = GUN_GAME_WEAPONS[0].id;
    state.money = 0;
    state.ggLevel = 0;
}

function resetState() {
    var mode = state.gameMode;
    var diff = getDiff();
    Object.assign(state, {
        health: 100, money: diff.startMoney, currentWeapon: 'pistol',
        isPaused: false, isBuying: false, isGameOver: false,
        isJumping: false, yVelocity: 0, isReloading: false,
        lastFireTime: 0, lastDashTime: 0,
        ammo: freshAmmo(), reserves: freshReserves(), owned: freshOwned(),
        upgrades: { clip: 0, reload: 0, damage: 0, speed: 0 },
        wave: 1, kills: 0, totalKills: 0, startTime: Date.now(),
        gameMode: mode, ggLevel: 0,
        starActive: false, starEndTime: 0, ammoRushEnd: 0, slowmoEnd: 0,
        shotsFired: 0, shotsHit: 0, streak: 0, bestStreak: 0,
    });
    if (mode === 'gungame') initGGAmmo();
}

// ──────────────────────────────────────────────────────────── AUDIO ──────────
var audioCtx  = null;
var masterGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = settings.volume / 100;
    // Limitador de seguridad: musica, disparos y explosiones a la vez pueden
    // sumar por encima de 1.0 y saturar la salida.
    var limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.15;
    masterGain.connect(limiter);
    limiter.connect(audioCtx.destination);
    if (window.GunAudio) GunAudio.init(audioCtx, masterGain);
    if (window.GameAudio) { GameAudio.init(audioCtx, masterGain); GameAudio.setMusicEnabled(settings.music); }
}

function tone(type, freq, freqEnd, vol, dur) {
    if (!audioCtx || !masterGain) return;
    var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + dur);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + dur + 0.05);
}

function playShootSound(id)  { if (window.GunAudio) { GunAudio.shot(id); return; } var f = ({pistol:320,rifle:500,shotgun:180,gg_bat:120,gg_pistol:320,gg_revolver:280,gg_smg:480,gg_rifle:500,gg_shotgun:180,gg_sniper:600,gg_minigun:460,gg_rpg:100,gg_golden:900})[id]||320; tone('sawtooth',f,80,0.28,0.18); }
function playReloadSound(id) { if (window.GunAudio) { GunAudio.reload(id, weaponReload(id)); return; } tone('square',280,160,0.1,0.15); setTimeout(function(){tone('square',520,340,0.08,0.12);},200); }
// GameAudio (si esta cargado) sustituye estos pitidos por efectos completos;
// las llamadas a tone() quedan como respaldo para cuando el modulo no esta.
function playDamageSound()   { if (window.GameAudio) return GameAudio.hurt(); tone('sine',200,75,0.38,0.3); }
function playDeathSound()    { if (window.GameAudio) return GameAudio.playerDeath(); tone('sawtooth',140,55,0.3,0.5); tone('square',75,35,0.2,0.6); }
function playHeadshotSound() { if (window.GameAudio) return GameAudio.headshot(); tone('sine',820,410,0.38,0.28); tone('sine',1240,620,0.18,0.2); }
function playWaveSound(isBoss) { if (window.GameAudio) return GameAudio.waveStart(isBoss); tone('sine',400,820,0.28,0.38); setTimeout(function(){tone('sine',520,1040,0.22,0.38);},200); }
function playMenuClick()     { if (window.GameAudio) return GameAudio.ui('click'); tone('sine',600,800,0.08,0.07); }
function playHealSound()     { if (window.GameAudio) return GameAudio.pickup('heal'); tone('sine',440,660,0.25,0.15); setTimeout(function(){tone('sine',660,880,0.2,0.2);},120); setTimeout(function(){tone('sine',880,1100,0.15,0.25);},260); }
function playPickupNearSound() { tone('sine',300,400,0.06,0.1); }
function playStarSound()     { if (window.GameAudio) return GameAudio.pickup('star'); tone('sine',600,1200,0.3,0.12); setTimeout(function(){tone('sine',800,1600,0.25,0.15);},100); setTimeout(function(){tone('sine',1000,2000,0.2,0.18);},220); }
function playPowerupSound()  { if (window.GameAudio) return GameAudio.pickup('power'); playStarSound(); }
function playBuySound()      { if (window.GameAudio) return GameAudio.ui('buy'); playHealSound(); }
function playExplosionSound(){ if (window.GunAudio) return GunAudio.explosion(); tone('sawtooth',150,40,0.4,0.45); tone('square',90,30,0.3,0.35); }
function playGGWinSound()    { if (window.GameAudio) return GameAudio.victory(); [0,150,300,500].forEach(function(d,i){ setTimeout(function(){ tone('sine',[440,550,660,880][i],[660,880,1100,1320][i],0.3,0.3); },d); }); }

// Paneo (-1 izquierda .. 1 derecha) y distancia de un punto del mundo respecto
// al jugador, para que los sonidos de los enemigos se oigan en su sitio.
var _ear = { pan: 0, dist: 0 };
function locateSound(x, z) {
    var dx = x - camera.position.x, dz = z - camera.position.z;
    _ear.dist = Math.sqrt(dx * dx + dz * dz);
    _ear.pan = _ear.dist > 0.01 ? (dx * Math.cos(input.yaw) - dz * Math.sin(input.yaw)) / _ear.dist : 0;
    return _ear;
}

// La musica sigue al combate: cuantos mas enemigos vivos, mas capas suenan.
var _moodAcc = 0;
function updateAudioMood(delta) {
    if (!window.GameAudio) return;
    _moodAcc += delta;
    if (_moodAcc < 0.25) return;
    _moodAcc = 0;
    var fighting = !inMenu && !state.isPaused;
    GameAudio.setScene(inMenu ? 'menu' : (fighting ? 'combat' : 'paused'));
    GameAudio.setIntensity(0.12 + enemies.length / 7, !!bossRef);
    GameAudio.setLowHealth(fighting && state.health <= LOW_HEALTH);
}

// ──────────────────────────────────────────────────────────── SCENE ──────────
var scene    = new THREE.Scene();
var camera   = new THREE.PerspectiveCamera(
    _isMobileEarly ? 90 : 75,          // FOV más amplio en móvil para mejor visibilidad
    // El plano lejano cubre la cupula del cielo, las estrellas y la luna;
    // con 200 quedaban recortadas y solo se veia el color de fondo.
    window.innerWidth / window.innerHeight, 0.1, 420
);
var renderer = new THREE.WebGLRenderer({
    antialias: getQuality().aa,          // MSAA cuesta mucho fill-rate: OFF salvo calidad alta
    powerPreference: 'high-performance', // fuerza la GPU dedicada en portatiles hibridos
    stencil: false,                      // no usamos stencil buffer
    depth: true
});
var clock    = new THREE.Clock();

// La niebla toma el color del horizonte para que el borde del mapa no se vea:
// la ciudad se disuelve en la bruma en vez de terminar en un corte seco.
var SKY_HORIZON = 0x2a1b4d;
var SKY_ZENITH  = 0x05060f;
scene.background = new THREE.Color(SKY_HORIZON);
scene.fog        = new THREE.Fog(SKY_HORIZON, 45, 175);
camera.position.set(0, PLAYER_HEIGHT, 5);
scene.add(camera);

renderer.setSize(window.innerWidth, window.innerHeight);
applyRenderScale();
renderer.shadowMap.enabled = getQuality().shadows;
renderer.shadowMap.type    = THREE.PCFShadowMap; // PCFSoft es ~2x mas caro por muestra
document.body.appendChild(renderer.domElement);

// ── Cupula de cielo: degradado vertical en un solo mesh, sin texturas ──────
var skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 16),
    new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
            top:    { value: new THREE.Color(SKY_ZENITH) },
            bottom: { value: new THREE.Color(SKY_HORIZON) }
        },
        vertexShader: [
            'varying float vH;',
            'void main() {',
            '  vH = normalize(position).y;',
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform vec3 top; uniform vec3 bottom; varying float vH;',
            'void main() {',
            '  float k = clamp(vH * 1.6 + 0.15, 0.0, 1.0);',
            '  gl_FragColor = vec4(mix(bottom, top, k), 1.0);',
            '}'
        ].join('\n')
    })
);
skyDome.frustumCulled = false;
scene.add(skyDome);

// ── Horizonte: un unico InstancedMesh con toda la ciudad (1 draw call) ─────
var SKYLINE_COUNT = 150;
var skyline = (function() {
    var mat  = new THREE.MeshBasicMaterial({ color: 0x120d24, fog: true });
    var mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, SKYLINE_COUNT);
    var m = new THREE.Matrix4(), q = new THREE.Quaternion();
    var pos = new THREE.Vector3(), scl = new THREE.Vector3();
    for (var i = 0; i < SKYLINE_COUNT; i++) {
        var a = (i / SKYLINE_COUNT) * Math.PI * 2 + Math.random() * 0.04;
        var r = 135 + Math.random() * 55;
        var h = 10 + Math.random() * Math.random() * 62;
        var w = 7 + Math.random() * 13;
        pos.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
        scl.set(w, h, w);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
})();

scene.add(new THREE.AmbientLight(0x2a2a55, 0.55));

// Dos focos de color en extremos opuestos: dan volumen y direccion a la arena
// en vez de la iluminacion plana anterior. Se omiten en modo rendimiento.
var arenaLights = (function() {
    var a = new THREE.PointLight(0xff2e88, 1.5, 110); a.position.set(-46, 26, -46);
    var b = new THREE.PointLight(0x00bfff, 1.5, 110); b.position.set( 46, 26,  46);
    scene.add(a); scene.add(b);
    return [a, b];
})();

var sun = new THREE.DirectionalLight(0x8888ff, 0.8);
sun.position.set(30, 50, 30); sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = getQuality().shadowSize;
// El frustum por defecto era +-5u: no cubria el mapa y desperdiciaba resolucion.
sun.shadow.camera.left = sun.shadow.camera.bottom = -55;
sun.shadow.camera.right = sun.shadow.camera.top   =  55;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
sun.shadow.bias = -0.0015;
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);

// Retícula generada en un canvas: una textura de 128px repetida da sensacion
// de escala y velocidad sin cargar ningun archivo.
var gridTexture = (function() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#0e1022'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,255,204,0.16)'; g.lineWidth = 2;
    g.strokeRect(1, 1, 126, 126);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    return tex;
})();

var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x8899bb, map: gridTexture })
);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.solid = true; scene.add(ground);

var COVER_MAT = new THREE.MeshLambertMaterial({ color: 0x2b2f4a });
var COVER_UNIT = new THREE.BoxGeometry(1, 1, 1); // una geometria escalada por bloque
var coverMeshes = COVER_LAYOUT.map(function(c) {
    var box = new THREE.Mesh(COVER_UNIT, COVER_MAT);
    box.scale.set(c[2], c[3], c[4]);
    box.position.set(c[0], c[3] / 2, c[1]);
    box.castShadow = box.receiveShadow = true;
    box.userData.footprint = { w: c[2], d: c[4] };
    box.userData.solid = true;
    scene.add(box);
    return box;
});

// Cajas de colision en planta (XZ) + altura: el jugador y los enemigos no
// atraviesan estructuras; el jugador puede subirse saltando a las bajas.
var COVER_BOXES = COVER_LAYOUT.map(function(c) {
    return { minX: c[0] - c[2] / 2, maxX: c[0] + c[2] / 2, minZ: c[1] - c[4] / 2, maxZ: c[1] + c[4] / 2, top: c[3] };
});
var _colN = { x: 0, z: 0, hit: false };

// Empuja un circulo (x,z,r) fuera de las cajas cuya parte alta esta por encima
// de los pies. Devuelve la normal del ultimo choque en _colN.
function resolveCircle(pos, r, feetY) {
    _colN.hit = false;
    for (var i = 0; i < COVER_BOXES.length; i++) {
        var b = COVER_BOXES[i];
        if (feetY >= b.top - 0.05) continue;
        var cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        var cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        var dx = pos.x - cx, dz = pos.z - cz, d2 = dx*dx + dz*dz;
        if (d2 >= r*r) continue;
        var nx, nz, pen;
        if (d2 > 1e-8) {
            var d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d;
        } else {
            // Centro dentro de la caja: sal por el lado mas cercano
            var l = pos.x - b.minX, rr = b.maxX - pos.x, n = pos.z - b.minZ, f = b.maxZ - pos.z;
            var m = Math.min(l, rr, n, f);
            if (m === l)      { nx = -1; nz = 0; pen = l + r; }
            else if (m === rr){ nx =  1; nz = 0; pen = rr + r; }
            else if (m === n) { nx = 0; nz = -1; pen = n + r; }
            else              { nx = 0; nz =  1; pen = f + r; }
        }
        pos.x += nx * pen; pos.z += nz * pen;
        _colN.x = nx; _colN.z = nz; _colN.hit = true;
    }
    return _colN.hit;
}

// Altura del suelo bajo el jugador: 0 o la parte alta de una cobertura
// sobre la que esta parado.
function groundHeightAt(x, z, r, feetY) {
    var h = 0;
    for (var i = 0; i < COVER_BOXES.length; i++) {
        var b = COVER_BOXES[i];
        if (feetY < b.top - 0.35) continue;
        if (x + r * 0.5 < b.minX || x - r * 0.5 > b.maxX || z + r * 0.5 < b.minZ || z - r * 0.5 > b.maxZ) continue;
        if (b.top > h) h = b.top;
    }
    return h;
}

// Franja de neon en la parte alta de cada bloque: da lectura de altura en la
// penumbra sin anadir luces reales.
var COVER_TRIM_MAT = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
coverMeshes.forEach(function(b) {
    var f = b.userData.footprint;
    var trim = new THREE.Mesh(COVER_UNIT, COVER_TRIM_MAT);
    trim.scale.set(f.w + 0.12, 0.14, f.d + 0.12);
    trim.position.set(b.position.x, b.scale.y + 0.05, b.position.z);
    scene.add(trim);
});

// Ambientacion: cielo, ciudad, paneles, pulso del suelo, balizas y particulas.
if (window.WorldFX) {
    WorldFX.init({
        scene: scene, camera: camera, skyDome: skyDome, skyline: skyline, ground: ground,
        coverMaterial: COVER_MAT, coverLayout: COVER_LAYOUT, mapHalf: MAP_HALF,
        colors: { horizon: SKY_HORIZON, zenith: SKY_ZENITH }
    });
}

// ──────────────────────────────────────────────────────────── PLAYER ─────────
var input = { keys: {}, pitch: 0, yaw: 0, bobPhase: 0, isLocked: false };

var armMat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
var arms   = new THREE.Group();
var la = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), armMat); la.position.set(-0.4,-0.3,-0.5); arms.add(la);
var ra = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), armMat); ra.position.set( 0.3,-0.3,-0.5); arms.add(ra);
arms.position.y = -0.5; camera.add(arms);

var weaponGroup = new THREE.Group(); weaponGroup.position.set(0.3, -0.2, -0.6); arms.add(weaponGroup);

function createWeaponModel(id) {
    if (window.WeaponFX) { weaponGroup.visible = false; WeaponFX.setWeapon(id); return; }
    while (weaponGroup.children.length) {
        var old = weaponGroup.children[0];
        weaponGroup.remove(old);
        if (old.geometry) old.geometry.dispose();
        if (old.material) old.material.dispose();
    }
    var w = WEAPONS[id], len = w.fireRate * 0.001;
    var b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, len), new THREE.MeshLambertMaterial({ color: w.color }));
    b.position.z = -len / 2; weaponGroup.add(b);
}
if (window.WeaponFX) WeaponFX.init(scene, camera);
if (window.EnemyModels) EnemyModels.init(scene);
createWeaponModel('pistol');

var muzzleFlash = new THREE.PointLight(0xffaa33, 0, 4); muzzleFlash.position.set(0.3,-0.1,-1.2); camera.add(muzzleFlash);

var PLAYER_RADIUS = 0.55;

function applyPhysics(delta) {
    if (state.isGameOver) return; // la camara de muerte controla la altura
    var feet  = camera.position.y - PLAYER_HEIGHT;
    var floor = groundHeightAt(camera.position.x, camera.position.z, PLAYER_RADIUS, feet);
    // Se salio del borde de una cobertura: empieza a caer
    if (!state.isJumping && feet > floor + 0.01) { state.isJumping = true; state.yVelocity = 0; }
    if (!state.isJumping) return;
    state.yVelocity += -24 * delta; camera.position.y += state.yVelocity * delta;
    if (state.yVelocity <= 0 && camera.position.y - PLAYER_HEIGHT <= floor) {
        var impact = -state.yVelocity;
        camera.position.y = PLAYER_HEIGHT + floor; state.isJumping = false; state.yVelocity = 0;
        onLanded(impact);
    }
}

var HARD_LANDING = 11; // velocidad de caida a partir de la cual el golpe se nota

function onLanded(impact) {
    if (impact < 2) return;
    var strength = Math.min(1, impact / 20);
    view.pitchKick -= 0.05 * strength;
    if (window.GameAudio) GameAudio.land(strength);
    if (impact > HARD_LANDING && window.WorldFX) WorldFX.ring(camera.position.x, camera.position.z, 0x00ffcc, 2.2);
}

function playerJump() {
    if (state.isJumping || state.isPaused) return;
    state.isJumping = true; state.yVelocity = 9.5;
    if (window.GameAudio) GameAudio.jump();
}

var _dashDir = new THREE.Vector3(); // scratch: el dash reutiliza el mismo vector

function performDash() {
    var now = Date.now(); if (now - state.lastDashTime < state.dashCooldown) return;
    state.lastDashTime = now; notifyTutorial('dash');
    view.fovKick = DASH_FOV_KICK;
    flashOverlay('dash-fx', 380);
    if (window.GameAudio) GameAudio.dash();
    if (window.WorldFX) WorldFX.ring(camera.position.x, camera.position.z, 0x00ffcc, 2.6);
    // El setInterval dura 200 ms y el enfriamiento son 5 s: no puede solaparse
    // con otro dash, asi que el vector global es seguro aqui.
    var dir = _dashDir; camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    var step = 0, iv = setInterval(function(){ for (var k = 0; k < 3; k++) { camera.position.addScaledVector(dir,0.5); clampPos(); } if(++step>=10)clearInterval(iv); },20);
}

var _mvFwd = new THREE.Vector3(), _mvRight = new THREE.Vector3(), _mvDir = new THREE.Vector3();
var _UP = new THREE.Vector3(0, 1, 0);

function handleMovement(delta) {
    var forward = _mvFwd; camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    var right = _mvRight.crossVectors(forward, _UP).normalize();
    var move = _mvDir.set(0, 0, 0);

    // Keyboard input
    if (input.keys['KeyW']) move.add(forward);
    if (input.keys['KeyS']) move.sub(forward);
    if (input.keys['KeyA']) move.sub(right);
    if (input.keys['KeyD']) move.add(right);

    // Touch movement + shoot (mobile) — look is applied directly in touchmove listener
    if (isMobile && mobileActive) {
        if (_tMov.x !== 0 || _tMov.y !== 0) {
            move.addScaledVector(forward, -_tMov.y);
            move.addScaledVector(right,    _tMov.x);
        }
        if (window.mobileShootActive) fireWeapon();
    }

    if (move.lengthSq() > 0) {
        notifyTutorial('move');
        input.sprinting = !!(input.keys['ShiftLeft'] || input.keys['ShiftRight']) && !input.mouseDown;
        var spd = playerSpeed() * (state.starActive ? 1.75 : 1) * (input.sprinting ? SPRINT_MULT : 1);
        move.normalize().multiplyScalar(spd * delta);
        camera.position.add(move);
        input.moving = true;
        var stepsBefore = Math.floor(input.bobPhase / Math.PI);
        input.bobPhase += delta * (input.sprinting ? 12 : 9);
        // Media vuelta de balanceo = un pie en el suelo
        if (!state.isJumping && window.GameAudio && Math.floor(input.bobPhase / Math.PI) !== stepsBefore) GameAudio.footstep(input.sprinting);
        arms.position.y = -0.5 + Math.sin(input.bobPhase) * 0.025;
    } else { input.moving = false; input.sprinting = false; }
    clampPos();
}

function clampPos() {
    camera.position.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, camera.position.x));
    camera.position.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, camera.position.z));
    resolveCircle(camera.position, PLAYER_RADIUS, camera.position.y - PLAYER_HEIGHT);
}

// ────────────────────────────────────────────────────── SCREEN SHAKE ─────────
var shakePow = 0;

function triggerShake(power) {
    shakePow = Math.max(shakePow, power);
}

var SHAKE_BY_WEAPON = { pistol:0.008, rifle:0.005, shotgun:0.026, gg_bat:0.03, gg_pistol:0.008, gg_revolver:0.012, gg_smg:0.005, gg_rifle:0.006, gg_shotgun:0.026, gg_sniper:0.02, gg_minigun:0.004, gg_rpg:0.05, gg_golden:0.04 };

// Sensacion de camara: el campo de vision se abre al correr y en el dash, la
// vista se inclina al moverse de lado, cabecea al aterrizar y cae al morir.
var BASE_FOV = camera.fov;
var SPRINT_FOV = 5, STAR_FOV = 6, DASH_FOV_KICK = 14;
var STRAFE_ROLL = 0.022;
var DEATH_FALL_SECONDS = 0.9, DEATH_EYE_HEIGHT = 0.7, DEATH_ROLL = 1.15;
var view = { fovKick: 0, pitchKick: 0, roll: 0, death: 0, deathFromY: 0, deathFloorY: 0 };

function resetView() {
    view.fovKick = view.pitchKick = view.roll = view.death = 0;
    camera.fov = BASE_FOV; camera.updateProjectionMatrix();
}

function startDeathFall() {
    view.death = 0.0001;
    view.deathFromY = camera.position.y;
    view.deathFloorY = groundHeightAt(camera.position.x, camera.position.z, PLAYER_RADIUS, camera.position.y - PLAYER_HEIGHT);
}

function updateViewFeel(delta) {
    var playing = !state.isPaused;
    var targetFov = BASE_FOV + view.fovKick
        + (playing && input.sprinting ? SPRINT_FOV : 0) + (playing && state.starActive ? STAR_FOV : 0);
    var fov = camera.fov + (targetFov - camera.fov) * Math.min(1, delta * 9);
    if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    view.fovKick *= Math.pow(0.01, delta);
    view.pitchKick *= Math.pow(0.0005, delta);

    var strafe = playing ? ((input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0) + _tMov.x) : 0;
    view.roll += (-strafe * STRAFE_ROLL - view.roll) * Math.min(1, delta * 8);

    if (view.death > 0 && view.death < 1) {
        view.death = Math.min(1, view.death + delta / DEATH_FALL_SECONDS);
        var k = view.death * view.death;
        camera.position.y = view.deathFromY + (view.deathFloorY + DEATH_EYE_HEIGHT - view.deathFromY) * k;
    }
}

function applyShake(delta) {
    camera.rotation.order = 'YXZ';
    var pitch = input.pitch + view.pitchKick;
    if (shakePow > 0.0004) {
        camera.rotation.y = input.yaw + (Math.random() - 0.5) * shakePow;
        pitch += (Math.random() - 0.5) * shakePow * 0.55;
        shakePow *= Math.pow(0.72, delta * 60); // independiente de los FPS
    } else {
        camera.rotation.y = input.yaw;
        shakePow = 0;
    }
    camera.rotation.x = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, pitch));
    camera.rotation.z = view.roll + view.death * view.death * DEATH_ROLL;
}

// Reinicia la animacion CSS de una capa de pantalla completa (dash, etc.).
function flashOverlay(id, ms) {
    var el = _el(id);
    if (!el) return;
    el.classList.remove('hidden');
    if (el.animate) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
    clearTimeout(el._t); el._t = setTimeout(function() { el.classList.add('hidden'); }, ms);
}

// ───────────────────────────────────────────────────── NUMEROS DE DAÑO ──────
// Los impactos del mismo frame sobre el mismo enemigo (perdigones, explosion)
// se suman en una sola cifra. Los nodos se reutilizan: nada de crear y borrar
// elementos por disparo.
var DAMAGE_POPUPS = 10;
var _damageNodes = [], _damageCursor = 0;
var _damageQueue = [], _damageQueued = 0;
var _screenPos = new THREE.Vector3();
var HEAD_HEIGHT = 3.15; // altura local de la coronilla del modelo

function queueDamageNumber(grp, amount, isCrit) {
    for (var i = 0; i < _damageQueued; i++) {
        var pending = _damageQueue[i];
        if (pending.grp === grp) { pending.amount += amount; pending.crit = pending.crit || isCrit; return; }
    }
    if (_damageQueued >= DAMAGE_POPUPS) return;
    var slot = _damageQueue[_damageQueued] || (_damageQueue[_damageQueued] = {});
    slot.grp = grp; slot.amount = amount; slot.crit = isCrit;
    _damageQueued++;
}

function damageNode() {
    var el = _damageNodes[_damageCursor];
    if (!el) {
        el = _damageNodes[_damageCursor] = document.createElement('div');
        _el('ui-container').appendChild(el);
    }
    _damageCursor = (_damageCursor + 1) % DAMAGE_POPUPS;
    return el;
}

function flushDamageNumbers() {
    for (var i = 0; i < _damageQueued; i++) {
        var pending = _damageQueue[i], grp = pending.grp;
        var type = grp.userData.type || ENEMY_TYPES.recluta;
        _screenPos.set(grp.position.x, HEAD_HEIGHT * type.h, grp.position.z).project(camera);
        pending.grp = null;
        if (_screenPos.z > 1) continue; // detras de la camara
        var el = damageNode();
        el.className = 'dmg-number' + (pending.crit ? ' crit' : '');
        el.textContent = Math.max(1, Math.round(pending.amount));
        el.style.left = ((_screenPos.x * 0.5 + 0.5) * 100 + (Math.random() - 0.5) * 3) + '%';
        el.style.top  = ((-_screenPos.y * 0.5 + 0.5) * 100) + '%';
        if (el.animate) {
            el.animate([
                { opacity: 0, transform: 'translate(-50%, -20%) scale(0.6)' },
                { opacity: 1, transform: 'translate(-50%, -70%) scale(1.15)', offset: 0.18 },
                { opacity: 1, transform: 'translate(-50%, -110%) scale(1)', offset: 0.6 },
                { opacity: 0, transform: 'translate(-50%, -170%) scale(0.9)' }
            ], { duration: 750, easing: 'ease-out', fill: 'forwards' });
        }
    }
    _damageQueued = 0;
}

// ──────────────────────────────────────────────────────────── UI ─────────────
var minimapCanvas = document.getElementById('minimap');
var mmCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = minimapCanvas.height = 150;

function showFloatingText(text, color, size) {
    var el = document.createElement('div'), top = 34 + Math.random() * 8;
    el.textContent = text;
    el.style.cssText = 'position:absolute;top:'+top+'%;left:50%;transform:translate(-50%,-50%);color:'+color+';font-size:'+size+'px;font-weight:bold;text-shadow:2px 2px 8px #000;pointer-events:none;z-index:1000;transition:opacity 0.4s,top 0.5s';
    document.getElementById('ui-container').appendChild(el);
    setTimeout(function(){el.style.opacity='0';el.style.top=(top-5)+'%';},80);
    setTimeout(function(){el.remove();},700);
}

function showWaveAnnounce(text) {
    var el = document.getElementById('wave-announce'); el.textContent = text; el.classList.remove('hidden');
    clearTimeout(el._t); el._t = setTimeout(function(){el.classList.add('hidden');},2600);
}

function showHitMarker() {
    var hm = document.getElementById('hit-marker'); hm.classList.remove('hidden');
    clearTimeout(hm._t); hm._t = setTimeout(function(){hm.classList.add('hidden');},130);
}

function showDamageOverlay() {
    var ov = document.getElementById('damage-overlay'); ov.classList.remove('hidden');
    clearTimeout(ov._t); ov._t = setTimeout(function(){ov.classList.add('hidden');},300);
}

function updateStarHUD(msLeft) {
    // Se llama cada frame mientras la estrella esta activa: pasa por el cache
    // de nodos en vez de cuatro getElementById por frame.
    var overlay = _el('star-overlay');
    var bar     = _el('star-bar-fill');
    var label   = _el('star-bar-label');
    var hud     = _el('star-hud');
    if (msLeft <= 0) {
        if (overlay) overlay.classList.remove('active');
        if (hud) hud.classList.add('hidden');
        return;
    }
    if (overlay) overlay.classList.add('active');
    if (hud) hud.classList.remove('hidden');
    var pct = Math.max(0, Math.min(100, (msLeft / 8000) * 100));
    if (bar)   bar.style.width = pct + '%';
    if (label) {
        label.textContent = 'ESTRELLA ' + Math.ceil(msLeft / 1000) + 's';
        label.style.color = pct < 30 ? '#ff4400' : '#FFD700';
    }
}

function updateGunGameHUD(level) {
    var container = document.getElementById('gg-hud');
    if (!container) return;
    container.classList.remove('hidden');
    var steps = container.querySelectorAll('.gg-step');
    steps.forEach(function(s, i) {
        s.classList.toggle('done',    i < level);
        s.classList.toggle('current', i === level);
        s.classList.toggle('pending', i > level);
    });
    var nameEl = document.getElementById('gg-weapon-name');
    if (nameEl && GUN_GAME_WEAPONS[level]) nameEl.textContent = GUN_GAME_WEAPONS[level].name;
}

function triggerGunGameWin() {
    playGGWinSound();
    bpTrack('ggWin'); bpTrack('matchEnd', { mode: 'gungame', kills: state.kills });
    document.getElementById('win-kills').textContent = state.totalKills;
    document.getElementById('win-screen').classList.remove('hidden');
    state.isPaused = true; state.isGameOver = true;
    document.exitPointerLock();
    updateTouchUI(); // hide touch controls on win
}

function triggerGameOver() {
    updateTouchUI(); // hide touch controls on game over
    bpTrack('matchEnd', { mode: state.gameMode, kills: state.kills, wave: state.wave });
    stopTutorial();
    var elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    var reached = state.wave;
    var prevBest = globalStats.bestWave;      // récord ANTES de guardar esta partida
    var acc = accuracy();
    saveStats(state.wave, state.totalKills, elapsed);

    // El titular es la comparación con el récord: es lo que hace pulsar reintentar.
    var headline, headClass;
    if (reached - 1 > prevBest) { headline = 'NUEVO RÉCORD · OLEADA ' + reached; headClass = 'record'; }
    else if (prevBest - (reached - 1) <= 1) { headline = 'Llegaste a la ' + reached + ' · tu récord es ' + (prevBest + 1); headClass = 'close'; }
    else { headline = 'Llegaste a la ' + reached + ' · tu récord es ' + (prevBest + 1); headClass = ''; }

    document.getElementById('game-over-stats').innerHTML =
        '<div class="go-headline ' + headClass + '">' + headline + '</div>' +
        '<div class="go-grid">' +
            '<div><span>' + state.totalKills + '</span>Bajas</div>' +
            '<div><span>' + acc + '%</span>Puntería</div>' +
            '<div><span>' + (state.bestStreak || 0) + '</span>Mejor racha</div>' +
            '<div><span>' + formatTime(elapsed) + '</span>Tiempo</div>' +
        '</div>' +
        '<div class="go-diff">' + diffPips() + '  ' + getDiff().name.toUpperCase() + '</div>';
    document.getElementById('game-over').classList.remove('hidden');
    updateUI();
}

function togglePause() {
    if (state.isBuying || state.isGameOver) return;
    state.isPaused = !state.isPaused;
    document.getElementById('pause-menu').classList.toggle('hidden', !state.isPaused);
    if (state.isPaused) {
        document.exitPointerLock();
        updateTouchUI();
    } else {
        requestLock(); // sets mobileActive on mobile, requests lock on desktop
    }
}

function openShop() {
    if (state.gameMode === 'gungame') return;
    notifyTutorial('shop');
    state.isBuying = state.isPaused = true; document.exitPointerLock();
    document.getElementById('crosshair').classList.add('hidden'); populateShop();
    document.getElementById('buy-menu').classList.remove('hidden');
}

function closeShop() {
    state.isBuying = state.isPaused = false;
    document.getElementById('buy-menu').classList.add('hidden');
    requestLock(); // updates crosshair via updateTouchUI on mobile
}

function populateShop() {
    document.getElementById('shop-money').textContent = 'Cash: $' + state.money;

    var list = document.getElementById('weapon-list'); list.innerHTML = '';
    WAVE_SLOTS.forEach(function(id, i) {
        var w=WEAPONS[id], owned=state.owned[id], isCur=state.currentWeapon===id, afford=state.money>=w.price;
        var div=document.createElement('div');
        div.className='weapon-item'+(isCur?' equipped':'')+(!owned&&!afford?' locked':'');
        div.innerHTML='<div class="wname">'+(i+1)+' · '+w.name+'</div>'+
                      '<div class="wstats">DMG '+Math.round(weaponDamage(id))+' &middot; CLIP '+weaponClip(id)+'</div>'+
                      '<div class="wprice">'+(owned?(isCur?'EQUIPADA':'EQUIPAR'):'$'+w.price)+'</div>';
        div.onclick=function(){if(owned)switchWeapon(id);else if(afford)buyWeapon(id);populateShop();};
        list.appendChild(div);
    });

    // Las mejoras son permanentes durante la partida y valen para toda arma.
    var ul = document.getElementById('upgrade-list'); ul.innerHTML = '';
    Object.keys(UPGRADES).forEach(function(key) {
        var u=UPGRADES[key], lvl=state.upgrades[key]||0, maxed=lvl>=u.max;
        var price=upgradePrice(key), afford=state.money>=price;
        var pips=''; for(var k=0;k<u.max;k++) pips += (k<lvl?'\u25B0':'\u25B1');
        var div=document.createElement('div');
        div.className='weapon-item upgrade-item'+(maxed?' equipped':'')+((!maxed&&!afford)?' locked':'');
        div.innerHTML='<div class="wname">'+u.name+'</div>'+
                      '<div class="wstats">'+u.desc+'</div>'+
                      '<div class="upips">'+pips+'</div>'+
                      '<div class="wprice">'+(maxed?'AL MÁXIMO':'$'+price)+'</div>';
        div.onclick=function(){ if(buyUpgrade(key)) populateShop(); };
        ul.appendChild(div);
    });
}

function drawMinimap() {
    var size=150, cx=75, cy=75, range=80;
    mmCtx.clearRect(0,0,size,size);
    mmCtx.save();
    mmCtx.beginPath(); mmCtx.arc(cx,cy,75,0,Math.PI*2); mmCtx.fillStyle='rgba(0,0,0,0.65)'; mmCtx.fill(); mmCtx.clip();
    mmCtx.translate(cx,cy); mmCtx.rotate(-input.yaw);
    coverMeshes.forEach(function(b){
        var k=75/range;
        var dx=(b.position.x-camera.position.x)*k, dz=(b.position.z-camera.position.z)*k;
        var w=b.userData.footprint.w*k, d=b.userData.footprint.d*k;
        mmCtx.fillStyle='rgba(120,140,200,0.4)';
        mmCtx.fillRect(dx-w/2, dz-d/2, Math.max(2,w), Math.max(2,d));
    });
    healthPickups.forEach(function(p){
        var dx=(p.position.x-camera.position.x)*75/range, dz=(p.position.z-camera.position.z)*75/range;
        if(dx*dx+dz*dz<69*69){ mmCtx.fillStyle='#00ff88'; mmCtx.font='bold 11px sans-serif'; mmCtx.textAlign='center'; mmCtx.fillText('+',dx,dz+4); }
    });
    if (starGroup) {
        var sdx=(starGroup.position.x-camera.position.x)*75/range, sdz=(starGroup.position.z-camera.position.z)*75/range;
        if(sdx*sdx+sdz*sdz<69*69){ mmCtx.fillStyle='#FFD700'; mmCtx.font='bold 13px sans-serif'; mmCtx.textAlign='center'; mmCtx.fillText('★',sdx,sdz+5); }
    }
    enemies.forEach(function(e){
        var dx=(e.position.x-camera.position.x)*75/range,dz=(e.position.z-camera.position.z)*75/range,d2=dx*dx+dz*dz;
        var t=e.userData.type||ENEMY_TYPES.recluta;
        if(d2>69*69){var d=Math.sqrt(d2);dx=dx/d*69;dz=dz/d*69;mmCtx.globalAlpha=0.45;}else mmCtx.globalAlpha=1;
        mmCtx.fillStyle=t.hex;
        mmCtx.beginPath();mmCtx.arc(dx,dz,t.boss?7:(t.radius>0.8?5.5:4),0,Math.PI*2);mmCtx.fill();
        mmCtx.globalAlpha=1;
    });
    mmCtx.fillStyle='#00ffcc';mmCtx.beginPath();mmCtx.arc(0,0,5,0,Math.PI*2);mmCtx.fill();
    mmCtx.strokeStyle='#00ffcc';mmCtx.lineWidth=2;mmCtx.beginPath();mmCtx.moveTo(0,0);mmCtx.lineTo(0,-12);mmCtx.stroke();
    mmCtx.restore();
    mmCtx.strokeStyle='rgba(255,255,255,0.28)';mmCtx.lineWidth=2;mmCtx.beginPath();mmCtx.arc(cx,cy,74,0,Math.PI*2);mmCtx.stroke();
}

function updateDifficultyDisplay() {
    var diff = getDiff();
    var el = document.getElementById('diff-display');
    el.textContent = diffPips() + '  ' + diff.name.toUpperCase();
    el.style.color  = diff.color;
    el.style.borderColor = diff.color + '55';
    el.classList.remove('hidden');
}

// Cache de nodos + memo de ultimo valor escrito: tocar el DOM cada frame
// obligaba al navegador a recalcular estilos 15 veces por frame.
var _dom  = {};
var _memo = {};
function _el(id) { var e = _dom[id]; if (!e) { e = _dom[id] = document.getElementById(id); } return e; }
function _text(id, v) { if (_memo['t:'+id] !== v) { _memo['t:'+id] = v; var e=_el(id); if(e) e.textContent = v; } }
function _css(id, prop, v) { var k=id+':'+prop; if (_memo[k] !== v) { _memo[k] = v; var e=_el(id); if(e) e.style[prop] = v; } }
function _hidden(id, v) { var k='h:'+id; if (_memo[k] !== v) { _memo[k] = v; var e=_el(id); if(e) e.classList[v?'add':'remove']('hidden'); } }
function resetUICache() { _memo = {}; }

// La fila de ranuras solo cambia al comprar/equipar. Antes updateUI hacia
// WAVE_SLOTS.map(...).join('') en cada llamada (array + closure por frame);
// ahora se firma el estado de propiedad con una mascara de bits y la cadena
// solo se reconstruye cuando esa mascara cambia.
var _slotsMask = -1, _slotsStr = '';
function waveSlots() {
    var mask = 0;
    for (var i = 0; i < WAVE_SLOTS.length; i++) if (state.owned[WAVE_SLOTS[i]]) mask |= (1 << i);
    if (mask === _slotsMask) return _slotsStr;
    var s = '';
    for (var j = 0; j < WAVE_SLOTS.length; j++) s += state.owned[WAVE_SLOTS[j]] ? (j + 1) : '·';
    _slotsMask = mask; _slotsStr = s;
    return s;
}

function updateUI() {
    var w=WEAPONS[state.currentWeapon], hp=Math.max(0,state.health);
    _css('health-bar', 'width', hp + '%');
    _css('health-bar', 'background', hp > 60 ? '#00ff88' : hp > 30 ? '#ffcc00' : '#ff2200');
    _text('health-label', Math.round(hp));
    _hidden('lowhp-overlay', !(hp > 0 && hp <= LOW_HEALTH) || inMenu);

    if (state.gameMode === 'gungame') {
        _hidden('money-row', true);
        _text('wave-value', 'GUN GAME');
        _text('weapon-value', w.name.toUpperCase() + '  ' + (state.ggLevel+1) + '/10');
        _text('ammo-display', (state.ammo[state.currentWeapon]||0) + ' / ' + w.clip);
        _text('ammo-reserve', '∞');
    } else {
        _hidden('money-row', false);
        _text('money-display', state.money);
        var inf = state.ammoRushEnd > Date.now();
        _text('ammo-display', inf ? '∞' : (state.ammo[state.currentWeapon] + ' / ' + weaponClip(state.currentWeapon)));
        _text('ammo-reserve', inf ? '' : state.reserves[state.currentWeapon]);
        _text('wave-value', 'OLEADA ' + state.wave);
        _text('weapon-value', w.name.toUpperCase()+' ['+waveSlots()+']');
    }
    _text('kill-value', state.kills + ' / ' + state.totalKills);
    updateDashBar();
}

function updateDashBar() {
    var cd=Math.max(0,state.dashCooldown-(Date.now()-state.lastDashTime));
    var el=_dom['dash-cooldown'] || document.getElementById('dash-cooldown');
    if(!el){
        el=document.createElement('div');el.id='dash-cooldown';
        el.style.cssText='position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:200px;height:28px;background:rgba(0,0,0,0.7);border:2px solid rgba(255,255,255,0.4);border-radius:5px;overflow:hidden';
        // scaleX en vez de width: transform no dispara relayout, solo compositor,
        // y sin transition el navegador no retrabaja la capa en cada cambio.
        var fill=document.createElement('div');fill.id='dash-fill';fill.style.cssText='height:100%;width:100%;transform-origin:left center;transform:scaleX(0);will-change:transform';el.appendChild(fill);
        var lbl=document.createElement('div');lbl.id='dash-text';lbl.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:13px;font-weight:bold;text-shadow:1px 1px 2px #000;white-space:nowrap';el.appendChild(lbl);
        document.getElementById('ui-container').appendChild(el);
    }
    _dom['dash-cooldown'] = el;
    if(cd>0){
        _css('dash-fill','transform','scaleX('+(1-cd/state.dashCooldown)+')');
        _css('dash-fill','background','linear-gradient(90deg,#ff4400,#aa0000)');
        _text('dash-text','DASH: '+(cd/1000).toFixed(1)+'s');
    } else {
        _css('dash-fill','transform','scaleX(1)');
        _css('dash-fill','background','linear-gradient(90deg,#00ff88,#00bb55)');
        _text('dash-text','DASH LISTO  [E]');
    }
}

// ──────────────────────────────────────────────────────────── ENEMIES ────────
var enemies = [];

// Recursos compartidos: se crean una sola vez y todos los enemigos los reusan.
// Antes cada spawn creaba 4 geometrias + 3 materiales que nunca se liberaban.
var ENEMY_GEO = {
    head:  new THREE.SphereGeometry(0.3, 8, 8),
    torso: new THREE.BoxGeometry(0.8, 1.2, 0.4),
    leg:   new THREE.BoxGeometry(0.25, 1.2, 0.25)
};
var ENEMY_MAT_HEAD = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
var ENEMY_MAT_LEG  = new THREE.MeshLambertMaterial({ color: 0x333333 });
// Un material por arquetipo, compartido por todas sus instancias.
var ENEMY_MAT_TYPE = (function() {
    var m = {};
    for (var k in ENEMY_TYPES) {
        var t = ENEMY_TYPES[k];
        // El jefe conserva el brillo que antes daba su PointLight, ahora con
        // emissive: se lee igual de luminoso sin coste de luz por pixel.
        m[k] = t.boss
            ? new THREE.MeshLambertMaterial({ color: t.color, emissive: t.color, emissiveIntensity: 0.85 })
            : new THREE.MeshLambertMaterial({ color: t.color });
    }
    return m;
})();

function createHuman(type) {
    var shadows = getQuality().enemyShadows;
    if (window.EnemyModels) return EnemyModels.create(type, shadows);
    var g = new THREE.Group();
    var head = new THREE.Mesh(ENEMY_GEO.head, ENEMY_MAT_HEAD);
    head.position.y = 2.7; head.castShadow = shadows; head.userData = { mult: 2.5 }; g.add(head);
    var torso = new THREE.Mesh(ENEMY_GEO.torso, ENEMY_MAT_TYPE[type.key]);
    torso.position.y = 1.8; torso.castShadow = shadows; torso.userData = { mult: 1.0 }; g.add(torso);
    [-0.2, 0.2].forEach(function(x) {
        var l = new THREE.Mesh(ENEMY_GEO.leg, ENEMY_MAT_LEG);
        l.position.set(x, 0.6, 0); l.castShadow = false; l.userData = { mult: 0.7 }; g.add(l);
    });
    // La silueta es la lectura principal a distancia: se escala el grupo entero,
    // asi que seguimos reusando las mismas cuatro geometrias para todos.
    g.scale.set(type.w, type.h, type.w);
    // El jefe NO lleva PointLight: anadirla en runtime cambia NUM_POINT_LIGHTS y
    // obliga a recompilar TODOS los shaders de la escena (tiron de varios
    // frames). El mismo efecto de "bicho que brilla" se consigue con emissive.
    return g;
}

function spawnEnemy(typeKey, baseHealth, baseSpeed) {
    var type = ENEMY_TYPES[typeKey] || ENEMY_TYPES.recluta;
    var angle=Math.random()*Math.PI*2, dist=28+Math.random()*35;
    var x=Math.max(-MAP_HALF+2,Math.min(MAP_HALF-2,camera.position.x+Math.cos(angle)*dist));
    var z=Math.max(-MAP_HALF+2,Math.min(MAP_HALF-2,camera.position.z+Math.sin(angle)*dist));
    var hp = Math.round(baseHealth * type.hp);
    var e=createHuman(type);
    e.position.set(x,0,z);
    resolveCircle(e.position, type.radius, 0);
    e.userData={
        type: type, health: hp, maxHealth: hp,
        speed: baseSpeed * type.speed, lastAttack: 0,
        walkPhase: Math.random()*Math.PI*2,
        voiceAt: Date.now() + 1500 + Math.random() * 4000,
        orbitDir: Math.random() < 0.5 ? -1 : 1,
        slideT: 0, slideN: { x: 0, z: 0 }, knock: { x: 0, z: 0 }
    };
    scene.add(e); enemies.push(e);
    if (window.WorldFX) WorldFX.column(e.position.x, e.position.z, type.color, 3 * type.h);
    if (window.GameAudio) { locateSound(e.position.x, e.position.z); GameAudio.enemySpawn(_ear.pan, _ear.dist); }
    noteEnemySeen(type);
    if (type.boss) showBossBar(e);
    return e;
}

// Al morir, el enemigo sale de la lista (deja de bloquear balas y de contar
// para la oleada) pero su cuerpo se queda en escena hasta acabar la caida.
function removeEnemy(eg) {
    var i = enemies.indexOf(eg);
    if (i !== -1) enemies.splice(i, 1);
    if (window.EnemyModels && eg.rig) EnemyModels.kill(eg, eg.userData.hitDirX || 0, eg.userData.hitDirZ || 0);
    else scene.remove(eg);
}
function clearEnemies() {
    enemies.forEach(function(e) { scene.remove(e); if (window.EnemyModels) EnemyModels.discard(e); });
    enemies.length = 0;
    if (window.EnemyModels) EnemyModels.clear();
    hideBossBar();
}

function startWave(wave) {
    state.wave=wave; state.kills=0; clearEnemies(); playWaveSound(wave % 5 === 0); showWaveAnnounce('OLEADA '+wave);
    var cfg=waveConfig(wave);
    var mod=waveModifier(wave);
    applyWaveModifier(mod);
    var roster=waveRoster(wave, cfg.count);
    if (wave % 5 === 0)  showWaveAnnounce('OLEADA DE JEFE');
    else if (mod)        showWaveAnnounce(WAVE_MODS[mod].name);
    setTimeout(function(){
        for(var i=0;i<roster.length;i++) spawnEnemy(roster[i], cfg.health, cfg.speed);
    },2500);
}

var ggSpawnTimer = 0;
// El Gun Game mezcla arquetipos ligeros: el jugador cambia de arma cada baja,
// asi que los tanques romperian el ritmo.
var GG_TYPES = ['recluta', 'recluta', 'chacal', 'zumbador'];

function tickGunGameSpawn(delta) {
    var MAX = 5;
    if (enemies.length >= MAX) { ggSpawnTimer = 0; return; }
    ggSpawnTimer += delta;
    if (ggSpawnTimer >= 4) {
        ggSpawnTimer = 0;
        var n = Math.min(3, MAX - enemies.length);
        for (var i=0; i<n; i++) spawnEnemy(GG_TYPES[Math.floor(Math.random()*GG_TYPES.length)], 80, 2.8);
    }
}

var _aiDir = new THREE.Vector3(); // scratch: evita un new Vector3 por enemigo y frame

var STOMP_RANGE = 22;  // a esta distancia se empiezan a notar los pasos pesados
var VOICE_RANGE = 48;

// Los pesos pesados hacen temblar el suelo al acercarse: avisan sin mirar.
function enemyStomp(e, dist) {
    var closeness = 1 - dist / STOMP_RANGE;
    triggerShake(0.012 * closeness);
    if (window.GameAudio) { locateSound(e.position.x, e.position.z); GameAudio.land(0.25 + 0.6 * closeness); }
}

// Cada arquetipo "habla" con su cadencia. El Zumbador zumba mas seguido
// cuanto mas cerca esta: es su cuenta atras.
function enemySpeak(e, t, dist, now) {
    var gap = t.voice || ENEMY_TYPES.recluta.voice;
    var wait = gap[0] + Math.random() * (gap[1] - gap[0]);
    if (t.explode) wait *= Math.max(0.3, Math.min(1, dist / 26));
    e.userData.voiceAt = now + wait * 1000;
    if (dist > VOICE_RANGE || !window.GameAudio) return;
    locateSound(e.position.x, e.position.z);
    GameAudio.enemyVoice(t.key, _ear.pan, _ear.dist);
}

function updateEnemyAI(delta) {
    delta *= enemyTimeScale();
    var now  = Date.now();
    var diff = getDiff();
    var dmg  = state.gameMode === 'gungame' ? 15 : diff.enemyDamage;
    var cd   = state.gameMode === 'gungame' ? 1500 : diff.attackCooldown;

    updateExplosions(delta);
    updateBossBar();

    for (var i = enemies.length - 1; i >= 0; i--) {
        var e=enemies[i], t=e.userData.type || ENEMY_TYPES.recluta;
        var dir=_aiDir.subVectors(camera.position,e.position); dir.y=0; var dist=dir.length();
        var reach = 2.2 + t.radius;   // los grandes alcanzan desde mas lejos

        if (dist > reach) {
            dir.normalize();
            // El Chacal no viene de frente: al entrar en rango medio anade una
            // componente tangencial y te obliga a seguirlo con la mira.
            if (t.behavior === 'orbit' && dist < 26) {
                var strafe = Math.min(0.85, (26 - dist) / 20) * e.userData.orbitDir;
                var ox = dir.x, oz = dir.z;
                dir.x = ox - oz * strafe;
                dir.z = oz + ox * strafe;
                dir.normalize();
            }
            // Rodea las estructuras: si el ultimo paso choco, avanza por la
            // tangente de la pared en vez de empujar contra ella.
            if (e.userData.slideT > 0) {
                e.userData.slideT -= delta;
                var sn = e.userData.slideN, dot = dir.x*sn.x + dir.z*sn.z;
                if (dot < 0) {
                    var tx = dir.x - sn.x*dot, tz = dir.z - sn.z*dot, tl = Math.sqrt(tx*tx + tz*tz);
                    if (tl < 0.25) { tx = -sn.z * e.userData.orbitDir; tz = sn.x * e.userData.orbitDir; tl = 1; }
                    dir.x = tx / tl; dir.z = tz / tl;
                }
            }
            e.position.addScaledVector(dir, e.userData.speed*delta); e.position.y=0;
            e.position.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, e.position.x));
            e.position.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, e.position.z));
            if (resolveCircle(e.position, t.radius, 0)) {
                e.userData.slideN = e.userData.slideN || { x: 0, z: 0 };
                e.userData.slideN.x = _colN.x; e.userData.slideN.z = _colN.z;
                e.userData.slideT = 0.6;
            }
            var stepsBefore = Math.floor(e.userData.walkPhase / Math.PI);
            e.userData.walkPhase += delta * (t.behavior === 'orbit' ? 11 : 7);
            var wp=e.userData.walkPhase;
            if (t.stomp && dist < STOMP_RANGE && Math.floor(wp / Math.PI) !== stepsBefore) enemyStomp(e, dist);
            if (!e.rig) {
                if(e.children[2])e.children[2].rotation.x= Math.sin(wp)*0.35;
                if(e.children[3])e.children[3].rotation.x=-Math.sin(wp)*0.35;
            }
        }
        if (e.rig) EnemyModels.animate(e, delta, dist > reach, dist);
        // Separacion: los enemigos no se apilan en el mismo punto
        for (var j = i - 1; j >= 0; j--) {
            var o = enemies[j], ot = o.userData.type || ENEMY_TYPES.recluta;
            var sx = e.position.x - o.position.x, sz = e.position.z - o.position.z;
            var min = t.radius + ot.radius, sd2 = sx*sx + sz*sz;
            if (sd2 < min*min && sd2 > 1e-6) {
                var sd = Math.sqrt(sd2), push = (min - sd) * 0.5;
                sx /= sd; sz /= sd;
                e.position.x += sx*push; e.position.z += sz*push;
                o.position.x -= sx*push; o.position.z -= sz*push;
            }
        }
        // Retroceso por impacto (se amortigua rapido)
        var kb = e.userData.knock;
        if (kb && (kb.x || kb.z)) {
            e.position.x += kb.x * delta; e.position.z += kb.z * delta;
            var damp = Math.max(0, 1 - delta * 9); kb.x *= damp; kb.z *= damp;
            if (Math.abs(kb.x) + Math.abs(kb.z) < 0.05) kb.x = kb.z = 0;
            resolveCircle(e.position, t.radius, 0);
        }
        e.lookAt(camera.position.x, e.position.y, camera.position.z);
        if (now > e.userData.voiceAt) enemySpeak(e, t, dist, now);
        if (dist < reach + 0.8 && now - e.userData.lastAttack > cd) {
            e.userData.lastAttack = now;
            if (e.rig) EnemyModels.attack(e);
            if (window.GameAudio) { locateSound(e.position.x, e.position.z); GameAudio.enemyAttack(t.key, _ear.pan, _ear.dist); }
            takeDamage(Math.round(dmg * t.dmg));
        }
    }
}

// ─────────────────────────────────────────────────────────── TUTORIAL ───────
// Se aprende jugando: cada paso aparece solo, espera a que hagas ESA accion y
// da paso al siguiente. Solo en la oleada 1 y solo la primera vez.
var TUTORIAL_STEPS = [
    { id: 'move',   desk: 'Muévete con  W A S D',        mob: 'Arrastra el pulgar izquierdo para moverte' },
    { id: 'look',   desk: 'Apunta moviendo el ratón',    mob: 'Arrastra el pulgar derecho para apuntar' },
    { id: 'shoot',  desk: 'Dispara con clic izquierdo',  mob: 'Pulsa el botón de disparo' },
    { id: 'reload', desk: 'Recarga con  R',              mob: 'Pulsa RECARGAR' },
    { id: 'dash',   desk: 'Esquiva con  E  (dash)',      mob: 'Pulsa DASH' },
    { id: 'shop',   desk: 'Abre la armería con  B',      mob: 'Pulsa ARMERÍA' }
];

var tutorial = { active: false, index: -1, shownAt: 0 };

function tutorialSeen() {
    try { return localStorage.getItem('shooter_tutorial_done') === '1'; } catch(e) { return false; }
}

function startTutorial() {
    if (state.gameMode !== 'normal' || tutorialSeen()) { tutorial.active = false; return; }
    tutorial.active = true;
    tutorial.index  = -1;
    setTimeout(nextTutorialStep, 1200);
}

function nextTutorialStep() {
    if (!tutorial.active) return;
    tutorial.index++;
    var el = document.getElementById('tutorial-hint');
    if (!el) return;
    if (tutorial.index >= TUTORIAL_STEPS.length) {
        tutorial.active = false;
        try { localStorage.setItem('shooter_tutorial_done', '1'); } catch(e) {}
        el.textContent = 'Listo. Sobrevive.';
        setTimeout(function(){ el.classList.add('hidden'); }, 1800);
        return;
    }
    var step = TUTORIAL_STEPS[tutorial.index];
    el.textContent = isMobile ? step.mob : step.desk;
    el.classList.remove('hidden');
    tutorial.shownAt = Date.now();
}

// El paso solo se da por hecho si el jugador lo ejecuta despues de leerlo:
// medio segundo de gracia evita que una accion en curso salte dos pasos.
function notifyTutorial(id) {
    if (!tutorial.active || tutorial.index < 0) return;
    var step = TUTORIAL_STEPS[tutorial.index];
    if (!step || step.id !== id) return;
    if (Date.now() - tutorial.shownAt < 500) return;
    var el = document.getElementById('tutorial-hint');
    if (el) el.classList.add('hidden');
    setTimeout(nextTutorialStep, 700);
}

function stopTutorial() {
    tutorial.active = false;
    var el = document.getElementById('tutorial-hint');
    if (el) el.classList.add('hidden');
}

// ────────────────────────────────────────────────────── FICHAS (CODEX) ──────
var codex = (function() {
    try { return JSON.parse(localStorage.getItem('shooter_codex') || '{}'); }
    catch(e) { return {}; }
})();
var _cardQueue = [], _cardBusy = false;

function noteEnemySeen(type) {
    if (codex[type.key]) return;
    codex[type.key] = true;
    try { localStorage.setItem('shooter_codex', JSON.stringify(codex)); } catch(e) {}
    _cardQueue.push(type);
    _flushCardQueue();
}

// Las fichas se encolan: si en una oleada aparecen dos arquetipos nuevos a la
// vez, se leen una detras de otra en vez de pisarse.
function _flushCardQueue() {
    if (_cardBusy || !_cardQueue.length) return;
    var type = _cardQueue.shift();
    var el = document.getElementById('enemy-card');
    if (!el) return;
    _cardBusy = true;
    var hex = '#' + ('000000' + type.color.toString(16)).slice(-6);
    document.getElementById('card-name').textContent = type.name;
    document.getElementById('card-desc').textContent = type.desc;
    document.getElementById('card-chip').style.background = hex;
    el.style.borderColor = hex;
    el.classList.remove('hidden');
    setTimeout(function() {
        el.classList.add('hidden');
        _cardBusy = false;
        _flushCardQueue();
    }, 3600);
}

// ─────────────────────────────────────────────────────── EXPLOSIONES ────────
var explosions = [];
var EXPLOSION_GEO = new THREE.SphereGeometry(1, 12, 12);

function spawnExplosion(x, z, radius, color) {
    var mat  = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.55 });
    var mesh = new THREE.Mesh(EXPLOSION_GEO, mat);
    mesh.position.set(x, 1.2, z);
    mesh.scale.setScalar(0.4);
    scene.add(mesh);
    explosions.push({ mesh: mesh, mat: mat, life: 0, radius: radius });
    if (window.WorldFX) WorldFX.explosion(x, 1.2, z, radius, color);
}

// La esfera crece hasta el radio real del daño y se desvanece: el jugador
// aprende de un vistazo hasta donde llegaba la explosion que le pego.
function updateExplosions(delta) {
    for (var i = explosions.length - 1; i >= 0; i--) {
        var ex = explosions[i];
        ex.life += delta;
        var k = ex.life / 0.45;
        if (k >= 1) {
            scene.remove(ex.mesh); ex.mat.dispose(); explosions.splice(i, 1); continue;
        }
        ex.mesh.scale.setScalar(0.4 + k * ex.radius);
        ex.mat.opacity = 0.55 * (1 - k);
    }
}

function detonate(eg) {
    var t = eg.userData.type, ex = t.explode;
    spawnExplosion(eg.position.x, eg.position.z, ex.radius, t.color);
    playExplosionSound();
    var dx = camera.position.x - eg.position.x;
    var dz = camera.position.z - eg.position.z;
    var d  = Math.sqrt(dx*dx + dz*dz);
    if (d < ex.radius) {
        // Daño con caida lineal: pegado al bicho duele el doble que en el borde.
        var falloff = 1 - (d / ex.radius) * 0.5;
        takeDamage(Math.round(ex.damage * falloff));
        triggerShake(0.05);
    }
}

// ───────────────────────────────────────────────────────── BARRA DE JEFE ────
var bossRef = null;

function showBossBar(eg) {
    bossRef = eg;
    var wrap = document.getElementById('boss-bar');
    if (wrap) {
        _text('boss-name', eg.userData.type.name);
        wrap.classList.remove('hidden');
    }
}

function hideBossBar() {
    bossRef = null;
    var wrap = document.getElementById('boss-bar');
    if (wrap) wrap.classList.add('hidden');
}

function updateBossBar() {
    if (!bossRef) return;
    if (enemies.indexOf(bossRef) === -1) { hideBossBar(); return; }
    var u = bossRef.userData;
    _css('boss-fill', 'width', Math.max(0, u.health / u.maxHealth * 100) + '%');
}

// ──────────────────────────────────────────────────── HEALTH PICKUPS ─────────
var healthPickups = [];
var pickupNearNotified = false;

// Sin PointLight: cada botiquin encendia una luz nueva en la escena (y al
// quitarla, recompilacion de shaders). El emissive mas alto mantiene la
// lectura de "esto brilla en verde" sin pagar el coste por pixel.
var PICKUP_MAT    = new THREE.MeshLambertMaterial({ color: 0x00ff55, emissive: 0x00cc44, emissiveIntensity: 1.8 });
var PICKUP_GEO_H  = new THREE.BoxGeometry(0.55, 0.14, 0.14);
var PICKUP_GEO_V  = new THREE.BoxGeometry(0.14, 0.55, 0.14);

var HEAL_COLOR = 0x00ff66, HEAL_HOVER = 0.9;

function createHealthPickupMesh() {
    if (window.WorldFX) {
        var kit = WorldFX.medkit();
        kit.add(WorldFX.beacon(HEAL_COLOR, HEAL_HOVER));
        return kit;
    }
    var g   = new THREE.Group();
    var mat = PICKUP_MAT;
    var hBar = new THREE.Mesh(PICKUP_GEO_H, mat);
    var vBar = new THREE.Mesh(PICKUP_GEO_V, mat);
    // El botiquin es un objeto pequeno y disperso: su sombra sobre el suelo no
    // aporta lectura y si cuesta una pasada extra del shadow map en movil.
    hBar.castShadow = vBar.castShadow = false;
    g.add(hBar); g.add(vBar);
    return g;
}

function spawnHealthPickup(x, z) {
    var pickup = createHealthPickupMesh();
    pickup.position.set(x, HEAL_HOVER, z);
    pickup.userData = { phase: Math.random() * Math.PI * 2, spawnTime: Date.now() };
    scene.add(pickup);
    healthPickups.push(pickup);
}

function clearHealthPickups() {
    healthPickups.forEach(function(p){ scene.remove(p); });
    healthPickups.length = 0;
}

function updateHealthPickups(delta) {
    var diff    = getDiff();
    var now     = Date.now();
    var nearest = Infinity;

    for (var i = healthPickups.length - 1; i >= 0; i--) {
        var p = healthPickups[i];
        p.userData.phase += delta * 2.2;
        p.rotation.y     += delta * 1.8;
        p.position.y      = HEAL_HOVER + Math.sin(p.userData.phase) * 0.18;

        if (now - p.userData.spawnTime > 18000) {
            scene.remove(p); healthPickups.splice(i, 1); continue;
        }

        var dx = camera.position.x - p.position.x;
        var dz = camera.position.z - p.position.z;
        var distSq = dx * dx + dz * dz;
        if (distSq < nearest) nearest = distSq;

        if (distSq < 2.5 * 2.5) {
            var healed = Math.min(diff.healAmount, 100 - state.health);
            if (healed > 0) {
                state.health = Math.min(100, state.health + diff.healAmount);
                showFloatingText('+' + healed + ' HP', '#00ff88', 38);
                playHealSound(); updateUI();
            } else {
                showFloatingText('¡Salud completa!', '#88ff88', 24);
            }
            collectFx(p.position, HEAL_COLOR);
            scene.remove(p); healthPickups.splice(i, 1);
            pickupNearNotified = false;
        }
    }

    // El aviso se crea la primera vez y se reutiliza: el getElementById de
    // este bloque se ejecutaba en cada frame mientras no hubiera botiquín
    // cerca (justo cuando el elemento aún no existe y devolvía null).
    var hint = _el('health-pickup-hint');
    if (nearest < 64 && state.health < 100 && healthPickups.length > 0) {
        if (!hint) {
            hint = document.createElement('div'); hint.id = 'health-pickup-hint';
            hint.textContent = 'BOTIQUÍN CERCA';
            _el('ui-container').appendChild(hint);
            _dom['health-pickup-hint'] = hint;
        }
        if (hint.style.display !== 'block') hint.style.display = 'block';
        if (!pickupNearNotified) { playPickupNearSound(); pickupNearNotified = true; }
    } else {
        if (hint && hint.style.display !== 'none') hint.style.display = 'none';
        pickupNearNotified = false;
    }
}

// ─────────────────────────────────────────────────────────── POWER-UPS ──────
// Recogibles cortos que cambian la regla del combate durante unos segundos.
// Comparten cuerpo (un octaedro giratorio) y solo cambian color y efecto.
var POWERUPS = {
    ammo:   { name: 'MUNICIÓN INFINITA', color: 0x00bfff, duration: 9000,
              apply: function() { state.ammoRushEnd = Date.now() + 9000; state.isReloading = false;
                                  document.getElementById('reload-indicator').classList.add('hidden'); } },
    slowmo: { name: 'CÁMARA LENTA',      color: 0xff2e88, duration: 7000,
              apply: function() { state.slowmoEnd = Date.now() + 7000; } }
};

var powerups = [];
var POWERUP_GEO = new THREE.OctahedronGeometry(0.55);
var POWERUP_MATS = (function() {
    var m = {};
    for (var k in POWERUPS) m[k] = new THREE.MeshLambertMaterial({ color: POWERUPS[k].color, emissive: POWERUPS[k].color, emissiveIntensity: 0.9 });
    return m;
})();

function spawnPowerup(kind, x, z) {
    if (powerups.length >= 3) return;
    var mesh = new THREE.Mesh(POWERUP_GEO, POWERUP_MATS[kind]);
    mesh.position.set(x, 1.3, z);
    mesh.userData = { kind: kind, phase: Math.random() * 6.28, born: Date.now() };
    if (window.WorldFX) mesh.add(WorldFX.beacon(POWERUPS[kind].color, 1.3));
    scene.add(mesh);
    powerups.push(mesh);
}

// Columna de chispas y onda en el suelo al recoger cualquier objeto.
function collectFx(pos, color) {
    if (!window.WorldFX) return;
    WorldFX.column(pos.x, pos.z, color, 5);
    WorldFX.ring(pos.x, pos.z, color, 3);
}

function clearPowerups() {
    powerups.forEach(function(p) { scene.remove(p); });
    powerups.length = 0;
}

function updatePowerups(delta) {
    var now = Date.now();
    for (var i = powerups.length - 1; i >= 0; i--) {
        var p = powerups[i];
        p.rotation.y += delta * 2.2;
        p.userData.phase += delta * 2.6;
        p.position.y = 1.3 + Math.sin(p.userData.phase) * 0.22;

        if (now - p.userData.born > 20000) { scene.remove(p); powerups.splice(i, 1); continue; }

        var dx = camera.position.x - p.position.x, dz = camera.position.z - p.position.z;
        if (dx*dx + dz*dz < 6.25) {
            var def = POWERUPS[p.userData.kind];
            def.apply();
            playPowerupSound();
            showFloatingText(def.name, '#' + ('000000'+def.color.toString(16)).slice(-6), 34);
            collectFx(p.position, def.color);
            scene.remove(p); powerups.splice(i, 1);
            updateUI();
        }
    }
}

// Factor de tiempo para los enemigos: la cámara lenta solo los frena a ellos,
// el jugador se sigue moviendo a velocidad normal (por eso se siente potente).
function enemyTimeScale() { return state.slowmoEnd > Date.now() ? 0.4 : 1; }

function tickBuffs() {
    var now = Date.now();
    var el = _el('buff-row');
    if (!el) return;
    // Camino rapido: sin buffs activos se sale sin construir arrays, strings
    // ni HTML. Solo hay que acordarse de que la fila este vacia.
    var ammoMs = state.ammoRushEnd - now;
    var slowMs = state.slowmoEnd  - now;
    if (ammoMs <= 0 && slowMs <= 0) {
        if (el.dataset.sig !== '') {
            el.dataset.sig = '';
            el.classList.add('hidden');
            el.innerHTML = '';
        }
        return;
    }
    var sig = '', html = '';
    if (ammoMs > 0) {
        var a = Math.ceil(ammoMs / 1000);
        sig += 'MUNICIÓN' + a;
        html += '<div class="buff" style="border-color:#00bfff;color:#00bfff">MUNICIÓN ' + a + 's</div>';
    }
    if (slowMs > 0) {
        var s = Math.ceil(slowMs / 1000);
        if (sig) sig += '|';
        sig += 'LENTITUD' + s;
        html += '<div class="buff" style="border-color:#ff2e88;color:#ff2e88">LENTITUD ' + s + 's</div>';
    }
    if (sig === el.dataset.sig) return;   // solo se redibuja cuando cambia el segundo
    el.dataset.sig = sig;
    el.classList.remove('hidden');
    el.innerHTML = html;
}

// ──────────────────────────────────────────────────────── STAR PICKUP ────────
var starGroup = null;
var starAutoTimer = 60;

// Geometrias y materiales compartidos: la estrella aparece y desaparece cada
// pocos minutos y antes creaba las suyas cada vez (nunca liberadas).
// MeshLambertMaterial + emissive en vez de MeshStandardMaterial: el brillo es
// practicamente el mismo y evita el programa PBR mas caro de la escena.
var STAR_GEO_CORE = new THREE.SphereGeometry(0.38, 14, 14);
var STAR_GEO_RING = new THREE.TorusGeometry(0.65, 0.07, 8, 28);
var STAR_MAT_CORE = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 1.8 });
var STAR_MAT_RING = new THREE.MeshLambertMaterial({ color: 0xFFFF44, emissive: 0xFFFF00, emissiveIntensity: 1.4 });

var STAR_COLOR = 0xFFD700, STAR_HOVER = 1.6;

function spawnStar(x, z) {
    if (starGroup) return;
    starGroup = new THREE.Group();

    var core = new THREE.Mesh(window.WorldFX ? WorldFX.starGeometry() : STAR_GEO_CORE, STAR_MAT_CORE);
    starGroup.add(core);
    if (window.WorldFX) starGroup.add(WorldFX.beacon(STAR_COLOR, STAR_HOVER));

    var ring = new THREE.Mesh(STAR_GEO_RING, STAR_MAT_RING);
    ring.rotation.x = Math.PI / 2.8; ring.name = 'ring';
    starGroup.add(ring);
    // Sin PointLight propia por el mismo motivo que el jefe y los botiquines.

    starGroup.position.set(x, 1.6, z);
    scene.add(starGroup);
}

function removeStar() {
    // Solo se quita el grupo: geometrias y materiales son compartidos y no
    // deben liberarse aqui.
    if (starGroup) { scene.remove(starGroup); starGroup = null; }
}

function updateStarPickup(delta) {
    // Auto-spawn every 60 seconds if no star exists and player doesn't have one active
    if (!starGroup && !state.starActive) {
        starAutoTimer -= delta;
        if (starAutoTimer <= 0) {
            starAutoTimer = 60;
            var angle = Math.random() * Math.PI * 2;
            spawnStar(camera.position.x + Math.cos(angle) * 14, camera.position.z + Math.sin(angle) * 14);
        }
    }

    if (!starGroup) return;

    // Animate
    starGroup.rotation.y += delta * 2.8;
    starGroup.position.y = 1.6 + Math.sin(Date.now() * 0.003) * 0.32;
    var ring = starGroup.getObjectByName('ring');
    if (ring) ring.rotation.z += delta * 3.5;

    // Pickup check (distance < 2.5)
    var dx = starGroup.position.x - camera.position.x;
    var dz = starGroup.position.z - camera.position.z;
    if (dx * dx + dz * dz < 6.25) {
        collectFx(starGroup.position, STAR_COLOR);
        removeStar();
        state.starActive  = true;
        state.starEndTime = Date.now() + 8000;
        starAutoTimer = 60;
        playStarSound();
        showFloatingText('ESTRELLA · INVULNERABLE', '#FFD700', 34);
    }
}

function tickStarPower() {
    if (!state.starActive) return;
    var msLeft = state.starEndTime - Date.now();
    updateStarHUD(msLeft);
    if (msLeft <= 0) {
        state.starActive = false;
        state.starEndTime = 0;
        updateStarHUD(0);
    }
}

// ──────────────────────────────────────────────────────────── COMBAT ─────────
var raycaster = new THREE.Raycaster();
// El disparo siempre va por el centro de la pantalla: un Vector2 reutilizable
// evita crear un objeto por disparo (que en automatico son varios por segundo).
var _centerNDC = new THREE.Vector2(0, 0);

function doMuzzleFlash() {
    muzzleFlash.intensity=4; setTimeout(function(){muzzleFlash.intensity=0;},60);
    weaponGroup.position.z=-0.42; setTimeout(function(){weaponGroup.position.z=-0.6;},90);
    triggerShake(SHAKE_BY_WEAPON[state.currentWeapon] || 0.008);
}

function advanceGunGame() {
    if (state.ggLevel >= GUN_GAME_WEAPONS.length - 1) {
        triggerGunGameWin();
        return;
    }
    state.ggLevel++;
    bpTrack('ggLevel', { level: state.ggLevel + 1 });
    var next = GUN_GAME_WEAPONS[state.ggLevel];
    state.currentWeapon = next.id;
    state.ammo[next.id] = next.clip;
    state.isReloading   = false;
    document.getElementById('reload-indicator').classList.add('hidden');
    createWeaponModel(next.id);
    showFloatingText(next.name, '#FFD700', 44);
    updateGunGameHUD(state.ggLevel);
    updateUI();
}

function onEnemyKilled(eg) {
    var pos  = { x: eg.position.x, z: eg.position.z };
    var type = eg.userData.type || ENEMY_TYPES.recluta;
    if (type.explode) detonate(eg);
    if (type.boss) { hideBossBar(); triggerShake(0.06); playGGWinSound(); }
    if (window.GameAudio) { locateSound(pos.x, pos.z); GameAudio.enemyDeath(type.key, _ear.pan, _ear.dist); }
    removeEnemy(eg);
    state.kills++; state.totalKills++;
    bpTrack('kill', { weapon: state.currentWeapon, headshot: (eg.userData.lastMult || 1) >= 2, enemy: type.key, boss: !!type.boss, mode: state.gameMode });

    if (state.gameMode === 'gungame') {
        advanceGunGame();
        if (!starGroup && Math.random() < 0.20) spawnStar(pos.x, pos.z);
    } else {
        state.money += type.money;
        showFloatingText('+$' + type.money, type.boss ? '#ffcc00' : '#ffd700', type.boss ? 46 : 28);
        var diff = getDiff();
        if (activeMod !== 'sinKits' && Math.random() < diff.dropChance) {
            spawnHealthPickup(pos.x, pos.z);
            showFloatingText('BOTIQUÍN', '#00ff88', 22);
        }
        if (!starGroup && Math.random() < 0.15) spawnStar(pos.x, pos.z);
        else if (Math.random() < 0.10) spawnPowerup(Math.random() < 0.5 ? 'ammo' : 'slowmo', pos.x, pos.z);
        if (enemies.length === 0) {
            showWaveAnnounce('¡OLEADA ' + state.wave + ' COMPLETADA!');
            if (window.GameAudio) GameAudio.waveClear();
            bpTrack('wave', { wave: state.wave });
            setTimeout(function(){ startWave(state.wave + 1); }, 3000);
        }
    }
}

var _shotDir = new THREE.Vector3(), _shotOrigin = new THREE.Vector3(), _muzzle = new THREE.Vector3();
var _tmpV = new THREE.Vector3(), _tmpN = new THREE.Vector3();
var rockets = [];

function enemyGroupOf(obj) {
    while (obj.parent && obj.parent !== scene) obj = obj.parent;
    return (obj.userData && obj.userData.health !== undefined) ? obj : null;
}

// Aplica dano a un enemigo; devuelve true si murio.
function damageEnemy(grp, dmg, mult, dirX, dirZ, push) {
    if (grp.userData.health <= 0) return false;
    grp.userData.health -= dmg * mult;
    grp.userData.lastMult = mult;
    grp.userData.hitDirX = dirX; grp.userData.hitDirZ = dirZ;
    if (grp.rig) EnemyModels.hit(grp, mult);
    queueDamageNumber(grp, dmg * mult, mult >= 2);
    if (window.GameAudio) { locateSound(grp.position.x, grp.position.z); GameAudio.enemyHit(_ear.pan, _ear.dist); }
    if (push && grp.userData.knock) {
        var k = push * 6 / Math.max(0.6, (grp.userData.type || ENEMY_TYPES.recluta).w);
        grp.userData.knock.x += dirX * k; grp.userData.knock.z += dirZ * k;
    }
    if (grp.userData.health <= 0) { onEnemyKilled(grp); return true; }
    return false;
}

// Un rayo desde la camara con dispersion. Las paredes bloquean la bala;
// la perforacion atraviesa varios enemigos en linea.
function castBullet(id, b, dmg) {
    var spread = b.spread || 0;
    if (input.moving) spread *= 1.6;
    if (state.isJumping) spread *= 1.8;
    camera.getWorldDirection(_shotDir);
    if (spread > 0) {
        _shotDir.x += (Math.random() - 0.5) * 2 * spread;
        _shotDir.y += (Math.random() - 0.5) * 2 * spread;
        _shotDir.z += (Math.random() - 0.5) * 2 * spread;
        _shotDir.normalize();
    }
    camera.getWorldPosition(_shotOrigin);
    raycaster.set(_shotOrigin, _shotDir);
    raycaster.far = 220;
    var hits = raycaster.intersectObjects(shootTargets(), true);
    var pierce = b.pierce || 1, hitAny = false, headshot = false, endPoint = null;
    for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        if (h.object.userData.solid) {
            endPoint = h.point;
            if (window.WeaponFX && h.face) { _tmpN.copy(h.face.normal).transformDirection(h.object.matrixWorld); WeaponFX.impact(h.point, _tmpN, 'wall'); }
            break;
        }
        var grp = enemyGroupOf(h.object);
        if (!grp || grp.userData.health <= 0 || grp.userData._hitThisShot === state.shotsFired) continue;
        grp.userData._hitThisShot = state.shotsFired;
        var mult = h.object.userData.mult || 1.0;
        if (mult >= 2.0) headshot = true;
        hitAny = true;
        if (window.WeaponFX) WeaponFX.impact(h.point, _shotDir, 'flesh');
        damageEnemy(grp, dmg, mult, _shotDir.x, _shotDir.z, b.push || 0.35);
        endPoint = h.point;
        if (--pierce <= 0) break;
    }
    if (window.WeaponFX) {
        WeaponFX.muzzleWorld(_muzzle);
        if (!endPoint) endPoint = _tmpV.copy(_shotOrigin).addScaledVector(_shotDir, 120);
        WeaponFX.tracer(_muzzle, endPoint, id);
    }
    return { hit: hitAny, headshot: headshot };
}

// Un enemigo articulado son diez mallas: se descarta entero si el rayo ni roza
// la esfera que lo envuelve, antes de probarlo pieza por pieza. Requiere que
// raycaster.set() se haya llamado antes que shootTargets().
var ENEMY_BOUND_RADIUS = 2.6, ENEMY_BOUND_CENTER = 1.6;
var _boundCenter = new THREE.Vector3();
function rayNearEnemy(e) {
    var type = e.userData.type || ENEMY_TYPES.recluta;
    var radius = ENEMY_BOUND_RADIUS * Math.max(type.w, type.h);
    _boundCenter.set(e.position.x, ENEMY_BOUND_CENTER * type.h, e.position.z);
    return raycaster.ray.distanceSqToPoint(_boundCenter) <= radius * radius;
}

var _targets = [];
function shootTargets() {
    _targets.length = 0;
    for (var i = 0; i < enemies.length; i++) if (rayNearEnemy(enemies[i])) _targets.push(enemies[i]);
    for (var j = 0; j < coverMeshes.length; j++) _targets.push(coverMeshes[j]);
    _targets.push(ground);
    return _targets;
}

// Bate: golpe en cono corto frente al jugador; pega al enemigo mas cercano.
function meleeSwing(dmg, b) {
    camera.getWorldDirection(_shotDir); _shotDir.y = 0; _shotDir.normalize();
    var best = null, bestD = b.melee;
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        var dx = e.position.x - camera.position.x, dz = e.position.z - camera.position.z;
        var d = Math.sqrt(dx*dx + dz*dz) - (e.userData.type || ENEMY_TYPES.recluta).radius;
        if (d > bestD) continue;
        if ((dx*_shotDir.x + dz*_shotDir.z) / Math.max(0.01, d + 0.6) < 0.5) continue;
        best = e; bestD = d;
    }
    if (!best) return { hit: false };
    if (window.GunAudio) GunAudio.impact('flesh');
    damageEnemy(best, dmg, 1, _shotDir.x, _shotDir.z, b.push);
    return { hit: true };
}

function fireRocket(dmg, b) {
    camera.getWorldDirection(_shotDir);
    var from = new THREE.Vector3();
    if (window.WeaponFX) WeaponFX.muzzleWorld(from); else camera.getWorldPosition(from);
    var r = window.WeaponFX ? WeaponFX.rocket(from, _shotDir.clone(), b.rocket.speed)
                            : { mesh: null, pos: from, dir: _shotDir.clone(), speed: b.rocket.speed, alive: true };
    r.dmg = dmg; r.radius = b.rocket.radius; r.life = 4;
    rockets.push(r);
}

function explodeAt(x, y, z, radius, dmg) {
    spawnExplosion(x, z, radius, 0xff6622);
    if (window.GunAudio) GunAudio.explosion(); else playExplosionSound();
    triggerShake(0.05);
    for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        var dx = e.position.x - x, dz = e.position.z - z, d = Math.sqrt(dx*dx + dz*dz);
        if (d > radius + (e.userData.type || ENEMY_TYPES.recluta).radius) continue;
        var f = 1 - Math.min(1, d / radius) * 0.6;
        state.shotsHit++;
        damageEnemy(e, dmg * f, 1, dx / (d || 1), dz / (d || 1), 2.2);
    }
    var pdx = camera.position.x - x, pdz = camera.position.z - z;
    var pd = Math.sqrt(pdx*pdx + pdz*pdz);
    if (pd < radius * 0.6 && state.gameMode !== 'gungame') takeDamage(Math.round(20 * (1 - pd / (radius * 0.6))));
}

function updateRockets(delta) {
    for (var i = rockets.length - 1; i >= 0; i--) {
        var r = rockets[i];
        var step = r.speed * delta;
        r.life -= delta;
        raycaster.set(r.pos, r.dir); raycaster.far = step + 0.4;
        var hits = raycaster.intersectObjects(shootTargets(), true);
        var boom = hits.length ? hits[0].point : null;
        if (!boom) {
            r.pos.addScaledVector(r.dir, step);
            if (r.mesh) r.mesh.position.copy(r.pos);
            if (r.life <= 0 || r.pos.y < 0) boom = r.pos;
        }
        if (boom) {
            explodeAt(boom.x, boom.y, boom.z, r.radius, r.dmg);
            if (window.WeaponFX) WeaponFX.removeRocket(r);
            rockets.splice(i, 1);
        }
    }
}

function clearRockets() {
    rockets.forEach(function(r) { if (window.WeaponFX) WeaponFX.removeRocket(r); });
    rockets.length = 0;
}

function fireWeapon() {
    if(state.isReloading||state.isPaused||state.isGameOver)return;
    var now=Date.now(), id=state.currentWeapon, w=WEAPONS[id], b=ballistics(id);
    if(now-state.lastFireTime<w.fireRate)return;
    var infinite = state.ammoRushEnd > now;
    if(!b.melee && !infinite && state.ammo[id]<=0){
        if (window.GunAudio && now - state.lastFireTime > 250) { GunAudio.dry(); state.lastFireTime = now; }
        reloadWeapon(); return;
    }
    state.lastFireTime=now; notifyTutorial('shoot');
    if(!b.melee && !infinite) state.ammo[id]--;
    state.shotsFired++;
    playShootSound(id); doMuzzleFlash();
    if (window.WeaponFX) WeaponFX.fire(id);

    var dmg = weaponDamage(id), res = { hit: false, headshot: false };
    if (b.melee) res = meleeSwing(dmg, b);
    else if (b.rocket) fireRocket(dmg, b);
    else {
        // Cada perdigon hace 1/4 del dano base: a quemarropa entran todos
        // (x2.25), a distancia la dispersion deja pasar pocos.
        var pellets = b.pellets || 1, per = pellets > 1 ? dmg * 0.25 : dmg;
        for (var p = 0; p < pellets; p++) {
            var r = castBullet(id, b, per);
            if (r.hit) res.hit = true;
            if (r.headshot) res.headshot = true;
        }
    }
    if (res.hit) {
        showHitMarker();
        state.shotsHit++; state.streak++;
        if(state.streak>state.bestStreak)state.bestStreak=state.streak;
        bpTrack('streak', { n: state.streak });
        if(res.headshot){showFloatingText('HEADSHOT!','#ff2200',50);playHeadshotSound();}
    } else if (!b.rocket) {
        state.streak = 0;
    }
    if(!b.melee&&!infinite&&state.ammo[id]===0&&state.reserves[id]>0)setTimeout(reloadWeapon,250);
    updateUI();
}

function reloadWeapon() {
    if(state.isReloading)return;
    if(state.ammoRushEnd>Date.now())return;   // munición infinita: no hace falta
    var id=state.currentWeapon, need=weaponClip(id)-state.ammo[id];
    if(need<=0||state.reserves[id]<=0)return;
    state.isReloading=true; notifyTutorial('reload');
    document.getElementById('reload-indicator').classList.remove('hidden'); playReloadSound(id);
    if (window.WeaponFX && WeaponFX.reload) WeaponFX.reload(weaponReload(id));
    setTimeout(function(){
        if(!state.isReloading)return;
        var take=Math.min(need,state.reserves[id]);
        state.ammo[id]+=take; state.reserves[id]-=take;
        state.isReloading=false; document.getElementById('reload-indicator').classList.add('hidden'); updateUI();
    }, weaponReload(id));
}

function switchWeapon(id) {
    if(state.isPaused||state.isBuying||state.isGameOver)return;
    if(state.gameMode!=='gungame' && (!state.owned[id]||state.currentWeapon===id))return;
    if(state.currentWeapon===id)return;
    state.currentWeapon=id; state.isReloading=false; document.getElementById('reload-indicator').classList.add('hidden');
    createWeaponModel(id); updateUI();
    if (window.GameAudio) GameAudio.equip();
}

function buyWeapon(id) {
    if(state.gameMode==='gungame')return;
    var w=WEAPONS[id]; if(state.money<w.price||state.owned[id])return;
    state.money-=w.price; state.owned[id]=true; state.currentWeapon=id;
    state.ammo[id]=weaponClip(id); state.reserves[id]=w.maxAmmo-w.clip;
    createWeaponModel(id); updateUI(); playBuySound();
}

function takeDamage(amount) {
    if(state.isGameOver)return;
    if(state.starActive)return; // invulnerable!
    state.health=Math.max(0,state.health-amount); playDamageSound(); showDamageOverlay(); triggerShake(0.042);
    if(state.health<=0){playDeathSound();startDeathFall();state.isPaused=state.isGameOver=true;document.exitPointerLock();triggerGameOver();}
    else updateUI();
}

// ──────────────────────────────────────── TOUCH INPUT (directo en game.js) ───
// Maneja joystick (izquierda) y look swipe (derecha) sin depender de scripts externos.
var _tMov   = { x: 0, y: 0 };       // output del joystick
var _tLId   = null, _tLSX = 0, _tLSY = 0;  // touch izquierdo
var _tRId   = null, _tRLX = 0, _tRLY = 0;  // touch derecho
var JOY_PX  = 72; // radio máximo del joystick en px

// Estos listeners se activan siempre pero solo procesan si mobileActive
document.addEventListener('touchstart', function (e) {
    if (inMenu || !mobileActive) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.clientX < window.innerWidth * 0.5) {
            if (_tLId === null) { _tLId = t.identifier; _tLSX = t.clientX; _tLSY = t.clientY; _tMov.x = 0; _tMov.y = 0; }
        } else {
            if (_tRId === null) { _tRId = t.identifier; _tRLX = t.clientX; _tRLY = t.clientY; }
        }
    }
}, { passive: true });

document.addEventListener('touchmove', function (e) {
    if (inMenu || !mobileActive) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === _tLId) {
            var dx = t.clientX - _tLSX, dy = t.clientY - _tLSY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 12) { _tMov.x = 0; _tMov.y = 0; }
            else { var ang = Math.atan2(dy, dx), cl = Math.min(dist, JOY_PX); _tMov.x = Math.cos(ang) * (cl / JOY_PX); _tMov.y = Math.sin(ang) * (cl / JOY_PX); }
        }
        if (t.identifier === _tRId) {
            var ts = (settings.touchSensitivity || 1.0) * 0.004;
            input.yaw   -= (t.clientX - _tRLX) * ts;
            input.pitch -= (t.clientY - _tRLY) * ts;
            input.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, input.pitch));
            _tRLX = t.clientX; _tRLY = t.clientY;
            notifyTutorial('look');
        }
    }
}, { passive: true });

function _touchEnd(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        if (id === _tLId) { _tLId = null; _tMov.x = 0; _tMov.y = 0; }
        if (id === _tRId) { _tRId = null; }
    }
}
document.addEventListener('touchend',    _touchEnd, { passive: true });
document.addEventListener('touchcancel', _touchEnd, { passive: true });

// ────────────────────────────────────────── GAME STATE MANAGER ───────────────
var inMenu      = true;
var gameStarted = false;
var menuCamAngle = 0;

// ── Mobile detection ──────────────────────────────────────────────────────────
var isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
var mobileActive = false; // replaces input.isLocked on touch devices

// Returns true when the game should process input (locked OR mobile active)
function gameIsActive() {
    return input.isLocked || (isMobile && mobileActive);
}

// Show/hide touch UI and crosshair depending on game state
function updateTouchUI() {
    var tu = document.getElementById('touch-ui');
    if (tu) {
        var show = isMobile && mobileActive && !inMenu && !state.isGameOver;
        tu.classList.toggle('game-active', show);
    }
    // Show crosshair when game is active on both desktop and mobile
    document.getElementById('crosshair').classList.toggle('hidden',
        isMobile ? !mobileActive : !input.isLocked
    );
}

function requestLock() {
    if (isMobile) {
        mobileActive = true;
        updateTouchUI();
    } else {
        document.body.requestPointerLock();
    }
}

function hideAllSubScreens() {
    ['tutorial-screen','stats-screen','options-screen','difficulty-screen','mode-screen','win-screen','bp-screen'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
}

function showMainMenu() {
    hideAllSubScreens();
    document.getElementById('btn-play').classList.toggle('hidden', gameStarted);
    document.getElementById('btn-continue').classList.toggle('hidden', !gameStarted);
    document.getElementById('btn-newgame').classList.toggle('hidden', !gameStarted);
    document.getElementById('main-menu').style.display = 'flex';
    inMenu = true;
}

function hideMainMenu() { document.getElementById('main-menu').style.display = 'none'; }

function showModeScreen()       { playMenuClick(); hideAllSubScreens(); document.getElementById('mode-screen').classList.remove('hidden'); }
function showDifficultyScreen() { playMenuClick(); hideAllSubScreens(); _highlightDiff(); document.getElementById('difficulty-screen').classList.remove('hidden'); }
function showTutorial()  { playMenuClick(); hideAllSubScreens(); document.getElementById('tutorial-screen').classList.remove('hidden'); }
function showOptions()   { playMenuClick(); hideAllSubScreens(); syncOptionsUI(); document.getElementById('options-screen').classList.remove('hidden'); }
function showStats()     {
    playMenuClick(); hideAllSubScreens();
    document.getElementById('st-best-wave').textContent   = globalStats.bestWave;
    document.getElementById('st-total-kills').textContent = globalStats.totalKills;
    document.getElementById('st-games').textContent       = globalStats.gamesPlayed;
    document.getElementById('st-time').textContent        = formatTime(Math.floor(globalStats.totalTimeSec));
    var stStreak = document.getElementById('st-streak');
    if (stStreak) stStreak.textContent = globalStats.bestStreak || 0;
    var stAcc = document.getElementById('st-accuracy');
    if (stAcc) stAcc.textContent = (globalStats.bestAccuracy || 0) + '%';
    document.getElementById('stats-screen').classList.remove('hidden');
}

function _highlightDiff() {
    document.querySelectorAll('.diff-card').forEach(function(card) {
        card.classList.toggle('active', card.dataset.diff === settings.difficulty);
    });
}

function startGame() {
    playMenuClick(); hideMainMenu(); hideAllSubScreens();
    mobileActive = false; // reset; requestLock() will set it
    state.gameMode = 'normal';
    resetState(); clearEnemies(); clearHealthPickups(); removeStar(); clearPowerups(); clearRockets();
    starAutoTimer = 60; ggSpawnTimer = 0;
    camera.position.set(0, PLAYER_HEIGHT, 5); camera.rotation.set(0,0,0);
    input.pitch = 0; input.yaw = 0; resetView();
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('reload-indicator').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('gg-hud').classList.add('hidden');
    updateStarHUD(0);
    createWeaponModel('pistol');
    updateDifficultyDisplay();
    inMenu = false; gameStarted = true; resetUICache();
    if (isMobile) document.body.classList.add('mobile-game');
    startWave(1); updateUI();
    startTutorial();
    requestLock();
}

function startGunGameMode() {
    playMenuClick(); hideMainMenu(); hideAllSubScreens();
    mobileActive = false; // reset; requestLock() will set it
    state.gameMode = 'gungame';
    stopTutorial();
    resetState(); clearEnemies(); clearHealthPickups(); removeStar(); clearPowerups(); clearRockets();
    starAutoTimer = 60; ggSpawnTimer = 3.5;
    camera.position.set(0, PLAYER_HEIGHT, 5); camera.rotation.set(0,0,0);
    input.pitch = 0; input.yaw = 0; resetView();
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('reload-indicator').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('diff-display').classList.add('hidden');
    updateStarHUD(0);
    createWeaponModel(GUN_GAME_WEAPONS[0].id);
    updateGunGameHUD(0);
    // Initial enemy spawn
    for (var i=0; i<3; i++) spawnEnemy(i === 0 ? 'chacal' : 'recluta', 80, 2.8);
    inMenu = false; gameStarted = true; resetUICache();
    if (isMobile) document.body.classList.add('mobile-game');
    updateUI(); requestLock();
}

function continueGame() {
    playMenuClick(); hideMainMenu();
    inMenu = false; state.isPaused = false;
    document.getElementById('pause-menu').classList.add('hidden');
    requestLock();
}

function backToMainMenu() {
    playMenuClick(); state.isPaused = true; document.exitPointerLock();
    mobileActive = false;
    document.body.classList.remove('mobile-game');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    updateTouchUI();
    showMainMenu();
}

// ── Difficulty cards ──────────────────────────────────────────────────────────
document.getElementById('difficulty-screen').addEventListener('click', function(e) {
    var card = e.target.closest('.diff-card');
    if (!card) return;
    playMenuClick();
    settings.difficulty = card.dataset.diff;
    saveSettings();
    document.querySelectorAll('.diff-card').forEach(function(c){ c.classList.toggle('active', c === card); });
    setTimeout(startGame, 280);
});

// ── Options ───────────────────────────────────────────────────────────────────
function syncOptionsUI() {
    document.getElementById('opt-sens').value  = settings.sensitivity;
    document.getElementById('sens-val').textContent = parseFloat(settings.sensitivity).toFixed(1) + '×';
    var ts = document.getElementById('opt-touch-sens');
    if (ts) { ts.value = settings.touchSensitivity; document.getElementById('touch-sens-val').textContent = parseFloat(settings.touchSensitivity).toFixed(1) + '×'; }
    document.getElementById('opt-vol').value   = settings.volume;
    document.getElementById('vol-val').textContent  = settings.volume + '%';
    document.querySelectorAll('.swatch').forEach(function(s){ s.classList.toggle('active', s.dataset.color === settings.crosshairColor); });
    document.querySelectorAll('.size-btn').forEach(function(b){ b.classList.toggle('active', parseInt(b.dataset.size) === settings.crosshairSize); });
    var mm = document.getElementById('opt-minimap');
    mm.textContent = settings.showMinimap ? 'ON' : 'OFF'; mm.className = 'toggle-btn ' + (settings.showMinimap ? 'on' : 'off');
    var fpsBtn = document.getElementById('opt-fps');
    if (fpsBtn) { fpsBtn.textContent = settings.showFps ? 'ON' : 'OFF'; fpsBtn.className = 'toggle-btn ' + (settings.showFps ? 'on' : 'off'); }
    if (typeof refreshQualityBtn === 'function') refreshQualityBtn();
    var musicBtn = document.getElementById('opt-music');
    if (musicBtn) { musicBtn.textContent = settings.music ? 'ON' : 'OFF'; musicBtn.className = 'toggle-btn ' + (settings.music ? 'on' : 'off'); }
    document.getElementById('ch-preview-v').style.background = settings.crosshairColor;
    document.getElementById('ch-preview-h').style.background = settings.crosshairColor;
}

document.getElementById('opt-sens').addEventListener('input', function(){ settings.sensitivity=parseFloat(this.value); document.getElementById('sens-val').textContent=settings.sensitivity.toFixed(1)+'×'; saveSettings(); });
var _tsEl = document.getElementById('opt-touch-sens');
if (_tsEl) { _tsEl.addEventListener('input', function(){ settings.touchSensitivity=parseFloat(this.value); document.getElementById('touch-sens-val').textContent=settings.touchSensitivity.toFixed(1)+'×'; saveSettings(); }); }
document.getElementById('opt-vol').addEventListener('input', function(){ settings.volume=parseInt(this.value); document.getElementById('vol-val').textContent=settings.volume+'%'; if(masterGain)masterGain.gain.value=settings.volume/100; saveSettings(); });
document.getElementById('color-swatches').addEventListener('click', function(e){ var b=e.target.closest('.swatch'); if(!b)return; settings.crosshairColor=b.dataset.color; document.querySelectorAll('.swatch').forEach(function(s){s.classList.toggle('active',s===b);}); applySettings(); saveSettings(); });
document.getElementById('size-btns').addEventListener('click', function(e){ var b=e.target.closest('.size-btn'); if(!b)return; settings.crosshairSize=parseInt(b.dataset.size); document.querySelectorAll('.size-btn').forEach(function(x){x.classList.toggle('active',x===b);}); applySettings(); saveSettings(); });
document.getElementById('opt-minimap').addEventListener('click', function(){ settings.showMinimap=!settings.showMinimap; this.textContent=settings.showMinimap?'ON':'OFF'; this.className='toggle-btn '+(settings.showMinimap?'on':'off'); applySettings(); saveSettings(); });

var QUALITY_ORDER = ['rendimiento', 'medio', 'alto'];
var QUALITY_LABEL = { rendimiento: 'RENDIMIENTO', medio: 'MEDIO', alto: 'ALTO' };
function refreshQualityBtn() {
    var b = document.getElementById('opt-quality');
    if (b) b.textContent = QUALITY_LABEL[settings.quality] || QUALITY_LABEL.medio;
}
var qb = document.getElementById('opt-quality');
if (qb) qb.addEventListener('click', function() {
    var i = QUALITY_ORDER.indexOf(settings.quality);
    settings.quality = QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length];
    refreshQualityBtn(); applyQuality(); saveSettings(); playMenuClick();
});
var musicToggle = document.getElementById('opt-music');
if (musicToggle) musicToggle.addEventListener('click', function() {
    settings.music = !settings.music;
    this.textContent = settings.music ? 'ON' : 'OFF';
    this.className = 'toggle-btn ' + (settings.music ? 'on' : 'off');
    if (window.GameAudio) GameAudio.setMusicEnabled(settings.music);
    saveSettings(); playMenuClick();
});
var fb = document.getElementById('opt-fps');
if (fb) fb.addEventListener('click', function() {
    settings.showFps = !settings.showFps;
    this.textContent = settings.showFps ? 'ON' : 'OFF';
    this.className = 'toggle-btn ' + (settings.showFps ? 'on' : 'off');
    applyQuality(); saveSettings(); playMenuClick();
});
document.getElementById('btn-reset-stats').addEventListener('click', function(){ if(!confirm('¿Resetear todas las estadísticas?'))return; Object.assign(globalStats,{bestWave:0,totalKills:0,gamesPlayed:0,totalTimeSec:0}); try{localStorage.removeItem('shooter_stats');}catch(e){} showStats(); });

// ── Main menu buttons ─────────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click',     showModeScreen);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-newgame').addEventListener('click',  showModeScreen);
document.getElementById('btn-tutorial').addEventListener('click', showTutorial);
document.getElementById('btn-stats').addEventListener('click',    showStats);
document.getElementById('btn-options').addEventListener('click',  showOptions);

// ── In-game buttons ───────────────────────────────────────────────────────────
document.getElementById('resume-game').onclick         = togglePause;
document.getElementById('close-shop').onclick          = closeShop;
document.getElementById('restart-game').onclick        = showModeScreen;
document.getElementById('btn-menu-from-pause').onclick = backToMainMenu;
document.getElementById('btn-menu-from-over').onclick  = backToMainMenu;
document.getElementById('btn-opts-pause').onclick      = function(){ state.isPaused=true; document.exitPointerLock(); hideAllSubScreens(); syncOptionsUI(); document.getElementById('options-screen').classList.remove('hidden'); document.getElementById('main-menu').style.display='none'; };

// ──────────────────────────────────────────────────────────── INPUT ──────────
document.body.addEventListener('click',      function () { initAudio(); if (!inMenu && !state.isPaused && !state.isBuying && !state.isGameOver && !isMobile) requestLock(); });
document.body.addEventListener('touchstart', function () { initAudio(); }, { passive: true });

document.addEventListener('pointerlockchange', function(){
    input.isLocked = document.pointerLockElement === document.body;
    if (!input.isLocked) input.mouseDown = false;
    updateTouchUI();
});

document.addEventListener('keydown', function(e) {
    input.keys[e.code] = true;
    if (inMenu || state.isGameOver) return;
    if (e.code==='Space') playerJump();
    if (e.code==='KeyE'   && !state.isPaused)                      performDash();
    if (e.code==='KeyR'   && !state.isPaused && !state.isReloading) reloadWeapon();
    if (e.code==='KeyB'   && !state.isPaused && !state.isBuying && state.gameMode!=='gungame') openShop();
    if (e.code==='Escape') { if(state.isBuying)closeShop(); else togglePause(); }
    if (state.gameMode !== 'gungame') {
        if (e.code==='Digit1') switchWeapon('pistol');
        if (e.code==='Digit2') switchWeapon('rifle');
        if (e.code==='Digit3') switchWeapon('shotgun');
        if (e.code==='Digit4') switchWeapon('smg');
        if (e.code==='Digit5') switchWeapon('sniper');
    }
});

document.addEventListener('keyup', function(e){ input.keys[e.code]=false; });

document.addEventListener('mousemove', function(e){
    if (isMobile || !input.isLocked || inMenu) return;
    var s = settings.sensitivity;
    input.yaw   -= (e.movementX || 0) * 0.002 * s;
    input.pitch -= (e.movementY || 0) * 0.002 * s;
    input.pitch  = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, input.pitch));
    if (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 6) notifyTutorial('look');
    // Camera rotation applied by applyShake() each frame
});

document.addEventListener('mousedown', function(e){
    if (isMobile) return; // handled by touch buttons
    if (e.button===0 && input.isLocked && !state.isBuying && !state.isPaused && !state.isGameOver && !inMenu) {
        input.mouseDown = true;
        fireWeapon();
    }
});
document.addEventListener('mouseup', function(e){ if (e.button===0) input.mouseDown = false; });
window.addEventListener('blur', function(){ input.mouseDown = false; input.keys = {}; });

function _onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    applyRenderScale();
}
window.addEventListener('resize',            _onResize);
window.addEventListener('orientationchange', function () { setTimeout(_onResize, 300); });

// ──────────────────────────────────────────────────────────── GAME LOOP ──────
var _mmAcc = 0;      // acumulador para dibujar el minimapa a 30 Hz, no a 144
var _fpsAcc = 0, _fpsFrames = 0;
var _uiAcc = 0;      // acumulador para refrescar el HUD a 10 Hz, no a 144
var _UI_HZ = 0.1;    // 100 ms entre refrescos de HUD

function animate() {
    requestAnimationFrame(animate);
    var delta = Math.min(clock.getDelta(), 0.05);

    if (settings.showFps) {
        _fpsAcc += delta; _fpsFrames++;
        if (_fpsAcc >= 0.5) {
            _text('fps-display', Math.round(_fpsFrames / _fpsAcc) + ' FPS');
            _fpsAcc = 0; _fpsFrames = 0;
        }
    }

    if (window.WorldFX) WorldFX.update(delta);
    updateAudioMood(delta);

    if (inMenu) {
        menuCamAngle += delta * 0.14;
        camera.position.x = Math.sin(menuCamAngle) * 12;
        camera.position.z = Math.cos(menuCamAngle) * 12;
        camera.position.y = 4;
        camera.lookAt(0, 1.5, 0);
        renderer.render(scene, camera);
        return;
    }

    applyPhysics(delta);
    updateViewFeel(delta);
    applyShake(delta);
    if (window.WeaponFX) WeaponFX.update(delta, !!input.moving, !!input.sprinting);
    if (window.GunAudio && GunAudio.minigunSpin) GunAudio.minigunSpin(state.currentWeapon === 'gg_minigun' && !!input.mouseDown && !state.isPaused);

    if (!state.isPaused && gameIsActive()) {
        handleMovement(delta);
        if (input.mouseDown && input.isLocked && !state.isBuying && ballistics(state.currentWeapon).auto) fireWeapon();
        updateRockets(delta);
        updateEnemyAI(delta);
        if (window.EnemyModels) EnemyModels.update(delta);
        updateStarPickup(delta);
        updatePowerups(delta);
        tickStarPower();
        tickBuffs();
        flushDamageNumbers();

        if (state.gameMode === 'normal') {
            updateHealthPickups(delta);
        } else {
            tickGunGameSpawn(delta);
        }
        // El HUD se refresca a 10 Hz: a 144 Hz se repintaba 14 veces lo
        // necesario. Los eventos (disparo, dano, compra, recarga) siguen
        // llamando a updateUI() directamente, asi que la respuesta es inmediata.
        _uiAcc += delta;
        if (_uiAcc >= _UI_HZ) { _uiAcc -= _UI_HZ; updateUI(); }
    }

    // El minimapa es canvas 2D en la CPU: a 144 Hz costaba mas que la escena 3D.
    if (settings.showMinimap) {
        _mmAcc += delta;
        if (_mmAcc >= 0.033) { _mmAcc = 0; drawMinimap(); }
    }
    renderer.render(scene, camera);
}

// ─────────────────────────────────────────────────────── PASE DE BATALLA ─────
function bpTrack(evt, data) { if (window.BattlePass) BattlePass.track(evt, data); }

// Skin de arma y color de trazadora equipados en el pase
function applyCosmetics() {
    if (!window.BattlePass || !window.WeaponFX) return;
    var skin = BattlePass.equipped('skin'), tracer = BattlePass.equipped('tracer');
    if (WeaponFX.setSkin) WeaponFX.setSkin(skin && skin.id !== 'skin_default' ? skin.data : null);
    if (WeaponFX.setTracerColor) WeaponFX.setTracerColor(tracer ? tracer.data.color : null);
}
if (window.BattlePass) BattlePass.on('equip', applyCosmetics);

// ──────────────────────────────────────────────────────────── INIT ────────────
applySettings();
applyCosmetics();
showMainMenu();
animate();
