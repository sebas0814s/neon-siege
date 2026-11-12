/**
 * ============================================================================
 * NEON SIEGE — PERSONAJES: MODELOS Y ANIMACIÓN
 * js/enemy-models.js
 *
 * Cada arquetipo es un androide articulado (cadera, torso, cabeza, hombros,
 * codos, rodillas) esculpido con primitivas. Todas las piezas de una misma
 * extremidad se funden en UNA geometría con color por vértice, así un enemigo
 * completo son 10 mallas y un único material.
 *
 * Contrato con game.js (igual que el muñeco anterior):
 *   · el grupo devuelto mira hacia +Z y tiene los pies en y = 0;
 *   · cada malla golpeable lleva userData.mult (cabeza 2.5, torso 1, resto 0.7);
 *   · game.js sigue siendo dueño de userData (vida, velocidad, walkPhase).
 *
 * Uso: EnemyModels.create(type, sombras) al aparecer, animate() cada frame por
 * enemigo vivo, hit()/attack() en los eventos, kill() al morir y update() una
 * vez por frame para los cuerpos que están cayendo.
 * ============================================================================
 */
(function (root) {
    'use strict';

    var T = root.THREE;
    if (!T) return;

    var HEAD_MULT = 2.5;
    var TORSO_MULT = 1.0;
    var LIMB_MULT = 0.7;

    var SPAWN_SECONDS = 0.55;
    var HIT_SECONDS = 0.2;
    var FALL_SECONDS = 0.42;
    var FADE_SECONDS = 0.6;
    var BOSS_FALL_SECONDS = 1.15;
    var BOSS_FADE_SECONDS = 1.0;
    var BLAST_SECONDS = 0.16;
    var HEAD_GRAVITY = 15;

    var SUIT = 0x1b1e2e;
    var METAL = 0x4c5370;
    var DARK_METAL = 0x262a3c;

    var sceneRef = null;
    var corpses = [];
    var materialPool = [];
    var blueprints = {};

    // ── Utilidades de color ──────────────────────────────────────────────────

    var _colorA = new T.Color();
    var _colorB = new T.Color();

    function shade(hex, factor) {
        return _colorA.setHex(hex).multiplyScalar(factor).getHex();
    }

    function tint(hex, towardHex, amount) {
        return _colorA.setHex(hex).lerp(_colorB.setHex(towardHex), amount).getHex();
    }

    // ── Escultor: funde primitivas en una sola geometría ─────────────────────

    var _matrix = new T.Matrix4();
    var _position = new T.Vector3();
    var _quaternion = new T.Quaternion();
    var _scale = new T.Vector3();
    var _euler = new T.Euler();
    var _vertexColor = new T.Color();

    // selfLit: { colorHex: brillo } para las piezas que no declaran 'glow'.
    // La armadura se autoilumina un poco: la arena es oscura y el color del
    // arquetipo tiene que leerse sin depender de que le dé una luz.
    function Sculpt(selfLit) {
        this.selfLit = selfLit || {};
        this.position = [];
        this.normal = [];
        this.color = [];
        this.glow = [];
    }

    // opts: { rx, ry, rz, sx, sy, sz, glow }. 'glow' hace que la pieza emita
    // su propio color (visores, núcleos, filos) sin necesitar otro material.
    Sculpt.prototype.add = function (geometry, at, color, opts) {
        opts = opts || {};
        var flat = geometry.index ? geometry.toNonIndexed() : geometry;
        _euler.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
        _quaternion.setFromEuler(_euler);
        _position.set(at[0], at[1], at[2]);
        _scale.set(opts.sx || 1, opts.sy || 1, opts.sz || 1);
        flat.applyMatrix4(_matrix.compose(_position, _quaternion, _scale));

        var positions = flat.attributes.position.array;
        var normals = flat.attributes.normal.array;
        var glow = opts.glow !== undefined ? opts.glow : (this.selfLit[color] || 0);
        _vertexColor.setHex(color);
        for (var i = 0; i < positions.length; i += 3) {
            this.position.push(positions[i], positions[i + 1], positions[i + 2]);
            this.normal.push(normals[i], normals[i + 1], normals[i + 2]);
            this.color.push(_vertexColor.r, _vertexColor.g, _vertexColor.b);
            this.glow.push(glow);
        }
        geometry.dispose();
        if (flat !== geometry) flat.dispose();
        return this;
    };

    Sculpt.prototype.box = function (w, h, d, at, color, opts) {
        return this.add(new T.BoxGeometry(w, h, d), at, color, opts);
    };

    Sculpt.prototype.ball = function (radius, at, color, opts) {
        return this.add(new T.SphereGeometry(radius, 10, 8), at, color, opts);
    };

    Sculpt.prototype.tube = function (radiusTop, radiusBottom, height, at, color, opts) {
        return this.add(new T.CylinderGeometry(radiusTop, radiusBottom, height, 10), at, color, opts);
    };

    Sculpt.prototype.cone = function (radius, height, at, color, opts) {
        return this.add(new T.ConeGeometry(radius, height, 8), at, color, opts);
    };

    Sculpt.prototype.build = function () {
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(this.position, 3));
        geometry.setAttribute('normal', new T.Float32BufferAttribute(this.normal, 3));
        geometry.setAttribute('color', new T.Float32BufferAttribute(this.color, 3));
        geometry.setAttribute('glow', new T.Float32BufferAttribute(this.glow, 1));
        geometry.computeBoundingSphere();
        return geometry;
    };

    // ── Material ─────────────────────────────────────────────────────────────

    // Lambert con dos añadidos: el atributo 'glow' suma el color del vértice a
    // la emisión, y 'glowBoost' lo hace latir. El texto del shader es idéntico
    // para todos, así que comparten programa aunque cada enemigo tenga su
    // material (necesario para el destello de impacto y el desvanecido).
    function patchGlowShader(shader) {
        shader.uniforms.glowBoost = this.userData.glowBoost;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', 'attribute float glow;\nvarying float vGlow;\n#include <common>')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', 'uniform float glowBoost;\nvarying float vGlow;\n#include <common>')
            .replace('#include <emissivemap_fragment>',
                '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * glowBoost;');
    }

    // Los materiales se reciclan en vez de liberarse: si el último enemigo
    // soltara el programa, la siguiente oleada pagaría recompilar el shader.
    function acquireMaterial() {
        var material = materialPool.pop();
        if (!material) {
            material = new T.MeshLambertMaterial({ vertexColors: true });
            material.userData.glowBoost = { value: 1 };
            material.onBeforeCompile = patchGlowShader;
        }
        material.emissive.setRGB(0, 0, 0);
        material.opacity = 1;
        material.transparent = false;
        material.userData.glowBoost.value = 1;
        return material;
    }

    function releaseMaterial(material) {
        materialPool.push(material);
    }

    // ── Piezas comunes ───────────────────────────────────────────────────────

    function sculptLimbs(palette, size) {
        var upperArm = new Sculpt(palette.selfLit)
            .box(size.arm * 1.5, size.arm * 1.2, size.arm * 1.7, [0, 0.02, 0], palette.armor)
            .box(size.arm, 0.5, size.arm * 1.1, [0, -0.27, 0], SUIT);
        var thigh = new Sculpt(palette.selfLit)
            .box(size.leg, 0.6, size.leg * 1.08, [0, -0.3, 0], SUIT)
            .box(size.leg * 0.8, 0.3, 0.06, [0, -0.26, size.leg * 0.56], palette.armorDark);
        var shin = new Sculpt(palette.selfLit)
            .box(size.leg * 0.86, 0.5, size.leg * 0.92, [0, -0.27, 0], palette.armorDark)
            .box(size.leg * 0.8, 0.15, 0.1, [0, -0.02, size.leg * 0.5], palette.armor)
            .box(size.leg * 1.02, 0.14, size.leg * 1.65, [0, -0.53, size.leg * 0.3], DARK_METAL);
        return { upperArm: upperArm, thigh: thigh, shin: shin };
    }

    function sculptForearm(palette, size) {
        return new Sculpt(palette.selfLit)
            .box(size.arm * 0.92, 0.42, size.arm, [0, -0.22, 0], palette.armorDark)
            .box(size.arm * 1.05, 0.18, size.arm * 1.1, [0, -0.52, 0], METAL);
    }

    var ARMOR_SELF_LIT = 0.32;
    var ARMOR_DARK_SELF_LIT = 0.2;

    function paletteFor(type) {
        var palette = {
            armor: type.color,
            armorDark: shade(type.color, 0.5),
            glow: tint(type.color, 0xffffff, 0.18),
            selfLit: {}
        };
        palette.selfLit[palette.armor] = ARMOR_SELF_LIT;
        palette.selfLit[palette.armorDark] = ARMOR_DARK_SELF_LIT;
        return palette;
    }

    // ── Arquetipos ───────────────────────────────────────────────────────────
    // Medidas en unidades locales: pies 0 · rodilla 0.6 · cadera 1.2 ·
    // cuello 2.4 · coronilla 3.0. El grupo entero se escala luego con type.w/h.

    function buildRecluta(type) {
        var p = paletteFor(type);
        var size = { arm: 0.2, leg: 0.26 };
        var limbs = sculptLimbs(p, size);

        var torso = new Sculpt(p.selfLit)
            .box(0.62, 0.28, 0.36, [0, 0.1, 0], SUIT)
            .box(0.68, 0.08, 0.42, [0, 0.25, 0], METAL)
            .box(0.56, 0.34, 0.32, [0, 0.45, 0], p.armorDark)
            .box(0.84, 0.52, 0.44, [0, 0.86, 0], p.armor)
            .box(0.5, 0.3, 0.06, [0, 0.9, 0.24], p.armorDark)
            .box(0.16, 0.08, 0.03, [0, 0.92, 0.28], p.glow, { glow: 1.1 })
            .box(0.4, 0.12, 0.34, [0, 1.16, 0], METAL)
            .box(0.5, 0.5, 0.18, [0, 0.82, -0.3], METAL)
            .box(0.08, 0.3, 0.03, [-0.14, 0.82, -0.4], p.glow, { glow: 0.9 })
            .box(0.08, 0.3, 0.03, [0.14, 0.82, -0.4], p.glow, { glow: 0.9 });

        var head = new Sculpt(p.selfLit)
            .ball(0.3, [0, 0.3, 0], p.armor)
            .box(0.46, 0.1, 0.24, [0, 0.33, 0.19], p.glow, { glow: 1.2 })
            .box(0.3, 0.14, 0.26, [0, 0.12, 0.1], METAL)
            .box(0.03, 0.3, 0.03, [0.27, 0.5, -0.05], METAL);

        // La porra aturdidora justifica que ataque cuerpo a cuerpo: apunta
        // hacia delante con el brazo caído y hacia arriba al levantarlo.
        var weaponArm = sculptForearm(p, size)
            .tube(0.035, 0.035, 0.3, [0, -0.52, 0.2], DARK_METAL, { rx: Math.PI / 2 })
            .tube(0.045, 0.045, 0.7, [0, -0.52, 0.7], p.glow, { rx: Math.PI / 2, glow: 1.1 });

        return {
            shoulderX: 0.53, shoulderY: 1.05, hipX: 0.2, neckY: 1.2,
            torso: torso.build(), head: head.build(),
            upperArm: limbs.upperArm.build(),
            forearmLeft: sculptForearm(p, size).build(), forearmRight: weaponArm.build(),
            thigh: limbs.thigh.build(), shin: limbs.shin.build(),
            style: { stride: 0.55, knee: 0.9, armSwing: 0.5, armBase: 0, elbow: 0.35, spread: 0.1,
                     lean: 0.1, bob: 0.07, twist: 0.1, waddle: 0, attack: 'strike', attackSeconds: 0.42 }
        };
    }

    function buildChacal(type) {
        var p = paletteFor(type);
        var size = { arm: 0.13, leg: 0.18 };
        var limbs = sculptLimbs(p, size);

        var torso = new Sculpt(p.selfLit)
            .box(0.4, 0.24, 0.3, [0, 0.1, 0], SUIT)
            .box(0.34, 0.42, 0.26, [0, 0.42, 0], SUIT)
            .box(0.6, 0.42, 0.36, [0, 0.86, 0.02], p.armor)
            .box(0.3, 0.2, 0.05, [0, 0.9, 0.21], p.armorDark)
            .box(0.26, 0.1, 0.28, [0, 1.13, 0], METAL)
            .cone(0.07, 0.3, [0, 1.0, -0.26], p.glow, { rx: -0.9, glow: 1.0 })
            .cone(0.07, 0.3, [0, 0.72, -0.24], p.glow, { rx: -0.9, glow: 1.0 })
            .cone(0.06, 0.24, [0, 0.46, -0.2], p.glow, { rx: -0.9, glow: 1.0 });

        // Hocico y orejas: la silueta de chacal se reconoce antes que el color.
        var head = new Sculpt(p.selfLit)
            .ball(0.25, [0, 0.28, 0], p.armor)
            .box(0.2, 0.16, 0.36, [0, 0.2, 0.26], p.armorDark)
            .box(0.16, 0.05, 0.3, [0, 0.11, 0.24], METAL)
            .cone(0.075, 0.36, [-0.15, 0.6, -0.05], p.armor, { rz: 0.22 })
            .cone(0.075, 0.36, [0.15, 0.6, -0.05], p.armor, { rz: -0.22 })
            .box(0.1, 0.045, 0.06, [-0.11, 0.34, 0.2], p.glow, { glow: 1.35, rz: -0.35 })
            .box(0.1, 0.045, 0.06, [0.11, 0.34, 0.2], p.glow, { glow: 1.35, rz: 0.35 });

        var bladeArm = sculptForearm(p, size)
            .box(0.03, 0.85, 0.13, [0, -0.72, 0.07], p.glow, { glow: 1.15 });
        var bladeGeometry = bladeArm.build();

        return {
            shoulderX: 0.38, shoulderY: 1.02, hipX: 0.15, neckY: 1.18,
            torso: torso.build(), head: head.build(),
            upperArm: limbs.upperArm.build(),
            forearmLeft: bladeGeometry, forearmRight: bladeGeometry,
            thigh: limbs.thigh.build(), shin: limbs.shin.build(),
            // Corre inclinado con los brazos hacia atrás: se le nota la prisa.
            style: { stride: 0.95, knee: 1.3, armSwing: 0.18, armBase: 0.95, elbow: 0.15, spread: 0.3,
                     lean: 0.5, bob: 0.1, twist: 0.16, waddle: 0, attack: 'slash', attackSeconds: 0.3 }
        };
    }

    function buildMastodonte(type) {
        var p = paletteFor(type);
        var size = { arm: 0.32, leg: 0.36 };
        var limbs = sculptLimbs(p, size);

        var torso = new Sculpt(p.selfLit)
            .box(0.72, 0.28, 0.48, [0, 0.1, 0], SUIT)
            .box(0.84, 0.4, 0.58, [0, 0.4, 0], p.armorDark)
            .box(1.12, 0.7, 0.72, [0, 0.9, 0], p.armor)
            .ball(0.44, [0, 1.08, -0.2], p.armorDark)
            .tube(0.17, 0.17, 0.08, [0, 0.88, 0.37], p.glow, { rx: Math.PI / 2, glow: 1.3 })
            .tube(0.22, 0.22, 0.05, [0, 0.88, 0.35], DARK_METAL, { rx: Math.PI / 2 })
            .box(0.9, 0.06, 0.04, [0, 0.6, 0.37], DARK_METAL)
            .tube(0.07, 0.07, 0.5, [-0.3, 1.4, -0.34], METAL)
            .tube(0.07, 0.07, 0.5, [0.3, 1.4, -0.34], METAL)
            .tube(0.05, 0.05, 0.04, [-0.3, 1.66, -0.34], p.glow, { glow: 1.3 })
            .tube(0.05, 0.05, 0.04, [0.3, 1.66, -0.34], p.glow, { glow: 1.3 });

        var head = new Sculpt(p.selfLit)
            .box(0.5, 0.42, 0.5, [0, 0.22, 0.06], p.armorDark)
            .box(0.56, 0.12, 0.54, [0, 0.42, 0.04], p.armor)
            .box(0.36, 0.06, 0.04, [0, 0.24, 0.32], p.glow, { glow: 1.35 });

        var fistArm = new Sculpt(p.selfLit)
            .box(0.36, 0.5, 0.4, [0, -0.24, 0], p.armorDark)
            .box(0.46, 0.38, 0.46, [0, -0.62, 0], METAL)
            .box(0.48, 0.07, 0.06, [0, -0.72, 0.22], p.glow, { glow: 1.1 });
        var fistGeometry = fistArm.build();

        var upperArm = new Sculpt(p.selfLit)
            .ball(0.36, [0, 0.04, 0], p.armor)
            .box(size.arm, 0.5, size.arm * 1.05, [0, -0.27, 0], SUIT);

        return {
            shoulderX: 0.78, shoulderY: 1.02, hipX: 0.26, neckY: 1.2,
            torso: torso.build(), head: head.build(),
            upperArm: upperArm.build(),
            forearmLeft: fistGeometry, forearmRight: fistGeometry,
            thigh: limbs.thigh.build(), shin: limbs.shin.build(),
            style: { stride: 0.42, knee: 0.6, armSwing: 0.3, armBase: 0.05, elbow: 0.3, spread: 0.24,
                     lean: 0.2, bob: 0.13, twist: 0.2, waddle: 0.07, attack: 'smash', attackSeconds: 0.55 }
        };
    }

    function buildZumbador(type) {
        var p = paletteFor(type);
        var size = { arm: 0.12, leg: 0.17 };
        var limbs = sculptLimbs(p, size);

        // Una bomba con patas: el núcleo late más rápido cuanto más cerca está.
        var torso = new Sculpt(p.selfLit)
            .box(0.4, 0.2, 0.3, [0, 0.08, 0], SUIT)
            .ball(0.58, [0, 0.7, 0], p.armorDark)
            .tube(0.6, 0.6, 0.09, [0, 0.7, 0], p.glow, { glow: 1.0 })
            .ball(0.22, [0, 0.7, 0.44], p.glow, { glow: 1.4 })
            .tube(0.28, 0.28, 0.04, [0, 0.7, 0.5], DARK_METAL, { rx: Math.PI / 2 })
            .tube(0.3, 0.36, 0.14, [0, 1.2, 0], METAL)
            .tube(0.025, 0.025, 0.42, [0.2, 1.42, -0.2], METAL)
            .ball(0.07, [0.2, 1.66, -0.2], p.glow, { glow: 1.5 });

        var head = new Sculpt(p.selfLit)
            .ball(0.27, [0, 0.27, 0], METAL)
            .ball(0.11, [0, 0.29, 0.2], p.glow, { glow: 1.5 })
            .tube(0.15, 0.15, 0.05, [0, 0.29, 0.2], DARK_METAL, { rx: Math.PI / 2 });

        var hand = sculptForearm(p, size)
            .ball(0.09, [0, -0.6, 0], p.glow, { glow: 1.1 });
        var handGeometry = hand.build();

        return {
            shoulderX: 0.62, shoulderY: 0.86, hipX: 0.16, neckY: 1.24,
            torso: torso.build(), head: head.build(),
            upperArm: limbs.upperArm.build(),
            forearmLeft: handGeometry, forearmRight: handGeometry,
            thigh: limbs.thigh.build(), shin: limbs.shin.build(),
            style: { stride: 0.7, knee: 1.0, armSwing: 0.2, armBase: -0.5, elbow: 1.1, spread: 0.12,
                     lean: 0.12, bob: 0.06, twist: 0.05, waddle: 0.16, attack: 'slam', attackSeconds: 0.4,
                     pulse: true }
        };
    }

    function buildColoso(type) {
        var p = paletteFor(type);
        var size = { arm: 0.24, leg: 0.3 };
        var limbs = sculptLimbs(p, size);

        var torso = new Sculpt(p.selfLit)
            .box(0.66, 0.28, 0.4, [0, 0.1, 0], SUIT)
            .box(0.74, 0.1, 0.46, [0, 0.26, 0], p.armorDark)
            .box(0.6, 0.36, 0.36, [0, 0.46, 0], DARK_METAL)
            .box(1.0, 0.6, 0.56, [0, 0.9, 0], p.armor)
            .box(0.26, 0.26, 0.05, [0, 0.92, 0.3], p.glow, { rz: Math.PI / 4, glow: 1.35 })
            .box(0.4, 0.4, 0.04, [0, 0.92, 0.28], DARK_METAL, { rz: Math.PI / 4 })
            .box(0.5, 0.14, 0.4, [0, 1.2, 0], p.armorDark)
            .cone(0.09, 0.4, [0, 1.22, -0.3], p.glow, { rx: -0.6, glow: 1.1 })
            .cone(0.09, 0.4, [0, 0.9, -0.34], p.glow, { rx: -0.6, glow: 1.1 })
            .cone(0.08, 0.34, [0, 0.6, -0.26], p.glow, { rx: -0.6, glow: 1.1 });

        // Corona de puntas: el jefe se identifica aunque solo asome la cabeza.
        var head = new Sculpt(p.selfLit)
            .ball(0.3, [0, 0.3, 0], p.armorDark)
            .box(0.44, 0.07, 0.22, [0, 0.36, 0.2], p.glow, { glow: 1.4 })
            .box(0.08, 0.26, 0.2, [0, 0.24, 0.21], p.glow, { glow: 1.4 })
            .tube(0.31, 0.31, 0.08, [0, 0.5, 0], p.armor);
        for (var i = 0; i < 5; i++) {
            var angle = (i - 2) * 0.62;
            head.cone(0.06, 0.3, [Math.sin(angle) * 0.27, 0.68, Math.cos(angle) * 0.27], p.armor,
                { rx: Math.cos(angle) * 0.25, rz: -Math.sin(angle) * 0.25 });
        }

        var upperArm = new Sculpt(p.selfLit)
            .ball(0.34, [0, 0.06, 0], p.armor)
            .cone(0.1, 0.4, [0, 0.42, 0], p.armorDark)
            .box(size.arm, 0.5, size.arm * 1.1, [0, -0.27, 0], SUIT);

        // Mazo de guerra: el mango sale hacia delante desde el puño.
        var hammerArm = sculptForearm(p, size)
            .tube(0.05, 0.05, 1.5, [0, -0.52, 0.6], DARK_METAL, { rx: Math.PI / 2 })
            .box(0.5, 0.42, 0.36, [0, -0.52, 1.38], p.armor)
            .box(0.52, 0.2, 0.38, [0, -0.52, 1.38], p.glow, { glow: 1.2 });

        return {
            shoulderX: 0.66, shoulderY: 1.04, hipX: 0.22, neckY: 1.26,
            torso: torso.build(), head: head.build(),
            upperArm: upperArm.build(),
            forearmLeft: sculptForearm(p, size).build(), forearmRight: hammerArm.build(),
            thigh: limbs.thigh.build(), shin: limbs.shin.build(),
            style: { stride: 0.5, knee: 0.8, armSwing: 0.28, armBase: -0.1, elbow: 0.4, spread: 0.2,
                     lean: 0.12, bob: 0.1, twist: 0.14, waddle: 0.04, attack: 'smash', attackSeconds: 0.7,
                     aura: 0.22 }
        };
    }

    var BUILDERS = {
        recluta: buildRecluta,
        chacal: buildChacal,
        mastodonte: buildMastodonte,
        zumbador: buildZumbador,
        coloso: buildColoso
    };

    function blueprintFor(type) {
        var blueprint = blueprints[type.key];
        if (!blueprint) {
            blueprint = blueprints[type.key] = (BUILDERS[type.key] || buildRecluta)(type);
            blueprint.color = new T.Color(type.color);
        }
        return blueprint;
    }

    // ── Construcción del esqueleto ───────────────────────────────────────────

    var HIP_HEIGHT = 1.2;
    var ELBOW_DROP = 0.52;
    var KNEE_DROP = 0.6;

    function addPart(parent, geometry, material, mult, castShadow) {
        var mesh = new T.Mesh(geometry, material);
        mesh.userData = { mult: mult };
        mesh.castShadow = !!castShadow;
        parent.add(mesh);
        return mesh;
    }

    function addJoint(parent, x, y, z) {
        var joint = new T.Group();
        joint.position.set(x, y, z);
        parent.add(joint);
        return joint;
    }

    function create(type, castShadows) {
        var blueprint = blueprintFor(type);
        var material = acquireMaterial();
        var group = new T.Group();

        var hips = addJoint(group, 0, HIP_HEIGHT, 0);
        addPart(hips, blueprint.torso, material, TORSO_MULT, castShadows);
        var head = addJoint(hips, 0, blueprint.neckY, 0);
        addPart(head, blueprint.head, material, HEAD_MULT, castShadows);

        // El lado -X es la mano derecha de un modelo que mira hacia +Z.
        var shoulderRight = addJoint(hips, -blueprint.shoulderX, blueprint.shoulderY, 0);
        var shoulderLeft = addJoint(hips, blueprint.shoulderX, blueprint.shoulderY, 0);
        addPart(shoulderRight, blueprint.upperArm, material, LIMB_MULT);
        addPart(shoulderLeft, blueprint.upperArm, material, LIMB_MULT);
        var elbowRight = addJoint(shoulderRight, 0, -ELBOW_DROP, 0);
        var elbowLeft = addJoint(shoulderLeft, 0, -ELBOW_DROP, 0);
        addPart(elbowRight, blueprint.forearmRight, material, LIMB_MULT);
        addPart(elbowLeft, blueprint.forearmLeft, material, LIMB_MULT);

        // Las piernas cuelgan de la raíz y no de la cadera: así el balanceo
        // del torso no levanta los pies del suelo.
        var legRight = addJoint(group, -blueprint.hipX, HIP_HEIGHT, 0);
        var legLeft = addJoint(group, blueprint.hipX, HIP_HEIGHT, 0);
        addPart(legRight, blueprint.thigh, material, LIMB_MULT);
        addPart(legLeft, blueprint.thigh, material, LIMB_MULT);
        var kneeRight = addJoint(legRight, 0, -KNEE_DROP, 0);
        var kneeLeft = addJoint(legLeft, 0, -KNEE_DROP, 0);
        addPart(kneeRight, blueprint.shin, material, LIMB_MULT);
        addPart(kneeLeft, blueprint.shin, material, LIMB_MULT);

        group.rig = {
            type: type, blueprint: blueprint, style: blueprint.style, material: material,
            hips: hips, head: head,
            armRight: shoulderRight, armLeft: shoulderLeft, elbowRight: elbowRight, elbowLeft: elbowLeft,
            legRight: legRight, legLeft: legLeft, kneeRight: kneeRight, kneeLeft: kneeLeft,
            clock: Math.random() * 10, walkWeight: 0,
            spawnProgress: 0, attackProgress: -1, hitTimer: 0, hitWasHead: false
        };
        // Arranca invisible de puro fino: la primera llamada a animate() lo
        // hace crecer, y así nunca se ve un frame con el modelo ya completo.
        group.scale.set(type.w * 0.05, 0.001, type.w * 0.05);
        return group;
    }

    // ── Animación de enemigos vivos ──────────────────────────────────────────

    function easeOutBack(k) {
        var c = 1.70158;
        var m = k - 1;
        return 1 + (c + 1) * m * m * m + c * m * m;
    }

    function approach(current, target, rate) {
        return current + (target - current) * Math.min(1, rate);
    }

    // Curva de golpe: sube el brazo, descarga y recupera. Devuelve el giro en
    // X del hombro (negativo = hacia delante/arriba).
    function strikeAngle(progress) {
        if (progress < 0.28) return -2.7 * Math.sin(progress / 0.28 * Math.PI / 2);
        if (progress < 0.5) {
            var down = (progress - 0.28) / 0.22;
            return -2.7 + 2.0 * down * down;
        }
        return -0.7 * (1 - (progress - 0.5) / 0.5);
    }

    function applyAttackPose(rig, progress) {
        var style = rig.style;
        var lunge = Math.sin(progress * Math.PI);
        rig.hips.rotation.x += 0.3 * lunge;

        if (style.attack === 'smash') {
            var both = strikeAngle(progress);
            rig.armRight.rotation.x = both;
            rig.armLeft.rotation.x = both;
            rig.elbowRight.rotation.x = rig.elbowLeft.rotation.x = -0.25;
        } else if (style.attack === 'slash') {
            // Dos tajos encadenados, uno con cada cuchilla.
            rig.armRight.rotation.x = strikeAngle(Math.min(1, progress * 1.6));
            rig.armLeft.rotation.x = strikeAngle(Math.max(0, Math.min(1, progress * 1.6 - 0.45)));
            rig.armRight.rotation.z = -0.5 * lunge;
            rig.armLeft.rotation.z = 0.5 * lunge;
        } else if (style.attack === 'slam') {
            rig.hips.rotation.x += 0.35 * lunge;
            rig.hips.position.z = 0.35 * lunge;
        } else {
            rig.armRight.rotation.x = strikeAngle(progress);
            rig.elbowRight.rotation.x = -0.2;
        }
    }

    function animate(group, delta, isMoving, distanceToPlayer) {
        var rig = group.rig;
        if (!rig) return;
        var style = rig.style;
        var type = rig.type;
        rig.clock += delta;

        // Materialización: nace como una línea de luz y se ensancha.
        var spawnGlow = 0;
        if (rig.spawnProgress < 1) {
            rig.spawnProgress = Math.min(1, rig.spawnProgress + delta / SPAWN_SECONDS);
            var grown = easeOutBack(rig.spawnProgress);
            var width = 0.05 + 0.95 * rig.spawnProgress * rig.spawnProgress;
            group.scale.set(type.w * width, type.h * grown, type.w * width);
            spawnGlow = 1 - rig.spawnProgress;
        }

        rig.walkWeight = approach(rig.walkWeight, isMoving ? 1 : 0, delta * 8);
        var weight = rig.walkWeight;
        var phase = group.userData.walkPhase || 0;
        var swing = Math.sin(phase);
        var lift = Math.cos(phase);
        var breath = Math.sin(rig.clock * 2.2) * 0.012;

        rig.legLeft.rotation.x = -swing * style.stride * weight;
        rig.legRight.rotation.x = swing * style.stride * weight;
        // La rodilla se dobla mientras esa pierna viaja hacia delante.
        rig.kneeLeft.rotation.x = Math.max(0, lift) * style.knee * weight;
        rig.kneeRight.rotation.x = Math.max(0, -lift) * style.knee * weight;

        rig.armLeft.rotation.set(style.armBase + swing * style.armSwing * weight, 0, style.spread);
        rig.armRight.rotation.set(style.armBase - swing * style.armSwing * weight, 0, -style.spread);
        rig.elbowLeft.rotation.x = -(style.elbow + Math.max(0, -swing) * 0.3 * weight);
        rig.elbowRight.rotation.x = -(style.elbow + Math.max(0, swing) * 0.3 * weight);

        rig.hips.position.set(0, HIP_HEIGHT + (Math.abs(lift) - 0.5) * style.bob * weight + breath, 0);
        rig.hips.rotation.set(
            style.lean * (0.35 + 0.65 * weight),
            swing * style.twist * weight,
            swing * style.waddle * weight
        );

        if (rig.attackProgress >= 0) {
            rig.attackProgress += delta / style.attackSeconds;
            if (rig.attackProgress >= 1) rig.attackProgress = -1;
            else applyAttackPose(rig, rig.attackProgress);
        }

        var flash = 0;
        if (rig.hitTimer > 0) {
            rig.hitTimer = Math.max(0, rig.hitTimer - delta);
            flash = rig.hitTimer / HIT_SECONDS;
            rig.hips.rotation.x -= 0.24 * flash;
        }
        // La cabeza compensa la inclinación del torso para seguir mirándote.
        rig.head.rotation.x = -rig.hips.rotation.x * 0.7 - (rig.hitWasHead ? 0.45 * flash : 0);

        var pulse = 1 + 0.12 * Math.sin(rig.clock * 3);
        if (style.pulse) {
            var closeness = Math.max(0, Math.min(1, 1 - (distanceToPlayer || 99) / 26));
            pulse = 1 + (0.25 + 0.75 * closeness) * (0.5 + 0.5 * Math.sin(rig.clock * (4 + 14 * closeness)));
        }
        rig.material.userData.glowBoost.value = pulse;

        var aura = style.aura || 0;
        var tintColor = rig.blueprint.color;
        var whiten = flash * 0.75;
        rig.material.emissive.setRGB(
            tintColor.r * (aura + spawnGlow * 1.6) + whiten,
            tintColor.g * (aura + spawnGlow * 1.6) + whiten,
            tintColor.b * (aura + spawnGlow * 1.6) + whiten
        );
    }

    function hit(group, mult) {
        var rig = group.rig;
        if (!rig) return;
        rig.hitTimer = HIT_SECONDS;
        rig.hitWasHead = mult >= 2;
    }

    function attack(group) {
        if (group.rig) group.rig.attackProgress = 0;
    }

    // ── Muerte ───────────────────────────────────────────────────────────────

    var _fallAxis = new T.Vector3();
    var _fallTurn = new T.Quaternion();

    // game.js ya sacó al enemigo de su lista: desde aquí el cuerpo es solo
    // decorado, no bloquea balas ni cuenta para la oleada.
    function kill(group, dirX, dirZ) {
        var rig = group.rig;
        if (!rig || !sceneRef) {
            if (group.parent) group.parent.remove(group);
            return;
        }
        var length = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
        var type = rig.type;
        var headshot = (group.userData.lastMult || 1) >= 2;
        corpses.push({
            group: group, rig: rig, age: 0,
            dirX: dirX / length, dirZ: dirZ / length,
            baseTurn: group.quaternion.clone(),
            slide: type.boss ? 0.6 : 3.2,
            blast: !!type.explode,
            fallSeconds: type.boss ? BOSS_FALL_SECONDS : FALL_SECONDS,
            fadeSeconds: type.boss ? BOSS_FADE_SECONDS : FADE_SECONDS,
            headFlies: headshot && !type.boss && !type.explode,
            headVelocityY: 5.2, headVelocityZ: -1.6
        });
        // Un cuerpo que cae deja de proyectar sombra: evita que la sombra se
        // quede "de pie" mientras el modelo se desvanece.
        group.traverse(function (node) { node.castShadow = false; });

        var fx = root.WorldFX;
        if (fx && fx.burst) {
            var chest = 1.8 * type.h;
            fx.burst(group.position.x, chest, group.position.z, type.color,
                type.boss ? 60 : (type.explode ? 34 : 14), type.boss ? 9 : 6, dirX / length, dirZ / length);
            if (fx.ring) fx.ring(group.position.x, group.position.z, type.color, type.boss ? 9 : 2.6 * type.w);
        }
    }

    function removeCorpse(index) {
        var corpse = corpses[index];
        sceneRef.remove(corpse.group);
        releaseMaterial(corpse.rig.material);
        corpses.splice(index, 1);
    }

    function updateCorpse(corpse, delta) {
        var rig = corpse.rig;
        var group = corpse.group;
        var color = rig.blueprint.color;
        corpse.age += delta;

        if (corpse.blast) {
            // Los que explotan no caen: se hinchan en blanco y desaparecen.
            var swell = corpse.age / BLAST_SECONDS;
            group.scale.multiplyScalar(1 + delta * 5);
            rig.material.emissive.setRGB(swell * 2, swell * 2, swell * 2);
            return swell >= 1;
        }

        var fall = Math.min(1, corpse.age / corpse.fallSeconds);
        var angle = (Math.PI / 2 - 0.06) * fall * fall;
        if (fall >= 1) {
            var bounce = Math.min(1, (corpse.age - corpse.fallSeconds) / 0.2);
            angle -= 0.1 * Math.sin(bounce * Math.PI);
        }
        // Cae de espaldas en la dirección del disparo que lo mató.
        _fallAxis.set(corpse.dirZ, 0, -corpse.dirX);
        _fallTurn.setFromAxisAngle(_fallAxis, angle);
        group.quaternion.copy(_fallTurn).multiply(corpse.baseTurn);

        group.position.x += corpse.dirX * corpse.slide * delta;
        group.position.z += corpse.dirZ * corpse.slide * delta;
        corpse.slide *= Math.max(0, 1 - delta * 5);

        var limp = delta * 9;
        rig.armLeft.rotation.x = approach(rig.armLeft.rotation.x, -2.3, limp);
        rig.armRight.rotation.x = approach(rig.armRight.rotation.x, -2.6, limp);
        rig.armLeft.rotation.z = approach(rig.armLeft.rotation.z, 0.7, limp);
        rig.armRight.rotation.z = approach(rig.armRight.rotation.z, -0.6, limp);
        rig.legLeft.rotation.x = approach(rig.legLeft.rotation.x, -0.35, limp);
        rig.legRight.rotation.x = approach(rig.legRight.rotation.x, 0.15, limp);
        rig.kneeLeft.rotation.x = approach(rig.kneeLeft.rotation.x, 0.7, limp);
        rig.kneeRight.rotation.x = approach(rig.kneeRight.rotation.x, 0.25, limp);
        rig.hips.rotation.x = approach(rig.hips.rotation.x, -0.15, limp);

        if (corpse.headFlies) {
            corpse.headVelocityY -= HEAD_GRAVITY * delta;
            rig.head.position.y += corpse.headVelocityY * delta;
            rig.head.position.z += corpse.headVelocityZ * delta;
            rig.head.rotation.x -= 13 * delta;
        }

        var fade = (corpse.age - corpse.fallSeconds) / corpse.fadeSeconds;
        if (fade <= 0) {
            var cooling = Math.max(0, 1 - corpse.age * 6);
            rig.material.emissive.setRGB(cooling, cooling, cooling);
            return false;
        }
        // Se consume en su propio color mientras se hunde en el suelo.
        rig.material.transparent = true;
        rig.material.opacity = Math.max(0, 1 - fade);
        var ember = 0.9 * Math.sin(Math.min(1, fade) * Math.PI);
        rig.material.emissive.setRGB(color.r * ember, color.g * ember, color.b * ember);
        group.position.y -= delta * 0.5;
        return fade >= 1;
    }

    function update(delta) {
        for (var i = corpses.length - 1; i >= 0; i--) {
            if (updateCorpse(corpses[i], delta)) removeCorpse(i);
        }
    }

    function clear() {
        for (var i = corpses.length - 1; i >= 0; i--) removeCorpse(i);
    }

    // Enemigos retirados sin animación (cambio de partida): solo hay que
    // devolver su material a la reserva.
    function discard(group) {
        if (group.rig) releaseMaterial(group.rig.material);
    }

    function init(scene) {
        sceneRef = scene;
    }

    root.EnemyModels = {
        init: init,
        create: create,
        animate: animate,
        hit: hit,
        attack: attack,
        kill: kill,
        discard: discard,
        update: update,
        clear: clear
    };

})(typeof window !== 'undefined' ? window : this);
