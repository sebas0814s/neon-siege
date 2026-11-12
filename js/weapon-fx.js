/**
 * ============================================================================
 * NEON SIEGE — WEAPON FX & VIEWMODEL SYSTEM
 * js/weapon-fx.js
 * ============================================================================
 * Exposes window.WeaponFX with zero external dependencies on game.js globals.
 * Loaded prior to game.js. All scene, camera, and runtime states are received
 * via parameters.
 */
(function (root) {
    'use strict';

    // ── Three.js helper accessor ───────────────────────────────────────────────
    function getTHREE() {
        return root.THREE || (typeof THREE !== 'undefined' ? THREE : null);
    }

    // ── Module State ───────────────────────────────────────────────────────────
    var sceneRef  = null;
    var cameraRef = null;

    // Viewmodel hierarchy:
    // camera -> viewmodelRoot -> animGroup -> currentWeaponGroup
    var viewmodelRoot      = null;
    var animGroup           = null;
    var currentWeaponGroup  = null;
    var muzzleMarker        = null;

    // Base position in camera space (approx 0.28, -0.26, -0.55)
    var BASE_POS = { x: 0.28, y: -0.26, z: -0.55 };

    // Current equipped weapon ID
    var currentWeaponId = null;

    // Equip animation state (~180ms raise from below)
    var equipProgress = 1.0;
    var EQUIP_DURATION = 0.18; // 180 ms

    // Viewmodel Recoil state
    var recoilPos = { x: 0, y: 0, z: 0 };
    var recoilRot = { x: 0, y: 0, z: 0 };

    // Bat swing melee animation state
    var isSwinging    = false;
    var swingTimer    = 0.0;
    var SWING_DUR     = 0.18;
    var swingYaw      = 0.0;
    var swingPitch    = 0.0;
    var swingRoll     = 0.0;

    // Minigun barrel rotation
    var barrelsGroup     = null;
    var barrelSpinSpeed  = 0.0;

    // Movement & Bobbing state
    var bobPhase    = 0.0;
    var idlePhase   = 0.0;
    var bobPosX     = 0.0;
    var bobPosY     = 0.0;
    var bobRotZ     = 0.0;

    // Sprint posture interpolation state
    var sprintX     = 0.0;
    var sprintY     = 0.0;
    var sprintRotX  = 0.0;
    var sprintRotY  = 0.0;
    var sprintRotZ  = 0.0;

    // Reload animation state (weapon dips, rolls and comes back)
    var reloadTimer    = 0.0;
    var reloadDuration = 0.0;   // 0 = not reloading

    // Look sway & vertical inertia, derived from camera motion between frames
    var lastYaw     = null;
    var lastPitch   = 0.0;
    var lastCamY    = 0.0;
    var lookSwayX   = 0.0;
    var lookSwayY   = 0.0;
    var inertiaY    = 0.0;

    // Muzzle flash & light
    var flashSprite   = null;
    var flashLight    = null;
    var flashTimer    = 0.0;
    var FLASH_DUR     = 0.05; // 50 ms

    // ── Weapon Skin State (null = original look) ───────────────────────────────
    var currentSkin   = null;   // normalized { body, accent, emissive, anim }
    var skinAccentMats = [];    // accent materials of the current weapon
    var skinTime      = 0.0;    // animation clock (seconds)
    var _skinColor    = null;   // reusable THREE.Color for skin math

    // Tracer color override: null = per-weapon color, hex number, or 'rainbow'
    var tracerColorOverride = null;

    // ── Reusable Scratch Vectors & Quaternions (Zero GC per frame) ──────────────
    var _v1       = null;
    var _v2       = null;
    var _v3       = null;
    var _q1       = null;
    var _unitY    = null;
    var _unitZ    = null;

    function initScratch(T) {
        if (!_v1) {
            _v1    = new T.Vector3();
            _v2    = new T.Vector3();
            _v3    = new T.Vector3();
            _q1    = new T.Quaternion();
            _unitY = new T.Vector3(0, 1, 0);
            _unitZ = new T.Vector3(0, 0, 1);
        }
    }

    // ── Common Viewmodel Materials Helper ──────────────────────────────────────
    function applyViewmodelStyle(mesh, mat, renderOrder) {
        mat.depthTest = false;
        mat.depthWrite = false;
        mesh.material = mat;
        mesh.renderOrder = (renderOrder !== undefined) ? renderOrder : 999;
        return mesh;
    }

    function createMat(T, color, emissive, isGolden) {
        var mat = new T.MeshLambertMaterial({
            color: color !== undefined ? color : 0x22262c,
            emissive: emissive !== undefined ? emissive : 0x000000
        });
        mat.depthTest = false;
        mat.depthWrite = false;
        return mat;
    }

    // ── Canvas-Generated Muzzle Flash Texture ───────────────────────────────────
    var muzzleFlashTexture = null;

    function getMuzzleFlashTexture(T) {
        if (muzzleFlashTexture) return muzzleFlashTexture;
        if (typeof document === 'undefined') return null;

        var canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        var ctx = canvas.getContext('2d');
        var cx = 64, cy = 64;

        ctx.clearRect(0, 0, 128, 128);

        // Soft radial glow (orange-yellow)
        var rad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
        rad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        rad.addColorStop(0.18, 'rgba(255, 225, 90, 0.95)');
        rad.addColorStop(0.45, 'rgba(255, 130, 25, 0.65)');
        rad.addColorStop(0.75, 'rgba(255, 60, 0, 0.20)');
        rad.addColorStop(1.0, 'rgba(255, 40, 0, 0.0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();

        // 8-point bright star spikes
        function drawSpike(angle, length, width, color) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, -width);
            ctx.lineTo(length, 0);
            ctx.lineTo(0, width);
            ctx.lineTo(-width * 0.35, 0);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
        }

        for (var i = 0; i < 4; i++) {
            var a = (i * Math.PI) / 2;
            drawSpike(a, 58, 9, 'rgba(255, 250, 200, 0.95)');
            drawSpike(a + Math.PI / 4, 36, 6, 'rgba(255, 180, 50, 0.75)');
        }

        // Hot white central core
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.fill();

        muzzleFlashTexture = new T.CanvasTexture(canvas);
        muzzleFlashTexture.needsUpdate = true;
        return muzzleFlashTexture;
    }

    // ── Recursive Disposal Helper ──────────────────────────────────────────────
    function disposeHierarchy(obj) {
        if (!obj) return;
        for (var i = obj.children.length - 1; i >= 0; i--) {
            disposeHierarchy(obj.children[i]);
        }
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                for (var m = 0; m < obj.material.length; m++) {
                    if (obj.material[m]) obj.material[m].dispose();
                }
            } else {
                obj.material.dispose();
            }
        }
        if (obj.parent) {
            obj.parent.remove(obj);
        }
    }

    // ── Weapon Builders (Unique Silhouettes & Neon Details) ─────────────────────
    function normalizeId(id) {
        if (id === 'gg_pistol')   return 'pistol';
        if (id === 'gg_smg')      return 'smg';
        if (id === 'gg_rifle')    return 'rifle';
        if (id === 'gg_shotgun')  return 'shotgun';
        if (id === 'gg_sniper')   return 'sniper';
        return id;
    }

    // ── Weapon Skins ───────────────────────────────────────────────────────────
    var SKIN_DEFAULTS = { body: 0x1f2329, accent: 0x00eeff, emissive: 0x0099bb, anim: null };
    var GOLD_BODY     = 0xffc93c;
    var GOLD_EMISSIVE = 0x4a3500;

    function skinColor(T) {
        if (!_skinColor) _skinColor = new T.Color();
        return _skinColor;
    }

    // Accepts { body, accent, emissive, anim } or null; fills missing fields.
    function normalizeSkin(skin) {
        if (!skin || typeof skin !== 'object') return null;
        return {
            body:     (typeof skin.body     === 'number') ? skin.body     : SKIN_DEFAULTS.body,
            accent:   (typeof skin.accent   === 'number') ? skin.accent   : SKIN_DEFAULTS.accent,
            emissive: (typeof skin.emissive === 'number') ? skin.emissive : SKIN_DEFAULTS.emissive,
            anim:     (skin.anim === 'pulse' || skin.anim === 'rainbow' || skin.anim === 'gold') ? skin.anim : null
        };
    }

    /**
     * Applies the current skin to the shared viewmodel materials.
     * deepBlack, woodBrown and goldMat are never touched.
     */
    function applySkinToMaterials(T, darkMetal, frameGrey, neonCyan) {
        skinAccentMats.length = 0;
        if (!currentSkin) return;

        var isGold = currentSkin.anim === 'gold';
        var bodyHex = isGold ? GOLD_BODY : currentSkin.body;

        darkMetal.color.setHex(bodyHex);
        darkMetal.emissive.setHex(isGold ? GOLD_EMISSIVE : 0x000000);

        // frameGrey: same body color, 15% lighter towards white
        frameGrey.color.setHex(bodyHex);
        frameGrey.color.lerp(skinColor(T).setHex(0xffffff), 0.15);
        frameGrey.emissive.setHex(isGold ? GOLD_EMISSIVE : 0x000000);

        neonCyan.color.setHex(currentSkin.accent);
        neonCyan.emissive.setHex(currentSkin.emissive);

        if (isGold) {
            // Gold glows on the body panels
            skinAccentMats.push(darkMetal, frameGrey);
        } else {
            skinAccentMats.push(neonCyan);
        }
    }

    /**
     * Per-frame skin animation ('pulse' | 'rainbow' | 'gold').
     * Uses the shared scratch color (zero allocation per frame).
     */
    function updateSkinAnim(T, delta) {
        if (!currentSkin || !currentSkin.anim || skinAccentMats.length === 0) return;

        skinTime += delta;
        var i, mat, c, k;

        if (currentSkin.anim === 'pulse') {
            k = 0.55 + 0.45 * Math.sin(skinTime * 4);
            c = skinColor(T).setHex(currentSkin.emissive).multiplyScalar(k);
            for (i = 0; i < skinAccentMats.length; i++) {
                skinAccentMats[i].emissive.copy(c);
            }
        } else if (currentSkin.anim === 'rainbow') {
            c = skinColor(T).setHSL((skinTime * 0.25) % 1, 1, 0.55);
            for (i = 0; i < skinAccentMats.length; i++) {
                mat = skinAccentMats[i];
                mat.color.copy(c);
                mat.emissive.copy(c).multiplyScalar(0.5);
            }
        } else if (currentSkin.anim === 'gold') {
            k = 0.6 + 0.4 * Math.sin(skinTime * 2.2);
            c = skinColor(T).setHex(GOLD_EMISSIVE).multiplyScalar(k);
            for (i = 0; i < skinAccentMats.length; i++) {
                skinAccentMats[i].emissive.copy(c);
            }
        }
    }

    function buildModel(T, id, group) {
        barrelsGroup = null; // reset minigun reference

        // Reusable shared materials for this weapon instance
        var darkMetal = createMat(T, 0x1f2329, 0x000000);
        var frameGrey = createMat(T, 0x2d333b, 0x000000);
        var deepBlack = createMat(T, 0x111317, 0x000000);
        var neonCyan  = createMat(T, 0x00eeff, 0x0099bb);
        var woodBrown = createMat(T, 0x7a431d, 0x000000);
        var goldMat   = createMat(T, 0xffd700, 0x4a3b00);

        applySkinToMaterials(T, darkMetal, frameGrey, neonCyan);

        var norm = normalizeId(id);

        // Marker for the tip of the barrel/weapon
        var marker = new T.Object3D();

        if (norm === 'pistol') {
            // ── Pistol: Short slide, angled grip, cyan top strip ──
            var slide = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.046, 0.052, 0.20), darkMetal), darkMetal, 998);
            slide.position.set(0, 0.02, -0.06);
            group.add(slide);

            var grip = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.038, 0.12, 0.052), frameGrey), frameGrey, 998);
            grip.position.set(0, -0.055, 0.015);
            grip.rotation.x = 0.24;
            group.add(grip);

            var triggerGuard = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.012, 0.032, 0.05), deepBlack), deepBlack, 999);
            triggerGuard.position.set(0, -0.028, -0.035);
            group.add(triggerGuard);

            var cyanStrip = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.014, 0.008, 0.15), neonCyan), neonCyan, 1000);
            cyanStrip.position.set(0, 0.048, -0.06);
            group.add(cyanStrip);

            marker.position.set(0, 0.026, -0.165);
            group.add(marker);

        } else if (norm === 'gg_revolver') {
            // ── Revolver: Cylindrical drum, octagonal barrel, classic grip ──
            var rFrame = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.042, 0.062, 0.16), darkMetal), darkMetal, 998);
            rFrame.position.set(0, 0.02, -0.04);
            group.add(rFrame);

            // Cylindrical rotating drum
            var drumGeo = new T.CylinderGeometry(0.034, 0.034, 0.075, 12);
            drumGeo.rotateX(Math.PI / 2);
            var drum = applyViewmodelStyle(new T.Mesh(drumGeo, deepBlack), deepBlack, 999);
            drum.position.set(0, 0.016, -0.04);
            group.add(drum);

            // Barrel extending forward
            var rBarrel = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.032, 0.044, 0.22), darkMetal), darkMetal, 998);
            rBarrel.position.set(0, 0.032, -0.16);
            group.add(rBarrel);

            var rGrip = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.036, 0.13, 0.06), woodBrown), woodBrown, 998);
            rGrip.position.set(0, -0.065, 0.025);
            rGrip.rotation.x = 0.32;
            group.add(rGrip);

            // Hammer
            var hammer = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.014, 0.03, 0.025), frameGrey), frameGrey, 999);
            hammer.position.set(0, 0.048, 0.04);
            hammer.rotation.x = -0.3;
            group.add(hammer);

            // Neon cylinder chamber indicators
            var rNeon = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.038, 0.008, 0.075), neonCyan), neonCyan, 1000);
            rNeon.position.set(0, 0.046, -0.04);
            group.add(rNeon);

            marker.position.set(0, 0.032, -0.275);
            group.add(marker);

        } else if (norm === 'smg') {
            // ── SMG: Compact rectangular body, long stick magazine, front grip ──
            var smgBody = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.052, 0.078, 0.30), darkMetal), darkMetal, 998);
            smgBody.position.set(0, 0.02, -0.08);
            group.add(smgBody);

            var smgGrip = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.04, 0.125, 0.05), frameGrey), frameGrey, 998);
            smgGrip.position.set(0, -0.06, 0.01);
            smgGrip.rotation.x = 0.26;
            group.add(smgGrip);

            // Long straight magazine protruding downwards
            var smgMag = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.032, 0.19, 0.042), deepBlack), deepBlack, 999);
            smgMag.position.set(0, -0.11, -0.09);
            smgMag.rotation.x = 0.12;
            group.add(smgMag);

            // Compact barrel with cylindrical compensator
            var smgCompGeo = new T.CylinderGeometry(0.018, 0.018, 0.09, 8);
            smgCompGeo.rotateX(Math.PI / 2);
            var smgComp = applyViewmodelStyle(new T.Mesh(smgCompGeo, frameGrey), frameGrey, 999);
            smgComp.position.set(0, 0.025, -0.265);
            group.add(smgComp);

            // Neon ammo strip along receiver
            var smgNeon = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.054, 0.01, 0.22), neonCyan), neonCyan, 1000);
            smgNeon.position.set(0, 0.05, -0.08);
            group.add(smgNeon);

            marker.position.set(0, 0.025, -0.315);
            group.add(marker);

        } else if (norm === 'rifle') {
            // ── Rifle: Stock, curved magazine, Picatinny sight, vented handguard ──
            var rfBody = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.054, 0.076, 0.32), darkMetal), darkMetal, 998);
            rfBody.position.set(0, 0.02, -0.08);
            group.add(rfBody);

            // Solid shoulder stock
            var rfStock = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.044, 0.095, 0.20), frameGrey), frameGrey, 998);
            rfStock.position.set(0, -0.005, 0.16);
            rfStock.rotation.x = -0.06;
            group.add(rfStock);

            // Curved magazine (curved via 2 segments)
            var rfMag1 = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.035, 0.10, 0.055), deepBlack), deepBlack, 999);
            rfMag1.position.set(0, -0.07, -0.05);
            rfMag1.rotation.x = 0.20;
            group.add(rfMag1);

            var rfMag2 = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.033, 0.09, 0.052), deepBlack), deepBlack, 999);
            rfMag2.position.set(0, -0.145, -0.025);
            rfMag2.rotation.x = 0.45;
            group.add(rfMag2);

            var rfGrip = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.038, 0.12, 0.052), frameGrey), frameGrey, 998);
            rfGrip.position.set(0, -0.065, 0.03);
            rfGrip.rotation.x = 0.28;
            group.add(rfGrip);

            // Handguard
            var rfGuard = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.052, 0.064, 0.22), frameGrey), frameGrey, 998);
            rfGuard.position.set(0, 0.02, -0.28);
            group.add(rfGuard);

            // Extended barrel + muzzle brake
            var rfBarGeo = new T.CylinderGeometry(0.013, 0.013, 0.24, 8);
            rfBarGeo.rotateX(Math.PI / 2);
            var rfBar = applyViewmodelStyle(new T.Mesh(rfBarGeo, deepBlack), deepBlack, 998);
            rfBar.position.set(0, 0.024, -0.42);
            group.add(rfBar);

            // Holographic sight on top rail
            var rfSight = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.036, 0.034, 0.08), deepBlack), deepBlack, 999);
            rfSight.position.set(0, 0.074, -0.10);
            group.add(rfSight);

            var rfReticle = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.026, 0.024, 0.008), neonCyan), neonCyan, 1000);
            rfReticle.position.set(0, 0.076, -0.10);
            group.add(rfReticle);

            marker.position.set(0, 0.024, -0.545);
            group.add(marker);

        } else if (norm === 'shotgun') {
            // ── Shotgun: Thick long barrel, wooden pump forend, sturdy stock ──
            var shBody = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.058, 0.082, 0.24), darkMetal), darkMetal, 998);
            shBody.position.set(0, 0.02, -0.06);
            group.add(shBody);

            // Main heavy barrel
            var shBarGeo = new T.CylinderGeometry(0.021, 0.021, 0.46, 10);
            shBarGeo.rotateX(Math.PI / 2);
            var shBar = applyViewmodelStyle(new T.Mesh(shBarGeo, deepBlack), deepBlack, 998);
            shBar.position.set(0, 0.034, -0.32);
            group.add(shBar);

            // Lower magazine tube
            var shTubeGeo = new T.CylinderGeometry(0.017, 0.017, 0.40, 10);
            shTubeGeo.rotateX(Math.PI / 2);
            var shTube = applyViewmodelStyle(new T.Mesh(shTubeGeo, frameGrey), frameGrey, 998);
            shTube.position.set(0, -0.002, -0.29);
            group.add(shTube);

            // Wooden handguard / forend (pump)
            var shForend = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.062, 0.058, 0.17), woodBrown), woodBrown, 999);
            shForend.position.set(0, -0.002, -0.26);
            group.add(shForend);

            // Wooden stock
            var shStock = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.046, 0.10, 0.22), woodBrown), woodBrown, 998);
            shStock.position.set(0, -0.01, 0.14);
            group.add(shStock);

            // Cyan shell indicator trim
            var shNeon = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.060, 0.012, 0.08), neonCyan), neonCyan, 1000);
            shNeon.position.set(0, 0.03, -0.06);
            group.add(shNeon);

            marker.position.set(0, 0.034, -0.555);
            group.add(marker);

        } else if (norm === 'sniper') {
            // ── Sniper: Very long barrel, large cylindrical scope, heavy chassis ──
            var snBody = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.052, 0.082, 0.38), darkMetal), darkMetal, 998);
            snBody.position.set(0, 0.02, -0.08);
            group.add(snBody);

            // Very long barrel
            var snBarGeo = new T.CylinderGeometry(0.014, 0.014, 0.65, 8);
            snBarGeo.rotateX(Math.PI / 2);
            var snBar = applyViewmodelStyle(new T.Mesh(snBarGeo, deepBlack), deepBlack, 998);
            snBar.position.set(0, 0.03, -0.50);
            group.add(snBar);

            // Large muzzle brake
            var snMuzzleGeo = new T.BoxGeometry(0.036, 0.036, 0.07);
            var snMuzzle = applyViewmodelStyle(new T.Mesh(snMuzzleGeo, frameGrey), frameGrey, 999);
            snMuzzle.position.set(0, 0.03, -0.83);
            group.add(snMuzzle);

            // Cylindrical telescopic scope
            var snScopeGeo = new T.CylinderGeometry(0.028, 0.032, 0.28, 12);
            snScopeGeo.rotateX(Math.PI / 2);
            var snScope = applyViewmodelStyle(new T.Mesh(snScopeGeo, deepBlack), deepBlack, 999);
            snScope.position.set(0, 0.088, -0.10);
            group.add(snScope);

            // Scope riser rings
            var snRing1 = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.038, 0.03, 0.024), frameGrey), frameGrey, 998);
            snRing1.position.set(0, 0.065, -0.03);
            group.add(snRing1);
            var snRing2 = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.038, 0.03, 0.024), frameGrey), frameGrey, 998);
            snRing2.position.set(0, 0.065, -0.17);
            group.add(snRing2);

            // Glowing cyan lens
            var snLens = applyViewmodelStyle(new T.Mesh(new T.CircleGeometry(0.025, 12), neonCyan), neonCyan, 1000);
            snLens.position.set(0, 0.088, -0.241);
            group.add(snLens);

            // Stock with cheek rest
            var snStock = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.042, 0.11, 0.24), frameGrey), frameGrey, 998);
            snStock.position.set(0, -0.01, 0.18);
            group.add(snStock);

            // Bipod folded
            var snBipod = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.046, 0.022, 0.14), deepBlack), deepBlack, 999);
            snBipod.position.set(0, -0.015, -0.32);
            group.add(snBipod);

            marker.position.set(0, 0.03, -0.87);
            group.add(marker);

        } else if (norm === 'gg_minigun') {
            // ── Minigun: 6 barrels in a circle rotating when firing, motor body ──
            var mgMotorGeo = new T.CylinderGeometry(0.068, 0.068, 0.22, 12);
            mgMotorGeo.rotateX(Math.PI / 2);
            var mgMotor = applyViewmodelStyle(new T.Mesh(mgMotorGeo, darkMetal), darkMetal, 998);
            mgMotor.position.set(0, 0.02, 0.02);
            group.add(mgMotor);

            // Top carrying handle & grip
            var mgHandle = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.038, 0.06, 0.18), frameGrey), frameGrey, 999);
            mgHandle.position.set(0, 0.09, 0.01);
            group.add(mgHandle);

            // Rotating barrel assembly
            barrelsGroup = new T.Group();
            barrelsGroup.position.set(0, 0.02, -0.09);
            group.add(barrelsGroup);

            // Central core cylinder
            var hubGeo = new T.CylinderGeometry(0.026, 0.026, 0.50, 8);
            hubGeo.rotateX(Math.PI / 2);
            var hub = applyViewmodelStyle(new T.Mesh(hubGeo, deepBlack), deepBlack, 998);
            hub.position.set(0, 0, -0.25);
            barrelsGroup.add(hub);

            // 6 peripheral barrels in circle
            var barrelRadius = 0.042;
            var barGeo = new T.CylinderGeometry(0.011, 0.011, 0.52, 6);
            barGeo.rotateX(Math.PI / 2);

            for (var b = 0; b < 6; b++) {
                var angle = (b * Math.PI * 2) / 6;
                var bx = Math.cos(angle) * barrelRadius;
                var by = Math.sin(angle) * barrelRadius;
                var singleBar = applyViewmodelStyle(new T.Mesh(barGeo, frameGrey), frameGrey, 998);
                singleBar.position.set(bx, by, -0.26);
                barrelsGroup.add(singleBar);
            }

            // 2 Stabilizer clamping rings along barrels
            var ringGeo = new T.CylinderGeometry(0.058, 0.058, 0.02, 12);
            ringGeo.rotateX(Math.PI / 2);
            var ring1 = applyViewmodelStyle(new T.Mesh(ringGeo, deepBlack), deepBlack, 999);
            ring1.position.set(0, 0, -0.22);
            barrelsGroup.add(ring1);
            var ring2 = applyViewmodelStyle(new T.Mesh(ringGeo, deepBlack), deepBlack, 999);
            ring2.position.set(0, 0, -0.46);
            barrelsGroup.add(ring2);

            // Neon vent bands on motor
            var mgNeon = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.074, 0.014, 0.16), neonCyan), neonCyan, 1000);
            mgNeon.position.set(0, 0.065, 0.02);
            group.add(mgNeon);

            marker.position.set(0, 0.02, -0.63);
            group.add(marker);

        } else if (norm === 'gg_rpg') {
            // ── RPG: Thick launch tube, optical sight, green warhead rocket at tip ──
            var rpgTubeGeo = new T.CylinderGeometry(0.040, 0.040, 0.58, 12);
            rpgTubeGeo.rotateX(Math.PI / 2);
            var rpgTube = applyViewmodelStyle(new T.Mesh(rpgTubeGeo, darkMetal), darkMetal, 998);
            rpgTube.position.set(0, 0.03, -0.06);
            group.add(rpgTube);

            // Rear blast cone
            var coneGeo = new T.CylinderGeometry(0.062, 0.040, 0.14, 12);
            coneGeo.rotateX(Math.PI / 2);
            var cone = applyViewmodelStyle(new T.Mesh(coneGeo, frameGrey), frameGrey, 998);
            cone.position.set(0, 0.03, 0.28);
            group.add(cone);

            // Dual grips underneath
            var rpgGrip1 = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.036, 0.13, 0.048), frameGrey), frameGrey, 999);
            rpgGrip1.position.set(0, -0.06, -0.02);
            group.add(rpgGrip1);
            var rpgGrip2 = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.034, 0.11, 0.044), frameGrey), frameGrey, 999);
            rpgGrip2.position.set(0, -0.05, -0.22);
            group.add(rpgGrip2);

            // Sight box on left
            var rpgSight = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.032, 0.045, 0.08), deepBlack), deepBlack, 999);
            rpgSight.position.set(-0.045, 0.06, -0.08);
            group.add(rpgSight);

            // Green rocket warhead on the tip!
            var greenRocketMat = createMat(T, 0x2e7d32, 0x0a220c);

            var warheadBaseGeo = new T.CylinderGeometry(0.056, 0.056, 0.10, 10);
            warheadBaseGeo.rotateX(Math.PI / 2);
            var warheadBase = applyViewmodelStyle(new T.Mesh(warheadBaseGeo, greenRocketMat), greenRocketMat, 999);
            warheadBase.position.set(0, 0.03, -0.40);
            group.add(warheadBase);

            var warheadTipGeo = new T.ConeGeometry(0.056, 0.14, 10);
            warheadTipGeo.rotateX(-Math.PI / 2);
            var warheadTip = applyViewmodelStyle(new T.Mesh(warheadTipGeo, greenRocketMat), greenRocketMat, 999);
            warheadTip.position.set(0, 0.03, -0.52);
            group.add(warheadTip);

            // Fuze pin
            var fuzeGeo = new T.CylinderGeometry(0.008, 0.008, 0.05, 6);
            fuzeGeo.rotateX(Math.PI / 2);
            var fuze = applyViewmodelStyle(new T.Mesh(fuzeGeo, frameGrey), frameGrey, 999);
            fuze.position.set(0, 0.03, -0.61);
            group.add(fuze);

            // Neon indicator
            var rpgNeon = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.01, 0.015, 0.03), neonCyan), neonCyan, 1000);
            rpgNeon.position.set(-0.062, 0.07, -0.08);
            group.add(rpgNeon);

            marker.position.set(0, 0.03, -0.64);
            group.add(marker);

        } else if (norm === 'gg_bat') {
            // ── Baseball Bat: Smooth wooden profile, grip tape, no barrel! ──
            var batHandleGeo = new T.CylinderGeometry(0.016, 0.016, 0.18, 10);
            batHandleGeo.rotateX(Math.PI / 2);
            var batHandle = applyViewmodelStyle(new T.Mesh(batHandleGeo, deepBlack), deepBlack, 998);
            batHandle.position.set(0, -0.02, 0.06);
            group.add(batHandle);

            // Handle knob
            var batKnobGeo = new T.CylinderGeometry(0.025, 0.025, 0.022, 10);
            batKnobGeo.rotateX(Math.PI / 2);
            var batKnob = applyViewmodelStyle(new T.Mesh(batKnobGeo, woodBrown), woodBrown, 999);
            batKnob.position.set(0, -0.02, 0.155);
            group.add(batKnob);

            // Tapered middle transition
            var batMidGeo = new T.CylinderGeometry(0.034, 0.016, 0.22, 10);
            batMidGeo.rotateX(Math.PI / 2);
            var batMid = applyViewmodelStyle(new T.Mesh(batMidGeo, woodBrown), woodBrown, 998);
            batMid.position.set(0, 0.005, -0.14);
            group.add(batMid);

            // Thick barrel/striking section
            var batHeadGeo = new T.CylinderGeometry(0.040, 0.034, 0.26, 10);
            batHeadGeo.rotateX(Math.PI / 2);
            var batHead = applyViewmodelStyle(new T.Mesh(batHeadGeo, woodBrown), woodBrown, 998);
            batHead.position.set(0, 0.03, -0.37);
            group.add(batHead);

            // Neon energy coil wrapped along the bat
            var batNeon = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.044, 0.01, 0.24), neonCyan), neonCyan, 1000);
            batNeon.position.set(0, 0.065, -0.37);
            group.add(batNeon);

            marker.position.set(0, 0.03, -0.51);
            group.add(marker);

        } else if (norm === 'gg_golden') {
            // ── Golden Pistol: Gleaming gold emissive Lambert finish ──
            var gSlide = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.048, 0.054, 0.21), goldMat), goldMat, 998);
            gSlide.position.set(0, 0.02, -0.06);
            group.add(gSlide);

            var gGrip = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.040, 0.125, 0.054), goldMat), goldMat, 998);
            gGrip.position.set(0, -0.055, 0.015);
            gGrip.rotation.x = 0.24;
            group.add(gGrip);

            // Pearlescent / deep black luxury grip insert
            var gInsert = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.042, 0.09, 0.038), deepBlack), deepBlack, 999);
            gInsert.position.set(0, -0.055, 0.015);
            gInsert.rotation.x = 0.24;
            group.add(gInsert);

            var gGuard = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.014, 0.034, 0.052), goldMat), goldMat, 999);
            gGuard.position.set(0, -0.028, -0.035);
            group.add(gGuard);

            // Subtle gold/white emissive trim
            var goldTrim = createMat(T, 0xfff0aa, 0x997700);
            var gTrimMesh = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.016, 0.01, 0.16), goldTrim), goldTrim, 1000);
            gTrimMesh.position.set(0, 0.05, -0.06);
            group.add(gTrimMesh);

            marker.position.set(0, 0.026, -0.17);
            group.add(marker);

        } else {
            // Default fallback: Compact pistol
            var defSlide = applyViewmodelStyle(new T.Mesh(new T.BoxGeometry(0.046, 0.052, 0.20), darkMetal), darkMetal, 998);
            defSlide.position.set(0, 0.02, -0.06);
            group.add(defSlide);
            marker.position.set(0, 0.026, -0.165);
            group.add(marker);
        }

        addHands(T, norm, group);

        return marker;
    }

    // ── Hands ──────────────────────────────────────────────────────────────────
    // Anchors in weapon space. `grip` is the trigger hand, `support` the off
    // hand under the forend (two-handed weapons only). The viewmodel renders
    // without depth test, so only parts visible from behind-left are modelled
    // and renderOrder does the layering: sleeves behind the gun, gloves over it.
    var HAND_ANCHORS = {
        pistol:      { grip: [0, -0.066, 0.020], tilt: 0.24 },
        gg_revolver: { grip: [0, -0.075, 0.032], tilt: 0.32 },
        gg_golden:   { grip: [0, -0.066, 0.020], tilt: 0.24 },
        smg:         { grip: [0, -0.072, 0.014], tilt: 0.26, support: [0, -0.045, -0.20] },
        rifle:       { grip: [0, -0.076, 0.034], tilt: 0.28, support: [0, -0.040, -0.29] },
        shotgun:     { grip: [0, -0.040, 0.080], tilt: 0.55, support: [0, -0.052, -0.26] },
        sniper:      { grip: [0, -0.045, 0.100], tilt: 0.55, support: [0, -0.050, -0.22] },
        gg_minigun:  { grip: [0,  0.100, 0.020], tilt: 0.00, support: [0, -0.075, -0.05] },
        gg_rpg:      { grip: [0, -0.075, -0.02], tilt: 0.00, support: [0, -0.065, -0.22] },
        gg_bat:      { grip: [0, -0.020, 0.090], tilt: 1.35, support: [0, -0.020, 0.025] }
    };

    var ORDER_SLEEVE = 990;
    var ORDER_GLOVE  = 999.4;
    var ORDER_THUMB  = 999.6;

    function addHandPart(T, parent, size, at, material, order) {
        var mesh = applyViewmodelStyle(
            new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), material), material, order);
        mesh.position.set(at[0], at[1], at[2]);
        parent.add(mesh);
        return mesh;
    }

    // Sleeve hanging from the wrist toward the bottom of the screen. No accent
    // trim here: without depth test every face of a band would draw, and a
    // bright block that close to the camera pulls the eye off the crosshair.
    function addForearm(T, group, wrist, turn, materials) {
        var forearm = new T.Group();
        forearm.position.set(wrist[0], wrist[1], wrist[2]);
        forearm.rotation.set(turn[0], turn[1], 0);
        addHandPart(T, forearm, [0.056, 0.062, 0.40], [0, 0, 0.22], materials.sleeve, ORDER_SLEEVE);
        group.add(forearm);
    }

    function addHands(T, norm, group) {
        var anchor = HAND_ANCHORS[norm];
        if (!anchor) return;
        // Lighter than the gun metal and slightly self-lit so the gloves read
        // as hands instead of merging into the weapon silhouette.
        var materials = {
            glove:  createMat(T, 0x4a5572, 0x0d1018),
            sleeve: createMat(T, 0x1c2130, 0x05070b)
        };

        var g = anchor.grip;
        var glove = addHandPart(T, group, [0.064, 0.082, 0.070], g, materials.glove, ORDER_GLOVE);
        glove.rotation.x = anchor.tilt;
        addHandPart(T, group, [0.020, 0.030, 0.060], [g[0] - 0.036, g[1] + 0.034, g[2] - 0.012], materials.glove, ORDER_THUMB);
        addForearm(T, group, [g[0] + 0.004, g[1] - 0.02, g[2] + 0.03], [0.32, 0.15], materials);

        var s = anchor.support;
        if (!s) return;
        addHandPart(T, group, [0.076, 0.046, 0.086], s, materials.glove, ORDER_GLOVE);
        addHandPart(T, group, [0.018, 0.042, 0.060], [s[0] - 0.042, s[1] + 0.03, s[2]], materials.glove, ORDER_THUMB);
        addForearm(T, group, [s[0] - 0.01, s[1] - 0.012, s[2] + 0.02], [0.45, -0.75], materials);
    }

    // ── Tracer Pool (Max 40) ───────────────────────────────────────────────────
    var TRACER_POOL_SIZE = 40;
    var tracerPool = [];
    var tracerSharedGeo = null;

    function initTracerPool(T, scene) {
        if (tracerPool.length > 0) return;
        // Shared unit cylinder (height 1 along Y, radius 1)
        tracerSharedGeo = new T.CylinderGeometry(1, 1, 1, 6);

        for (var i = 0; i < TRACER_POOL_SIZE; i++) {
            var mat = new T.MeshBasicMaterial({
                color: 0xffea44,
                transparent: true,
                opacity: 1.0,
                blending: T.AdditiveBlending,
                depthWrite: false
            });
            var mesh = new T.Mesh(tracerSharedGeo, mat);
            mesh.visible = false;
            scene.add(mesh);

            tracerPool.push({
                mesh: mesh,
                material: mat,
                active: false,
                life: 0.0,
                maxLife: 0.1
            });
        }
    }

    // ── Impact Wall Decal Pool (Max 60) ────────────────────────────────────────
    var DECAL_POOL_SIZE = 60;
    var decalPool = [];
    var decalSharedGeo = null;

    function initDecalPool(T, scene) {
        if (decalPool.length > 0) return;
        decalSharedGeo = new T.CircleGeometry(0.055, 8);

        for (var i = 0; i < DECAL_POOL_SIZE; i++) {
            var mat = new T.MeshBasicMaterial({
                color: 0x141416,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -1.5,
                polygonOffsetUnits: -1.5
            });
            var mesh = new T.Mesh(decalSharedGeo, mat);
            mesh.visible = false;
            scene.add(mesh);

            decalPool.push({
                mesh: mesh,
                material: mat,
                active: false,
                life: 0.0,
                maxLife: 6.0
            });
        }
    }

    // ── Impact Particles Pool (Sparks & Flesh, Max 160) ─────────────────────────
    var PARTICLE_POOL_SIZE = 160;
    var particlePool = [];
    var particleSharedGeo = null;

    function initParticlePool(T, scene) {
        if (particlePool.length > 0) return;
        particleSharedGeo = new T.BoxGeometry(0.024, 0.024, 0.024);

        for (var i = 0; i < PARTICLE_POOL_SIZE; i++) {
            var mat = new T.MeshBasicMaterial({
                color: 0xffbb33,
                transparent: true,
                opacity: 1.0,
                depthWrite: false
            });
            var mesh = new T.Mesh(particleSharedGeo, mat);
            mesh.visible = false;
            scene.add(mesh);

            particlePool.push({
                mesh: mesh,
                material: mat,
                pos: new T.Vector3(),
                vel: new T.Vector3(),
                gravity: 18.0,
                active: false,
                life: 0.0,
                maxLife: 0.25
            });
        }
    }

    // ── Rocket Trail Particles Pool (Max 60) ───────────────────────────────────
    var ROCKET_TRAIL_POOL_SIZE = 60;
    var rocketTrailPool = [];
    var rocketTrailSharedGeo = null;

    function initRocketTrailPool(T, scene) {
        if (rocketTrailPool.length > 0) return;
        rocketTrailSharedGeo = new T.BoxGeometry(0.035, 0.035, 0.035);

        for (var i = 0; i < ROCKET_TRAIL_POOL_SIZE; i++) {
            var mat = new T.MeshBasicMaterial({
                color: 0xff7722,
                transparent: true,
                opacity: 0.85,
                blending: T.AdditiveBlending,
                depthWrite: false
            });
            var mesh = new T.Mesh(rocketTrailSharedGeo, mat);
            mesh.visible = false;
            scene.add(mesh);

            rocketTrailPool.push({
                mesh: mesh,
                material: mat,
                pos: new T.Vector3(),
                active: false,
                life: 0.0,
                maxLife: 0.22,
                scale: 1.0
            });
        }
    }

    var activeRockets = [];

    // ── WeaponFX Public Interface ──────────────────────────────────────────────
    var WeaponFX = {

        /**
         * Initializes references, viewmodel groups attached to camera,
         * pools for tracers, decals, and particles.
         */
        init: function (scene, camera) {
            var T = getTHREE();
            if (!T) return;

            sceneRef  = scene;
            cameraRef = camera;

            initScratch(T);

            // Viewmodel root positioned in camera space
            if (viewmodelRoot && viewmodelRoot.parent) {
                viewmodelRoot.parent.remove(viewmodelRoot);
            }

            viewmodelRoot = new T.Group();
            viewmodelRoot.position.set(BASE_POS.x, BASE_POS.y, BASE_POS.z);
            camera.add(viewmodelRoot);

            animGroup = new T.Group();
            viewmodelRoot.add(animGroup);

            currentWeaponGroup = new T.Group();
            animGroup.add(currentWeaponGroup);

            // Muzzle flash billboard sprite & point light
            var flashTex = getMuzzleFlashTexture(T);
            var flashMat = new T.SpriteMaterial({
                map: flashTex,
                blending: T.AdditiveBlending,
                transparent: true,
                depthTest: false,
                depthWrite: false
            });
            flashSprite = new T.Sprite(flashMat);
            flashSprite.visible = false;
            flashSprite.renderOrder = 1000;
            flashSprite.scale.set(0.24, 0.24, 1);
            animGroup.add(flashSprite);

            flashLight = new T.PointLight(0xffaa33, 0, 5);
            animGroup.add(flashLight);

            // Initialize object pools in scene
            initTracerPool(T, scene);
            initDecalPool(T, scene);
            initParticlePool(T, scene);
            initRocketTrailPool(T, scene);
        },

        /**
         * Destroys previous model geometries/materials and constructs the
         * new weapon by ID with distinct silhouettes and details.
         */
        setWeapon: function (id) {
            var T = getTHREE();
            if (!T || !currentWeaponGroup) return;

            currentWeaponId = id;

            // Dispose previous weapon models
            while (currentWeaponGroup.children.length > 0) {
                var child = currentWeaponGroup.children[0];
                currentWeaponGroup.remove(child);
                disposeHierarchy(child);
            }

            // Build new weapon mesh hierarchy
            muzzleMarker = buildModel(T, id, currentWeaponGroup);

            // Place flash sprite & light at the muzzle position
            if (muzzleMarker) {
                flashSprite.position.copy(muzzleMarker.position);
                flashLight.position.copy(muzzleMarker.position);
            }

            // Trigger "equip" animation: rises smoothly from below (~180ms)
            equipProgress = 0.0;
            reloadDuration = 0.0; // switching weapons cancels the reload pose
        },

        /**
         * Plays the reload pose for the given duration (ms): the weapon dips,
         * rolls toward the off hand and snaps back as the magazine seats.
         */
        reload: function (durationMs) {
            reloadDuration = Math.max(0.2, (durationMs || 0) / 1000);
            reloadTimer = 0.0;
        },

        /**
         * Applies a weapon skin to the viewmodel.
         * skin: { body, accent, emissive, anim?: 'pulse'|'rainbow'|'gold' } or null
         * for the original look. Rebuilds the current weapon when equipped.
         */
        setSkin: function (skin) {
            currentSkin = normalizeSkin(skin);
            skinTime = 0.0;

            if (!currentWeaponGroup || !currentWeaponId) return;

            // Rebuild so materials pick up the new palette
            var keepEquip = equipProgress;
            WeaponFX.setWeapon(currentWeaponId);
            equipProgress = keepEquip; // no re-raise animation on skin change
        },

        /**
         * Overrides the tracer color: hex number, 'rainbow' (random hue per
         * tracer) or null to restore the per-weapon colors.
         * Thickness and duration stay per-weapon.
         */
        setTracerColor: function (c) {
            if (typeof c === 'number' && isFinite(c)) {
                tracerColorOverride = c;
            } else if (c === 'rainbow') {
                tracerColorOverride = 'rainbow';
            } else {
                tracerColorOverride = null;
            }
        },

        /**
         * Writes the world position of the current weapon muzzle into outVec3.
         */
        muzzleWorld: function (outVec3) {
            if (!outVec3) return;
            if (muzzleMarker) {
                muzzleMarker.getWorldPosition(outVec3);
            } else if (viewmodelRoot) {
                viewmodelRoot.getWorldPosition(outVec3);
            }
        },

        /**
         * Firing effects: recoil kick, muzzle flash sprite + light,
         * bat swing, minigun barrel acceleration.
         */
        fire: function (id) {
            var wid = id || currentWeaponId;
            var norm = normalizeId(wid);

            // Bat melee swing (no muzzle flash)
            if (norm === 'gg_bat') {
                isSwinging = true;
                swingTimer = 0.0;
                return;
            }

            // Muzzle flash: ~50ms additive billboard sprite + point light
            if (flashSprite && flashLight) {
                flashSprite.visible = true;
                flashSprite.material.rotation = Math.random() * Math.PI * 2;
                var randScale = 0.22 + Math.random() * 0.08;
                flashSprite.scale.set(randScale, randScale, 1);

                flashLight.intensity = 3.2;
                flashTimer = FLASH_DUR;
            }

            // Recoil kick & pitch rotation according to weapon profile
            if (norm === 'sniper') {
                recoilPos.z += 0.11;
                recoilRot.x += 0.26;
            } else if (norm === 'gg_rpg') {
                recoilPos.z += 0.13;
                recoilRot.x += 0.30;
            } else if (norm === 'shotgun') {
                recoilPos.z += 0.09;
                recoilRot.x += 0.22;
            } else if (norm === 'gg_revolver') {
                recoilPos.z += 0.065;
                recoilRot.x += 0.16;
            } else if (norm === 'rifle') {
                recoilPos.z += 0.045;
                recoilRot.x += 0.11;
            } else if (norm === 'gg_golden') {
                recoilPos.z += 0.06;
                recoilRot.x += 0.14;
            } else if (norm === 'smg') {
                recoilPos.z += 0.024;
                recoilRot.x += 0.045;
            } else if (norm === 'gg_minigun') {
                recoilPos.z += 0.020;
                recoilRot.x += 0.035;
                // Accelerate barrel spinning
                barrelSpinSpeed = Math.min(barrelSpinSpeed + 18.0, 52.0);
            } else {
                // Pistol & others
                recoilPos.z += 0.038;
                recoilRot.x += 0.085;
            }
        },

        /**
         * Reusable pool tracer between from and to.
         */
        tracer: function (from, to, id) {
            var T = getTHREE();
            if (!T || !tracerPool.length) return;

            var norm = normalizeId(id);

            // Find an inactive tracer or recycle the one nearest expiry
            var chosen = null;
            var minLife = 999;
            for (var i = 0; i < tracerPool.length; i++) {
                var t = tracerPool[i];
                if (!t.active) {
                    chosen = t;
                    break;
                }
                if (t.life < minLife) {
                    minLife = t.life;
                    chosen = t;
                }
            }
            if (!chosen) return;

            // Configure duration, color, and thickness per weapon
            var color = 0xffee33;
            var radius = 0.016;
            var duration = 0.08;

            if (norm === 'shotgun') {
                color = 0xff5511; // orange-red
                radius = 0.022;
                duration = 0.09;
            } else if (norm === 'sniper') {
                color = 0x00ffff; // cyan, thicker, longer lasting
                radius = 0.036;
                duration = 0.14;
            } else if (norm === 'gg_golden') {
                color = 0xffd700; // golden
                radius = 0.024;
                duration = 0.10;
            }

            // Position and orient cylinder between from and to
            _v1.addVectors(from, to).multiplyScalar(0.5);      // Midpoint
            var dist = from.distanceTo(to);
            _v2.subVectors(to, from).normalize();             // Direction

            _q1.setFromUnitVectors(_unitY, _v2);

            chosen.mesh.position.copy(_v1);
            chosen.mesh.quaternion.copy(_q1);
            chosen.mesh.scale.set(radius, dist, radius);

            chosen.material.color.setHex(color);
            if (tracerColorOverride === 'rainbow') {
                chosen.material.color.setHSL(Math.random(), 1, 0.6);
            } else if (tracerColorOverride !== null) {
                chosen.material.color.setHex(tracerColorOverride);
            }
            chosen.material.opacity = 1.0;
            chosen.mesh.visible = true;

            chosen.active = true;
            chosen.life = duration;
            chosen.maxLife = duration;
        },

        /**
         * Impact FX:
         * kind 'wall': 8 spark particles with gravity (~250ms) + dark bullet decal (6s)
         * kind 'flesh': 8 red blood particles
         * kind 'explosion': ignored (handled by game engine)
         */
        impact: function (point, normal, kind) {
            var T = getTHREE();
            if (!T) return;
            if (kind === 'explosion') return;

            // Wall bullet decal (pool max 60, 6s)
            if (kind === 'wall' && decalPool.length > 0) {
                var d = null;
                var minDLife = 999;
                for (var i = 0; i < decalPool.length; i++) {
                    if (!decalPool[i].active) {
                        d = decalPool[i];
                        break;
                    }
                    if (decalPool[i].life < minDLife) {
                        minDLife = decalPool[i].life;
                        d = decalPool[i];
                    }
                }
                if (d) {
                    d.mesh.position.copy(point).addScaledVector(normal, 0.006);
                    _q1.setFromUnitVectors(_unitZ, normal);
                    d.mesh.quaternion.copy(_q1);
                    d.mesh.rotateZ(Math.random() * Math.PI * 2);

                    var s = 0.85 + Math.random() * 0.35;
                    d.mesh.scale.set(s, s, 1);

                    d.material.opacity = 0.85;
                    d.mesh.visible = true;
                    d.active = true;
                    d.life = 6.0;
                    d.maxLife = 6.0;
                }
            }

            // 8 particles (sparks or blood)
            if (particlePool.length > 0) {
                var isWall = (kind === 'wall');
                var pColor = isWall ? 0xffbb22 : 0xaa0f18;
                var grav   = isWall ? 18.0 : 14.0;
                var baseSpd = isWall ? 4.5 : 2.5;

                var spawned = 0;
                for (var pIdx = 0; pIdx < particlePool.length && spawned < 8; pIdx++) {
                    var p = particlePool[pIdx];
                    if (p.active) continue;

                    p.pos.copy(point);
                    p.mesh.position.copy(point);

                    // Direction along normal + random cone scatter
                    p.vel.copy(normal).multiplyScalar(baseSpd + Math.random() * 2.5);
                    p.vel.x += (Math.random() - 0.5) * 4.0;
                    p.vel.y += (Math.random() - 0.5) * 4.0;
                    p.vel.z += (Math.random() - 0.5) * 4.0;

                    p.gravity = grav;
                    p.material.color.setHex(pColor);
                    p.material.opacity = 1.0;
                    p.mesh.visible = true;

                    p.active = true;
                    p.life = 0.25;
                    p.maxLife = 0.25;
                    spawned++;
                }
            }
        },

        /**
         * Spawns a visible projectile rocket (cylinder + fins + green head)
         * with particle trail. Returns {mesh, pos, dir, speed, alive: true}.
         */
        rocket: function (from, dir, speed) {
            var T = getTHREE();
            if (!T || !sceneRef) return null;

            var rGroup = new T.Group();

            // Rocket body
            var bodyMat = new T.MeshLambertMaterial({ color: 0x22262c });
            var bGeo = new T.CylinderGeometry(0.038, 0.038, 0.32, 8);
            var bMesh = new T.Mesh(bGeo, bodyMat);
            rGroup.add(bMesh);

            // Green warhead tip
            var tipMat = new T.MeshLambertMaterial({ color: 0x2e7d32, emissive: 0x0a220c });
            var tipGeo = new T.ConeGeometry(0.048, 0.12, 8);
            var tipMesh = new T.Mesh(tipGeo, tipMat);
            tipMesh.position.y = 0.20;
            rGroup.add(tipMesh);

            // Rear stabilizing fins
            var finMat = new T.MeshLambertMaterial({ color: 0x111317 });
            var finGeo = new T.BoxGeometry(0.14, 0.08, 0.012);
            var fin1 = new T.Mesh(finGeo, finMat);
            fin1.position.y = -0.12;
            rGroup.add(fin1);
            var fin2 = new T.Mesh(finGeo, finMat);
            fin2.position.y = -0.12;
            fin2.rotation.y = Math.PI / 2;
            rGroup.add(fin2);

            var normDir = dir.clone().normalize();
            var posVec  = from.clone();

            rGroup.position.copy(posVec);
            _q1.setFromUnitVectors(_unitY, normDir);
            rGroup.quaternion.copy(_q1);

            sceneRef.add(rGroup);

            var rocketObj = {
                mesh: rGroup,
                pos: posVec,
                dir: normDir,
                speed: speed,
                alive: true,
                trailAccum: 0.0
            };

            activeRockets.push(rocketObj);
            return rocketObj;
        },

        /**
         * Removes rocket projectile and cleans up its meshes.
         */
        removeRocket: function (r) {
            if (!r) return;
            r.alive = false;

            if (r.mesh) {
                if (sceneRef) sceneRef.remove(r.mesh);
                disposeHierarchy(r.mesh);
            }

            var idx = activeRockets.indexOf(r);
            if (idx !== -1) {
                activeRockets.splice(idx, 1);
            }
        },

        /**
         * Frame update:
         * - Recoil recovery
         * - Walk / sprint bobbing & lowering
         * - Subtle sway
         * - Bat swing animation
         * - Minigun barrel spin
         * - Muzzle flash timer
         * - Tracers, decals, particles, and rocket trails
         */
        update: function (delta, moving, sprinting) {
            if (!animGroup) return;
            delta = Math.min(delta, 0.1); // Guard against huge frame skips

            // 1. Equip animation (~180ms raise from below)
            if (equipProgress < 1.0) {
                equipProgress = Math.min(1.0, equipProgress + delta / EQUIP_DURATION);
            }
            var equipFactor = 1.0 - equipProgress;
            var equipY    = -0.22 * (equipFactor * equipFactor);
            var equipRotX = -0.30 * (equipFactor * equipFactor);

            // 2. Recoil recovery (exponential decay)
            recoilPos.z *= Math.exp(-20.0 * delta);
            recoilRot.x *= Math.exp(-18.0 * delta);

            // 3. Bat Melee Swing Animation
            if (isSwinging) {
                swingTimer += delta;
                if (swingTimer >= SWING_DUR) {
                    isSwinging = false;
                    swingTimer = 0.0;
                    swingYaw   = 0.0;
                    swingPitch = 0.0;
                    swingRoll  = 0.0;
                } else {
                    var st = swingTimer / SWING_DUR;
                    var arc = Math.sin(st * Math.PI);
                    swingYaw   = arc * 0.95;   // Horizontal strike swipe
                    swingPitch = arc * -0.24;  // Slight downward swing
                    swingRoll  = arc * 0.40;
                }
            }

            // 4. Walking & Sprinting Bobbing
            if (moving) {
                var bobSpeed = sprinting ? 13.5 : 8.5;
                bobPhase += delta * bobSpeed;

                var ampX = sprinting ? 0.024 : 0.012;
                var ampY = sprinting ? 0.020 : 0.010;
                bobPosX = Math.cos(bobPhase * 0.5) * ampX;
                bobPosY = Math.sin(bobPhase) * ampY;
                bobRotZ = Math.cos(bobPhase * 0.5) * (sprinting ? 0.06 : 0.03);
            } else {
                bobPosX *= Math.exp(-8.0 * delta);
                bobPosY *= Math.exp(-8.0 * delta);
                bobRotZ *= Math.exp(-8.0 * delta);
            }

            // 5. Sprint Posture (Weapon lowers and rotates downward/sideways)
            var targetSprintY    = sprinting ? -0.075 : 0.0;
            var targetSprintX    = sprinting ? -0.035 : 0.0;
            var targetSprintRotX = sprinting ? -0.26  : 0.0;
            var targetSprintRotY = sprinting ?  0.18  : 0.0;
            var targetSprintRotZ = sprinting ? -0.15  : 0.0;

            var sprintLerp = 1.0 - Math.exp(-10.0 * delta);
            sprintX    += (targetSprintX    - sprintX)    * sprintLerp;
            sprintY    += (targetSprintY    - sprintY)    * sprintLerp;
            sprintRotX += (targetSprintRotX - sprintRotX) * sprintLerp;
            sprintRotY += (targetSprintRotY - sprintRotY) * sprintLerp;
            sprintRotZ += (targetSprintRotZ - sprintRotZ) * sprintLerp;

            // 6. Subtle Breathing / Sway
            idlePhase += delta * 1.8;
            var swayX    = Math.sin(idlePhase * 0.8) * 0.0018;
            var swayY    = Math.cos(idlePhase * 1.6) * 0.0014;
            var swayRotX = Math.sin(idlePhase * 0.8) * 0.006;
            var swayRotY = Math.cos(idlePhase * 0.8) * 0.006;

            // 6b. Reload pose: ease down, hold, bump when the magazine seats, ease up
            var reloadY = 0.0, reloadRotX = 0.0, reloadRotZ = 0.0;
            if (reloadDuration > 0.0) {
                reloadTimer += delta;
                var rk = reloadTimer / reloadDuration;
                if (rk >= 1.0) {
                    reloadDuration = 0.0;
                } else {
                    var easeIn  = Math.min(1.0, rk / 0.18);
                    var easeOut = Math.min(1.0, (1.0 - rk) / 0.20);
                    var pose = Math.min(easeIn, easeOut);
                    pose = pose * pose * (3.0 - 2.0 * pose);
                    var seat = Math.exp(-Math.pow((rk - 0.62) / 0.045, 2.0));
                    reloadY    = -0.10 * pose + 0.03 * seat;
                    reloadRotX =  0.48 * pose - 0.10 * seat;
                    reloadRotZ =  0.55 * pose;
                }
            }

            // 6c. Look sway + vertical inertia: the weapon trails the camera a
            // little when turning, jumping or landing. Derived from the camera
            // itself so the game loop does not have to feed mouse deltas.
            if (cameraRef && delta > 0.0) {
                var yaw = cameraRef.rotation.y, pitch = cameraRef.rotation.x, camY = cameraRef.position.y;
                if (lastYaw === null) { lastYaw = yaw; lastPitch = pitch; lastCamY = camY; }
                var yawRate   = Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)) / delta;
                var pitchRate = (pitch - lastPitch) / delta;
                var fallRate  = (camY - lastCamY) / delta;
                lastYaw = yaw; lastPitch = pitch; lastCamY = camY;

                var follow = 1.0 - Math.exp(-10.0 * delta);
                lookSwayX += (Math.max(-1.0, Math.min(1.0, yawRate   * 0.12)) - lookSwayX) * follow;
                lookSwayY += (Math.max(-1.0, Math.min(1.0, pitchRate * 0.12)) - lookSwayY) * follow;
                inertiaY  += (Math.max(-1.0, Math.min(1.0, fallRate  * 0.07)) - inertiaY)  * follow;
            }

            // Apply composed offsets to animGroup (ZERO allocation)
            animGroup.position.set(
                sprintX + bobPosX + swayX + lookSwayX * 0.028,
                equipY + sprintY + bobPosY + swayY + reloadY - lookSwayY * 0.022 - inertiaY * 0.045,
                recoilPos.z
            );

            animGroup.rotation.set(
                equipRotX + sprintRotX + swayRotX + recoilRot.x + reloadRotX - lookSwayY * 0.05
                    + (isSwinging ? swingPitch : 0.0),
                sprintRotY + swayRotY - lookSwayX * 0.09 + (isSwinging ? -swingYaw : 0.0),
                bobRotZ + sprintRotZ + reloadRotZ + lookSwayX * 0.05 + (isSwinging ? swingRoll : 0.0)
            );

            // 7. Minigun Barrel Rotation Spin & Damping
            if (barrelsGroup) {
                if (barrelSpinSpeed > 0.001) {
                    barrelsGroup.rotation.z += barrelSpinSpeed * delta;
                    barrelSpinSpeed = Math.max(0.0, barrelSpinSpeed - delta * 12.0);
                }
            }

            // 8. Muzzle Flash Timer
            if (flashTimer > 0) {
                flashTimer -= delta;
                if (flashTimer <= 0) {
                    if (flashSprite) flashSprite.visible = false;
                    if (flashLight)  flashLight.intensity = 0;
                }
            }

            // 9. Update Tracers (fade over life)
            for (var tIdx = 0; tIdx < tracerPool.length; tIdx++) {
                var tr = tracerPool[tIdx];
                if (!tr.active) continue;

                tr.life -= delta;
                if (tr.life <= 0) {
                    tr.active = false;
                    tr.mesh.visible = false;
                } else {
                    tr.material.opacity = tr.life / tr.maxLife;
                }
            }

            // 10. Update Impact Decals (fade after 5s until 6s)
            for (var dIdx = 0; dIdx < decalPool.length; dIdx++) {
                var dec = decalPool[dIdx];
                if (!dec.active) continue;

                dec.life -= delta;
                if (dec.life <= 0) {
                    dec.active = false;
                    dec.mesh.visible = false;
                } else if (dec.life < 1.0) {
                    dec.material.opacity = (dec.life / 1.0) * 0.85;
                }
            }

            // 11. Update Impact Particles (Sparks & Blood with gravity)
            for (var pIdx = 0; pIdx < particlePool.length; pIdx++) {
                var pt = particlePool[pIdx];
                if (!pt.active) continue;

                pt.life -= delta;
                if (pt.life <= 0) {
                    pt.active = false;
                    pt.mesh.visible = false;
                } else {
                    pt.vel.y -= pt.gravity * delta;
                    pt.pos.addScaledVector(pt.vel, delta);
                    pt.mesh.position.copy(pt.pos);
                    pt.material.opacity = pt.life / pt.maxLife;
                }
            }

            // 12. Update Rockets & Rocket Trails
            for (var rIdx = activeRockets.length - 1; rIdx >= 0; rIdx--) {
                var rk = activeRockets[rIdx];
                if (!rk.alive) {
                    activeRockets.splice(rIdx, 1);
                    continue;
                }

                // Sync mesh position & orientation
                rk.mesh.position.copy(rk.pos);
                _q1.setFromUnitVectors(_unitY, rk.dir);
                rk.mesh.quaternion.copy(_q1);

                // Emit trail particle periodically
                rk.trailAccum += delta;
                if (rk.trailAccum >= 0.025) {
                    rk.trailAccum = 0.0;

                    // Find inactive trail particle
                    for (var tpIdx = 0; tpIdx < rocketTrailPool.length; tpIdx++) {
                        var tp = rocketTrailPool[tpIdx];
                        if (tp.active) continue;

                        // Position at back of rocket
                        tp.pos.copy(rk.pos).addScaledVector(rk.dir, -0.22);
                        tp.mesh.position.copy(tp.pos);
                        tp.mesh.scale.set(1.0, 1.0, 1.0);
                        tp.material.opacity = 0.85;
                        tp.mesh.visible = true;

                        tp.active = true;
                        tp.life = 0.20;
                        tp.maxLife = 0.20;
                        break;
                    }
                }
            }

            // Update active rocket trail particles
            for (var rtIdx = 0; rtIdx < rocketTrailPool.length; rtIdx++) {
                var rtp = rocketTrailPool[rtIdx];
                if (!rtp.active) continue;

                rtp.life -= delta;
                if (rtp.life <= 0) {
                    rtp.active = false;
                    rtp.mesh.visible = false;
                } else {
                    var progress = 1.0 - (rtp.life / rtp.maxLife);
                    var scale = 1.0 + progress * 2.0; // expand smoke
                    rtp.mesh.scale.set(scale, scale, scale);
                    rtp.material.opacity = (rtp.life / rtp.maxLife) * 0.8;
                }
            }

            // 13. Weapon Skin Animation (pulse / rainbow / gold)
            updateSkinAnim(getTHREE(), delta);
        }
    };

    // Export to global window
    root.WeaponFX = WeaponFX;

})(typeof window !== 'undefined' ? window : this);
