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
};

var GUN_GAME_WEAPONS = [
    { id: 'gg_bat',      name: '🪃 Bate',          damage: 80,   fireRate: 1000, clip: 1,   maxAmmo: 9999, reloadTime: 500,  price: 0, color: 0x8B4513 },
    { id: 'gg_pistol',   name: '🔫 Pistola',        damage: 22,   fireRate: 320,  clip: 12,  maxAmmo: 9999, reloadTime: 1400, price: 0, color: 0x4444AA },
    { id: 'gg_revolver', name: '🔫 Revólver',       damage: 55,   fireRate: 700,  clip: 6,   maxAmmo: 9999, reloadTime: 1800, price: 0, color: 0xBB8800 },
    { id: 'gg_smg',      name: '⚡ SMG',            damage: 15,   fireRate: 75,   clip: 30,  maxAmmo: 9999, reloadTime: 1600, price: 0, color: 0x3344BB },
    { id: 'gg_rifle',    name: '🎯 Rifle AR',       damage: 38,   fireRate: 110,  clip: 30,  maxAmmo: 9999, reloadTime: 2000, price: 0, color: 0x225533 },
    { id: 'gg_shotgun',  name: '💥 Escopeta',       damage: 65,   fireRate: 850,  clip: 8,   maxAmmo: 9999, reloadTime: 2500, price: 0, color: 0x664422 },
    { id: 'gg_sniper',   name: '🔭 Francotirador',  damage: 160,  fireRate: 1800, clip: 5,   maxAmmo: 9999, reloadTime: 3000, price: 0, color: 0x004422 },
    { id: 'gg_minigun',  name: '🌀 Minigun',        damage: 12,   fireRate: 55,   clip: 100, maxAmmo: 9999, reloadTime: 4000, price: 0, color: 0x880000 },
    { id: 'gg_rpg',      name: '🚀 Lanzacohetes',   damage: 350,  fireRate: 3000, clip: 1,   maxAmmo: 9999, reloadTime: 3500, price: 0, color: 0xFF4400 },
    { id: 'gg_golden',   name: '⭐ Pistola Dorada', damage: 9999, fireRate: 2000, clip: 1,   maxAmmo: 9999, reloadTime: 2000, price: 0, color: 0xFFD700 },
];
GUN_GAME_WEAPONS.forEach(function(w) { WEAPONS[w.id] = w; });

var MAP_HALF      = 90;
var PLAYER_HEIGHT = 3;
var COVER_POSITIONS = [
    [10, 5], [-12, 8], [18, -14], [-22, -6], [6, 22],
    [-8, -18], [25, 3], [-15, 20], [0, -20], [20, -22],
];
var ENEMY_COLORS = [0x3366cc, 0xcc3333, 0x33cc66, 0xcc6633, 0x9933cc, 0xcc3399];

// ──────────────────────────────────────────────────── DIFICULTAD ─────────────
var DIFFICULTIES = {
    facil: {
        name: 'Fácil', emoji: '😊', color: '#00ff88',
        enemyHpMult: 0.65, enemySpeedMult: 0.70, enemyDamage: 8,
        attackCooldown: 2200, dropChance: 0.45, healAmount: 35,
        startMoney: 1500, waveCountOffset: -1,
    },
    medioTonto: {
        name: 'Medio Tonto', emoji: '🤔', color: '#ffcc00',
        enemyHpMult: 1.00, enemySpeedMult: 1.00, enemyDamage: 15,
        attackCooldown: 1500, dropChance: 0.28, healAmount: 30,
        startMoney: 800, waveCountOffset: 0,
    },
    medioLoco: {
        name: 'Medio Loco', emoji: '😤', color: '#ff6600',
        enemyHpMult: 1.40, enemySpeedMult: 1.30, enemyDamage: 22,
        attackCooldown: 1100, dropChance: 0.12, healAmount: 25,
        startMoney: 600, waveCountOffset: 1,
    },
    muyLoco: {
        name: 'Muy Loco', emoji: '💀', color: '#ff2222',
        enemyHpMult: 2.00, enemySpeedMult: 1.70, enemyDamage: 35,
        attackCooldown: 700, dropChance: 0.05, healAmount: 20,
        startMoney: 400, waveCountOffset: 2,
    },
};

function getDiff() { return DIFFICULTIES[settings.difficulty] || DIFFICULTIES.medioTonto; }

function waveConfig(wave) {
    var diff  = getDiff();
    var count = Math.max(1, 3 + wave * 2 + diff.waveCountOffset);
    return {
        count:  count,
        health: Math.round((50 + (wave - 1) * 15) * diff.enemyHpMult),
        speed:  (2 + (wave - 1) * 0.35) * diff.enemySpeedMult,
    };
}

// ──────────────────────────────────────────────────────────── SETTINGS ───────
var settings = (function() {
    var def = { sensitivity: 1.0, crosshairColor: '#00ff00', crosshairSize: 20, showMinimap: true, volume: 80, difficulty: 'medioTonto' };
    try { return Object.assign({}, def, JSON.parse(localStorage.getItem('shooter_settings') || '{}')); }
    catch(e) { return def; }
})();

function saveSettings() { try { localStorage.setItem('shooter_settings', JSON.stringify(settings)); } catch(e) {} }

function applySettings() {
    document.documentElement.style.setProperty('--ch-color', settings.crosshairColor);
    document.documentElement.style.setProperty('--ch-size',  settings.crosshairSize + 'px');
    document.getElementById('minimap').style.display = settings.showMinimap ? 'block' : 'none';
    if (masterGain) masterGain.gain.value = settings.volume / 100;
    var pv = document.getElementById('ch-preview-v');
    if (pv) { pv.style.background = settings.crosshairColor; document.getElementById('ch-preview-h').style.background = settings.crosshairColor; }
}

// ──────────────────────────────────────────────────────────── STATS ──────────
var globalStats = (function() {
    var def = { bestWave: 0, totalKills: 0, gamesPlayed: 0, totalTimeSec: 0 };
    try { return Object.assign({}, def, JSON.parse(localStorage.getItem('shooter_stats') || '{}')); }
    catch(e) { return def; }
})();

function saveStats(wave, kills, elapsedSec) {
    globalStats.bestWave      = Math.max(globalStats.bestWave, wave - 1);
    globalStats.totalKills   += kills;
    globalStats.gamesPlayed  += 1;
    globalStats.totalTimeSec += elapsedSec;
    try { localStorage.setItem('shooter_stats', JSON.stringify(globalStats)); } catch(e) {}
}

function formatTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
}

// ──────────────────────────────────────────────────────────── STATE ──────────
var state = {
    health: 100, money: 800, currentWeapon: 'pistol',
    isPaused: false, isBuying: false, isGameOver: false,
    isJumping: false, yVelocity: 0, isReloading: false,
    lastFireTime: 0, lastDashTime: 0, dashCooldown: 5000,
    ammo:     { pistol: 12, rifle: 30,  shotgun: 8  },
    reserves: { pistol: 78, rifle: 150, shotgun: 32 },
    owned:    { pistol: true, rifle: false, shotgun: false },
    wave: 1, kills: 0, totalKills: 0, startTime: Date.now(),
    // Game mode
    gameMode: 'normal', // 'normal' | 'gungame'
    ggLevel: 0,
    // Star power-up
    starActive: false,
    starEndTime: 0,
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
        ammo:     { pistol: 12, rifle: 30,  shotgun: 8  },
        reserves: { pistol: 78, rifle: 150, shotgun: 32 },
        owned:    { pistol: true, rifle: false, shotgun: false },
        wave: 1, kills: 0, totalKills: 0, startTime: Date.now(),
        gameMode: mode, ggLevel: 0,
        starActive: false, starEndTime: 0,
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
    masterGain.connect(audioCtx.destination);
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

function playShootSound(id)  { var f = ({pistol:320,rifle:500,shotgun:180,gg_bat:120,gg_pistol:320,gg_revolver:280,gg_smg:480,gg_rifle:500,gg_shotgun:180,gg_sniper:600,gg_minigun:460,gg_rpg:100,gg_golden:900})[id]||320; tone('sawtooth',f,80,0.28,0.18); }
function playReloadSound()   { tone('square',280,160,0.1,0.15); setTimeout(function(){tone('square',520,340,0.08,0.12);},200); }
function playDamageSound()   { tone('sine',200,75,0.38,0.3); }
function playDeathSound()    { tone('sawtooth',140,55,0.3,0.5); tone('square',75,35,0.2,0.6); }
function playHeadshotSound() { tone('sine',820,410,0.38,0.28); tone('sine',1240,620,0.18,0.2); }
function playWaveSound()     { tone('sine',400,820,0.28,0.38); setTimeout(function(){tone('sine',520,1040,0.22,0.38);},200); }
function playMenuClick()     { tone('sine',600,800,0.08,0.07); }
function playHealSound()     { tone('sine',440,660,0.25,0.15); setTimeout(function(){tone('sine',660,880,0.2,0.2);},120); setTimeout(function(){tone('sine',880,1100,0.15,0.25);},260); }
function playPickupNearSound() { tone('sine',300,400,0.06,0.1); }
function playStarSound()     { tone('sine',600,1200,0.3,0.12); setTimeout(function(){tone('sine',800,1600,0.25,0.15);},100); setTimeout(function(){tone('sine',1000,2000,0.2,0.18);},220); }
function playGGWinSound()    { [0,150,300,500].forEach(function(d,i){ setTimeout(function(){ tone('sine',[440,550,660,880][i],[660,880,1100,1320][i],0.3,0.3); },d); }); }

// ──────────────────────────────────────────────────────────── SCENE ──────────
var scene    = new THREE.Scene();
var camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
var renderer = new THREE.WebGLRenderer({ antialias: true });
var clock    = new THREE.Clock();

scene.background = new THREE.Color(0x1a1a2e);
scene.fog        = new THREE.Fog(0x1a1a2e, 30, 120);
camera.position.set(0, PLAYER_HEIGHT, 5);
scene.add(camera);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x404080, 0.6));
var sun = new THREE.DirectionalLight(0x8888ff, 0.8);
sun.position.set(30, 50, 30); sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 1024;
scene.add(sun);

var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x2d5a3a })
);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

var coverMeshes = COVER_POSITIONS.map(function(pos) {
    var w = 2 + Math.random() * 2, h = 1.5 + Math.random() * 1.5, d = 2 + Math.random() * 2;
    var box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x8b6914 }));
    box.position.set(pos[0], h / 2, pos[1]); box.castShadow = box.receiveShadow = true;
    scene.add(box); return box;
});

// ──────────────────────────────────────────────────────────── PLAYER ─────────
var input = { keys: {}, pitch: 0, yaw: 0, bobPhase: 0, isLocked: false };

var armMat = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
var arms   = new THREE.Group();
var la = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), armMat); la.position.set(-0.4,-0.3,-0.5); arms.add(la);
var ra = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), armMat); ra.position.set( 0.3,-0.3,-0.5); arms.add(ra);
arms.position.y = -0.5; camera.add(arms);

var weaponGroup = new THREE.Group(); weaponGroup.position.set(0.3, -0.2, -0.6); arms.add(weaponGroup);

function createWeaponModel(id) {
    while (weaponGroup.children.length) weaponGroup.remove(weaponGroup.children[0]);
    var w = WEAPONS[id], len = w.fireRate * 0.001;
    var b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, len), new THREE.MeshStandardMaterial({ color: w.color }));
    b.position.z = -len / 2; weaponGroup.add(b);
}
createWeaponModel('pistol');

var muzzleFlash = new THREE.PointLight(0xffaa33, 0, 4); muzzleFlash.position.set(0.3,-0.1,-1.2); camera.add(muzzleFlash);

function applyPhysics(delta) {
    if (!state.isJumping) return;
    state.yVelocity += -20 * delta; camera.position.y += state.yVelocity * delta;
    if (camera.position.y <= PLAYER_HEIGHT) { camera.position.y = PLAYER_HEIGHT; state.isJumping = false; state.yVelocity = 0; }
}

function performDash() {
    var now = Date.now(); if (now - state.lastDashTime < state.dashCooldown) return;
    state.lastDashTime = now;
    var dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    var step = 0, iv = setInterval(function(){ camera.position.addScaledVector(dir,1.5); clampPos(); if(++step>=10)clearInterval(iv); },20);
}

function handleMovement(delta) {
    var forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    var right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
    var move = new THREE.Vector3();
    if (input.keys['KeyW']) move.add(forward);
    if (input.keys['KeyS']) move.sub(forward);
    if (input.keys['KeyA']) move.sub(right);
    if (input.keys['KeyD']) move.add(right);
    if (move.lengthSq() > 0) {
        var spd = state.starActive ? 10.5 : 6;
        move.normalize().multiplyScalar(spd * delta);
        camera.position.add(move);
        input.bobPhase += delta * 8;
        arms.position.y = -0.5 + Math.sin(input.bobPhase) * 0.025;
    }
    clampPos();
}

function clampPos() {
    camera.position.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, camera.position.x));
    camera.position.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, camera.position.z));
}

// ────────────────────────────────────────────────────── SCREEN SHAKE ─────────
var shakePow = 0;

function triggerShake(power) {
    shakePow = Math.max(shakePow, power);
}

var SHAKE_BY_WEAPON = { pistol:0.008, rifle:0.005, shotgun:0.026, gg_bat:0.03, gg_pistol:0.008, gg_revolver:0.012, gg_smg:0.005, gg_rifle:0.006, gg_shotgun:0.026, gg_sniper:0.02, gg_minigun:0.004, gg_rpg:0.05, gg_golden:0.04 };

function applyShake() {
    camera.rotation.order = 'YXZ';
    if (shakePow > 0.0004) {
        camera.rotation.y = input.yaw   + (Math.random() - 0.5) * shakePow;
        camera.rotation.x = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01,
            input.pitch + (Math.random() - 0.5) * shakePow * 0.55));
        shakePow *= 0.72;
    } else {
        camera.rotation.y = input.yaw;
        camera.rotation.x = input.pitch;
        shakePow = 0;
    }
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
    var overlay = document.getElementById('star-overlay');
    var bar     = document.getElementById('star-bar-fill');
    var label   = document.getElementById('star-bar-label');
    var hud     = document.getElementById('star-hud');
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
        label.textContent = '⭐ ESTRELLA ' + Math.ceil(msLeft / 1000) + 's';
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
    document.getElementById('win-kills').textContent = state.totalKills;
    document.getElementById('win-screen').classList.remove('hidden');
    state.isPaused = true; state.isGameOver = true;
    document.exitPointerLock();
}

function triggerGameOver() {
    var elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    saveStats(state.wave, state.totalKills, elapsed);
    document.getElementById('game-over-stats').innerHTML =
        'Oleada: <b>' + state.wave + '</b> &nbsp;|&nbsp; Dificultad: <b>' + getDiff().emoji + ' ' + getDiff().name + '</b><br>' +
        'Bajas totales: <b>' + state.totalKills + '</b><br>' +
        'Tiempo: <b>' + formatTime(elapsed) + '</b>';
    document.getElementById('game-over').classList.remove('hidden');
    updateUI();
}

function togglePause() {
    if (state.isBuying || state.isGameOver) return;
    state.isPaused = !state.isPaused;
    document.getElementById('pause-menu').classList.toggle('hidden', !state.isPaused);
    if (state.isPaused) document.exitPointerLock();
    else { document.getElementById('crosshair').classList.remove('hidden'); requestLock(); }
}

function openShop() {
    if (state.gameMode === 'gungame') return;
    state.isBuying = state.isPaused = true; document.exitPointerLock();
    document.getElementById('crosshair').classList.add('hidden'); populateShop();
    document.getElementById('buy-menu').classList.remove('hidden');
}

function closeShop() {
    state.isBuying = state.isPaused = false;
    document.getElementById('buy-menu').classList.add('hidden');
    document.getElementById('crosshair').classList.remove('hidden'); requestLock();
}

function populateShop() {
    document.getElementById('shop-money').textContent = 'Cash: $' + state.money;
    var list = document.getElementById('weapon-list'); list.innerHTML = '';
    ['pistol','rifle','shotgun'].forEach(function(id) {
        var w=WEAPONS[id], owned=state.owned[id], isCur=state.currentWeapon===id, afford=state.money>=w.price;
        var div=document.createElement('div');
        div.className='weapon-item'+(isCur?' equipped':'')+(!owned&&!afford?' locked':'');
        div.innerHTML='<div class="wname">'+w.name+'</div><div class="wstats">DMG '+w.damage+' &middot; CLIP '+w.clip+'</div><div class="wprice">'+(owned?(isCur?'✓ EQUIPADA':'↑ EQUIPAR'):'$'+w.price)+'</div>';
        div.onclick=function(){if(owned)switchWeapon(id);else if(afford)buyWeapon(id);populateShop();};
        list.appendChild(div);
    });
}

function drawMinimap() {
    var size=150, cx=75, cy=75, range=80;
    mmCtx.clearRect(0,0,size,size);
    mmCtx.save();
    mmCtx.beginPath(); mmCtx.arc(cx,cy,75,0,Math.PI*2); mmCtx.fillStyle='rgba(0,0,0,0.65)'; mmCtx.fill(); mmCtx.clip();
    mmCtx.translate(cx,cy); mmCtx.rotate(-input.yaw);
    coverMeshes.forEach(function(b){var dx=(b.position.x-camera.position.x)*75/range,dz=(b.position.z-camera.position.z)*75/range;mmCtx.fillStyle='rgba(139,105,20,0.45)';mmCtx.fillRect(dx-3,dz-3,6,6);});
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
        if(d2>69*69){var d=Math.sqrt(d2);dx=dx/d*69;dz=dz/d*69;mmCtx.fillStyle='rgba(255,60,60,0.45)';}else mmCtx.fillStyle='#ff3333';
        mmCtx.beginPath();mmCtx.arc(dx,dz,4,0,Math.PI*2);mmCtx.fill();
    });
    mmCtx.fillStyle='#00ffcc';mmCtx.beginPath();mmCtx.arc(0,0,5,0,Math.PI*2);mmCtx.fill();
    mmCtx.strokeStyle='#00ffcc';mmCtx.lineWidth=2;mmCtx.beginPath();mmCtx.moveTo(0,0);mmCtx.lineTo(0,-12);mmCtx.stroke();
    mmCtx.restore();
    mmCtx.strokeStyle='rgba(255,255,255,0.28)';mmCtx.lineWidth=2;mmCtx.beginPath();mmCtx.arc(cx,cy,74,0,Math.PI*2);mmCtx.stroke();
}

function updateDifficultyDisplay() {
    var diff = getDiff();
    var el = document.getElementById('diff-display');
    el.textContent = diff.emoji + ' ' + diff.name.toUpperCase();
    el.style.color  = diff.color;
    el.style.borderColor = diff.color + '55';
    el.classList.remove('hidden');
}

function updateUI() {
    var w=WEAPONS[state.currentWeapon], hp=Math.max(0,state.health);
    document.getElementById('health-bar').style.width      = hp + '%';
    document.getElementById('health-bar').style.background = hp > 60 ? '#00ff00' : hp > 30 ? '#ffcc00' : '#ff2200';

    if (state.gameMode === 'gungame') {
        document.getElementById('money-display').classList.add('hidden');
        document.getElementById('wave-display').textContent  = 'GUN GAME';
        document.getElementById('weapon-display').textContent = w.name + '  [' + (state.ggLevel+1) + '/10]';
        var rs2 = state.isReloading ? ' [CARGANDO]' : ' (∞)';
        document.getElementById('ammo-display').textContent = 'Ammo: ' + (state.ammo[state.currentWeapon]||0) + ' / ' + w.clip + rs2;
    } else {
        document.getElementById('money-display').classList.remove('hidden');
        document.getElementById('money-display').textContent = 'Cash: $' + state.money;
        var rs = state.isReloading ? ' [CARGANDO]' : ' ('+state.reserves[state.currentWeapon]+')';
        document.getElementById('ammo-display').textContent = 'Ammo: '+state.ammo[state.currentWeapon]+' / '+w.clip+rs;
        document.getElementById('wave-display').textContent = 'OLEADA ' + state.wave;
        var slots=['pistol','rifle','shotgun'].map(function(id,i){return state.owned[id]?(i+1):'·';}).join('');
        document.getElementById('weapon-display').textContent = w.name.toUpperCase()+' ['+slots+']';
    }
    document.getElementById('kill-display').textContent = 'Bajas: '+state.kills+' | Total: '+state.totalKills;
    updateDashBar();
}

function updateDashBar() {
    var cd=Math.max(0,state.dashCooldown-(Date.now()-state.lastDashTime));
    var el=document.getElementById('dash-cooldown');
    if(!el){
        el=document.createElement('div');el.id='dash-cooldown';
        el.style.cssText='position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:200px;height:28px;background:rgba(0,0,0,0.7);border:2px solid rgba(255,255,255,0.4);border-radius:5px;overflow:hidden';
        var fill=document.createElement('div');fill.id='dash-fill';fill.style.cssText='height:100%;transition:width 0.1s';el.appendChild(fill);
        var lbl=document.createElement('div');lbl.id='dash-text';lbl.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:13px;font-weight:bold;text-shadow:1px 1px 2px #000;white-space:nowrap';el.appendChild(lbl);
        document.getElementById('ui-container').appendChild(el);
    }
    var fill=document.getElementById('dash-fill'),lbl=document.getElementById('dash-text');
    if(cd>0){fill.style.width=(100-cd/state.dashCooldown*100)+'%';fill.style.background='linear-gradient(90deg,#ff4400,#aa0000)';lbl.textContent='DASH: '+(cd/1000).toFixed(1)+'s';}
    else{fill.style.width='100%';fill.style.background='linear-gradient(90deg,#00ff88,#00bb55)';lbl.textContent='DASH LISTO  [E]';}
}

// ──────────────────────────────────────────────────────────── ENEMIES ────────
var enemies = [];

function createHuman(torsoColor) {
    var g = new THREE.Group();
    var head=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),new THREE.MeshStandardMaterial({color:0xffcc99}));head.position.y=2.7;head.castShadow=true;head.userData={mult:2.5};g.add(head);
    var torso=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.2,0.4),new THREE.MeshStandardMaterial({color:torsoColor}));torso.position.y=1.8;torso.castShadow=true;torso.userData={mult:1.0};g.add(torso);
    var lm=new THREE.MeshStandardMaterial({color:0x333333});
    [-0.2,0.2].forEach(function(x){var l=new THREE.Mesh(new THREE.BoxGeometry(0.25,1.2,0.25),lm);l.position.set(x,0.6,0);l.castShadow=true;l.userData={mult:0.7};g.add(l);});
    return g;
}

function spawnEnemy(health, speed) {
    var angle=Math.random()*Math.PI*2, dist=28+Math.random()*35;
    var x=Math.max(-MAP_HALF+2,Math.min(MAP_HALF-2,camera.position.x+Math.cos(angle)*dist));
    var z=Math.max(-MAP_HALF+2,Math.min(MAP_HALF-2,camera.position.z+Math.sin(angle)*dist));
    var e=createHuman(ENEMY_COLORS[Math.floor(Math.random()*ENEMY_COLORS.length)]);
    e.position.set(x,0,z);
    e.userData={health:health,maxHealth:health,speed:speed,lastAttack:0,walkPhase:Math.random()*Math.PI*2};
    scene.add(e); enemies.push(e);
}

function removeEnemy(eg){var i=enemies.indexOf(eg);if(i!==-1)enemies.splice(i,1);scene.remove(eg);}
function clearEnemies() {enemies.forEach(function(e){scene.remove(e);});enemies.length=0;}

function startWave(wave) {
    state.wave=wave; state.kills=0; clearEnemies(); playWaveSound(); showWaveAnnounce('OLEADA '+wave);
    var cfg=waveConfig(wave);
    setTimeout(function(){for(var i=0;i<cfg.count;i++)spawnEnemy(cfg.health,cfg.speed);},2500);
}

var ggSpawnTimer = 0;
function tickGunGameSpawn(delta) {
    var MAX = 5;
    if (enemies.length >= MAX) { ggSpawnTimer = 0; return; }
    ggSpawnTimer += delta;
    if (ggSpawnTimer >= 4) {
        ggSpawnTimer = 0;
        var n = Math.min(3, MAX - enemies.length);
        for (var i=0; i<n; i++) spawnEnemy(80, 2.8);
    }
}

function updateEnemyAI(delta) {
    var now  = Date.now();
    var diff = getDiff();
    var dmg  = state.gameMode === 'gungame' ? 15 : diff.enemyDamage;
    var cd   = state.gameMode === 'gungame' ? 1500 : diff.attackCooldown;

    for (var i = enemies.length - 1; i >= 0; i--) {
        var e=enemies[i], dir=new THREE.Vector3().subVectors(camera.position,e.position); dir.y=0; var dist=dir.length();
        if (dist > 2) {
            dir.normalize(); e.position.addScaledVector(dir,e.userData.speed*delta); e.position.y=0;
            e.userData.walkPhase+=delta*7; var wp=e.userData.walkPhase;
            if(e.children[2])e.children[2].rotation.x= Math.sin(wp)*0.35;
            if(e.children[3])e.children[3].rotation.x=-Math.sin(wp)*0.35;
        }
        e.lookAt(camera.position.x, e.position.y, camera.position.z);
        if (dist < 3 && now - e.userData.lastAttack > cd) {
            e.userData.lastAttack = now;
            takeDamage(dmg);
        }
    }
}

// ──────────────────────────────────────────────────── HEALTH PICKUPS ─────────
var healthPickups = [];
var pickupNearNotified = false;

function createHealthPickupMesh() {
    var g   = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0x00ff55, emissive: 0x00cc44, emissiveIntensity: 0.6 });
    var hBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.14), mat);
    var vBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), mat);
    hBar.castShadow = vBar.castShadow = true;
    g.add(hBar); g.add(vBar);
    g.add(new THREE.PointLight(0x00ff55, 1.2, 4));
    return g;
}

function spawnHealthPickup(x, z) {
    var pickup = createHealthPickupMesh();
    pickup.position.set(x, 0.9, z);
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
        p.position.y      = 0.9 + Math.sin(p.userData.phase) * 0.18;

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
                showFloatingText('+' + healed + ' HP ❤', '#00ff88', 38);
                playHealSound(); updateUI();
            } else {
                showFloatingText('¡Salud completa!', '#88ff88', 24);
            }
            scene.remove(p); healthPickups.splice(i, 1);
            pickupNearNotified = false;
        }
    }

    var hint = document.getElementById('health-pickup-hint');
    if (nearest < 64 && state.health < 100 && healthPickups.length > 0) {
        if (!hint) {
            hint = document.createElement('div'); hint.id = 'health-pickup-hint';
            hint.textContent = '🩹 ¡Botiquín cerca!';
            document.getElementById('ui-container').appendChild(hint);
        }
        hint.style.display = 'block';
        if (!pickupNearNotified) { playPickupNearSound(); pickupNearNotified = true; }
    } else {
        if (hint) hint.style.display = 'none';
        pickupNearNotified = false;
    }
}

// ──────────────────────────────────────────────────────── STAR PICKUP ────────
var starGroup = null;
var starAutoTimer = 60;

function spawnStar(x, z) {
    if (starGroup) return;
    starGroup = new THREE.Group();

    var core = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 1.4, metalness: 0.85, roughness: 0.15 })
    );
    starGroup.add(core);

    var ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.07, 8, 28),
        new THREE.MeshStandardMaterial({ color: 0xFFFF44, emissive: 0xFFFF00, emissiveIntensity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2.8; ring.name = 'ring';
    starGroup.add(ring);
    starGroup.add(new THREE.PointLight(0xFFD700, 3, 14));

    starGroup.position.set(x, 1.6, z);
    scene.add(starGroup);
}

function removeStar() {
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
        removeStar();
        state.starActive  = true;
        state.starEndTime = Date.now() + 8000;
        starAutoTimer = 60;
        playStarSound();
        showFloatingText('⭐ ¡ESTRELLA! +Velocidad +Invulnerable', '#FFD700', 34);
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
    var pos = { x: eg.position.x, z: eg.position.z };
    removeEnemy(eg);
    state.kills++; state.totalKills++;

    if (state.gameMode === 'gungame') {
        advanceGunGame();
        if (!starGroup && Math.random() < 0.20) spawnStar(pos.x, pos.z);
    } else {
        state.money += 200;
        showFloatingText('+$200', '#ffd700', 28);
        var diff = getDiff();
        if (Math.random() < diff.dropChance) {
            spawnHealthPickup(pos.x, pos.z);
            showFloatingText('🩹 DROP!', '#00ff88', 22);
        }
        if (!starGroup && Math.random() < 0.15) spawnStar(pos.x, pos.z);
        if (enemies.length === 0) {
            showWaveAnnounce('¡OLEADA ' + state.wave + ' COMPLETADA!');
            setTimeout(function(){ startWave(state.wave + 1); }, 3000);
        }
    }
}

function fireWeapon() {
    if(state.isReloading||state.isPaused||state.isGameOver)return;
    var now=Date.now(), w=WEAPONS[state.currentWeapon];
    if(now-state.lastFireTime<w.fireRate)return;
    if(state.ammo[state.currentWeapon]<=0){reloadWeapon();return;}
    state.lastFireTime=now; state.ammo[state.currentWeapon]--;
    playShootSound(state.currentWeapon); doMuzzleFlash();
    raycaster.setFromCamera({x:0,y:0},camera);
    var hits=raycaster.intersectObjects(enemies,true);
    if(hits.length>0){
        var hObj=hits[0].object, grp=hObj;
        while(grp.parent&&grp.parent!==scene)grp=grp.parent;
        if(grp.userData&&grp.userData.health!==undefined){
            var mult=hObj.userData.mult||1.0; grp.userData.health-=w.damage*mult; showHitMarker();
            if(mult>=2.0){showFloatingText('HEADSHOT!','#ff2200',50);playHeadshotSound();}
            if(grp.userData.health<=0)onEnemyKilled(grp);
        }
    }
    if(state.ammo[state.currentWeapon]===0&&state.reserves[state.currentWeapon]>0)setTimeout(reloadWeapon,250);
    updateUI();
}

function reloadWeapon() {
    if(state.isReloading)return;
    var w=WEAPONS[state.currentWeapon], need=w.clip-state.ammo[state.currentWeapon];
    if(need<=0||state.reserves[state.currentWeapon]<=0)return;
    state.isReloading=true; document.getElementById('reload-indicator').classList.remove('hidden'); playReloadSound();
    setTimeout(function(){
        if(!state.isReloading)return;
        var take=Math.min(need,state.reserves[state.currentWeapon]);
        state.ammo[state.currentWeapon]+=take; state.reserves[state.currentWeapon]-=take;
        state.isReloading=false; document.getElementById('reload-indicator').classList.add('hidden'); updateUI();
    }, w.reloadTime);
}

function switchWeapon(id) {
    if(state.isPaused||state.isBuying||state.isGameOver)return;
    if(state.gameMode!=='gungame' && (!state.owned[id]||state.currentWeapon===id))return;
    if(state.currentWeapon===id)return;
    state.currentWeapon=id; state.isReloading=false; document.getElementById('reload-indicator').classList.add('hidden');
    createWeaponModel(id); updateUI();
}

function buyWeapon(id) {
    if(state.gameMode==='gungame')return;
    var w=WEAPONS[id]; if(state.money<w.price||state.owned[id])return;
    state.money-=w.price; state.owned[id]=true; state.currentWeapon=id;
    state.ammo[id]=w.clip; state.reserves[id]=w.maxAmmo-w.clip;
    createWeaponModel(id); updateUI();
}

function takeDamage(amount) {
    if(state.isGameOver)return;
    if(state.starActive)return; // invulnerable!
    state.health=Math.max(0,state.health-amount); playDamageSound(); showDamageOverlay(); triggerShake(0.042);
    if(state.health<=0){playDeathSound();state.isPaused=state.isGameOver=true;document.exitPointerLock();triggerGameOver();}
    else updateUI();
}

// ────────────────────────────────────────── GAME STATE MANAGER ───────────────
var inMenu      = true;
var gameStarted = false;
var menuCamAngle = 0;

function requestLock() { document.body.requestPointerLock(); }

function hideAllSubScreens() {
    ['tutorial-screen','stats-screen','options-screen','difficulty-screen','mode-screen','win-screen'].forEach(function(id){
        document.getElementById(id).classList.add('hidden');
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
    document.getElementById('stats-screen').classList.remove('hidden');
}

function _highlightDiff() {
    document.querySelectorAll('.diff-card').forEach(function(card) {
        card.classList.toggle('active', card.dataset.diff === settings.difficulty);
    });
}

function startGame() {
    playMenuClick(); hideMainMenu(); hideAllSubScreens();
    state.gameMode = 'normal';
    resetState(); clearEnemies(); clearHealthPickups(); removeStar();
    starAutoTimer = 60; ggSpawnTimer = 0;
    camera.position.set(0, PLAYER_HEIGHT, 5); camera.rotation.set(0,0,0);
    input.pitch = 0; input.yaw = 0;
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('reload-indicator').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('gg-hud').classList.add('hidden');
    updateStarHUD(0);
    createWeaponModel('pistol');
    updateDifficultyDisplay();
    inMenu = false; gameStarted = true;
    startWave(1); updateUI();
    requestLock();
}

function startGunGameMode() {
    playMenuClick(); hideMainMenu(); hideAllSubScreens();
    state.gameMode = 'gungame';
    resetState(); clearEnemies(); clearHealthPickups(); removeStar();
    starAutoTimer = 60; ggSpawnTimer = 3.5;
    camera.position.set(0, PLAYER_HEIGHT, 5); camera.rotation.set(0,0,0);
    input.pitch = 0; input.yaw = 0;
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('reload-indicator').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('diff-display').classList.add('hidden');
    updateStarHUD(0);
    createWeaponModel(GUN_GAME_WEAPONS[0].id);
    updateGunGameHUD(0);
    // Initial enemy spawn
    for (var i=0; i<3; i++) spawnEnemy(80, 2.8);
    inMenu = false; gameStarted = true;
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
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
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
    document.getElementById('opt-vol').value   = settings.volume;
    document.getElementById('vol-val').textContent  = settings.volume + '%';
    document.querySelectorAll('.swatch').forEach(function(s){ s.classList.toggle('active', s.dataset.color === settings.crosshairColor); });
    document.querySelectorAll('.size-btn').forEach(function(b){ b.classList.toggle('active', parseInt(b.dataset.size) === settings.crosshairSize); });
    var mm = document.getElementById('opt-minimap');
    mm.textContent = settings.showMinimap ? 'ON' : 'OFF'; mm.className = 'toggle-btn ' + (settings.showMinimap ? 'on' : 'off');
    document.getElementById('ch-preview-v').style.background = settings.crosshairColor;
    document.getElementById('ch-preview-h').style.background = settings.crosshairColor;
}

document.getElementById('opt-sens').addEventListener('input', function(){ settings.sensitivity=parseFloat(this.value); document.getElementById('sens-val').textContent=settings.sensitivity.toFixed(1)+'×'; saveSettings(); });
document.getElementById('opt-vol').addEventListener('input', function(){ settings.volume=parseInt(this.value); document.getElementById('vol-val').textContent=settings.volume+'%'; if(masterGain)masterGain.gain.value=settings.volume/100; saveSettings(); });
document.getElementById('color-swatches').addEventListener('click', function(e){ var b=e.target.closest('.swatch'); if(!b)return; settings.crosshairColor=b.dataset.color; document.querySelectorAll('.swatch').forEach(function(s){s.classList.toggle('active',s===b);}); applySettings(); saveSettings(); });
document.getElementById('size-btns').addEventListener('click', function(e){ var b=e.target.closest('.size-btn'); if(!b)return; settings.crosshairSize=parseInt(b.dataset.size); document.querySelectorAll('.size-btn').forEach(function(x){x.classList.toggle('active',x===b);}); applySettings(); saveSettings(); });
document.getElementById('opt-minimap').addEventListener('click', function(){ settings.showMinimap=!settings.showMinimap; this.textContent=settings.showMinimap?'ON':'OFF'; this.className='toggle-btn '+(settings.showMinimap?'on':'off'); applySettings(); saveSettings(); });
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
document.body.addEventListener('click', function(){ if(!inMenu&&!state.isPaused&&!state.isBuying&&!state.isGameOver){initAudio();requestLock();} });

document.addEventListener('pointerlockchange', function(){
    input.isLocked = document.pointerLockElement === document.body;
    document.getElementById('crosshair').classList.toggle('hidden', !input.isLocked);
});

document.addEventListener('keydown', function(e) {
    input.keys[e.code] = true;
    if (inMenu || state.isGameOver) return;
    if (e.code==='Space'  && !state.isJumping && !state.isPaused) { state.isJumping=true; state.yVelocity=8; }
    if (e.code==='KeyE'   && !state.isPaused)                      performDash();
    if (e.code==='KeyR'   && !state.isPaused && !state.isReloading) reloadWeapon();
    if (e.code==='KeyB'   && !state.isPaused && !state.isBuying && state.gameMode!=='gungame') openShop();
    if (e.code==='Escape') { if(state.isBuying)closeShop(); else togglePause(); }
    if (state.gameMode !== 'gungame') {
        if (e.code==='Digit1') switchWeapon('pistol');
        if (e.code==='Digit2') switchWeapon('rifle');
        if (e.code==='Digit3') switchWeapon('shotgun');
    }
});

document.addEventListener('keyup', function(e){ input.keys[e.code]=false; });

document.addEventListener('mousemove', function(e){
    if(!input.isLocked||inMenu)return;
    var s=settings.sensitivity;
    input.yaw   -= (e.movementX||0)*0.002*s;
    input.pitch -= (e.movementY||0)*0.002*s;
    input.pitch  = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, input.pitch));
    // Camera rotation applied by applyShake() each frame
});

document.addEventListener('mousedown', function(e){
    if(e.button===0&&input.isLocked&&!state.isBuying&&!state.isPaused&&!state.isGameOver&&!inMenu)fireWeapon();
});

window.addEventListener('resize', function(){
    camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
});

// ──────────────────────────────────────────────────────────── GAME LOOP ──────
function animate() {
    requestAnimationFrame(animate);
    var delta = Math.min(clock.getDelta(), 0.05);

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
    applyShake();

    if (!state.isPaused && input.isLocked) {
        handleMovement(delta);
        updateEnemyAI(delta);
        updateStarPickup(delta);
        tickStarPower();

        if (state.gameMode === 'normal') {
            updateHealthPickups(delta);
        } else {
            tickGunGameSpawn(delta);
        }
        updateUI();
    }

    if (settings.showMinimap) drawMinimap();
    renderer.render(scene, camera);
}

// ──────────────────────────────────────────────────────────── INIT ────────────
applySettings();
showMainMenu();
animate();
