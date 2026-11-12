/**
 * ============================================================================
 * NEON SIEGE — ESCENARIO VIVO Y EFECTOS DE MUNDO
 * js/world-fx.js
 *
 * Viste la escena que monta game.js sin tocar su jugabilidad: cielo con
 * aurora, estrellas y luna, ventanas encendidas en el horizonte, paneles en
 * las coberturas, pulso de energía en el suelo, balizas en las torres, barrera
 * en el perímetro, tráfico aéreo, polvo en suspensión y las reservas de
 * chispas y ondas que usan muertes, explosiones y recogibles.
 *
 * Nada aquí añade luces reales (cambiarían el número de luces y obligarían a
 * recompilar todos los shaders): todo es emisivo o aditivo.
 *
 * Uso: WorldFX.init({...}) una vez con las piezas de la escena, update(delta)
 * cada frame y setQuality(nombre) al cambiar el preset gráfico.
 * ============================================================================
 */
(function (root) {
    'use strict';

    var T = root.THREE;
    if (!T) return;

    var CYAN = 0x00ffcc;
    var MAGENTA = 0xff2e88;
    var AMBER = 0xffb347;

    var SKY_RADIUS = 300;
    var STAR_COUNT = 650;
    var MOTE_COUNT = 150;
    var TRAFFIC_COUNT = 28;
    var SPARK_COUNT = 520;
    var RING_COUNT = 14;
    var GRID_TILE = 8;          // unidades de mundo por baldosa del suelo
    var PANEL_TILE = 4;         // unidades de mundo por repetición del panel
    var TOWER_MIN_HEIGHT = 10;  // a partir de aquí una cobertura es "torre"
    var FIELD_HEIGHT = 16;
    var SPARK_GRAVITY = 14;
    var RING_SECONDS = 0.5;

    var scene = null;
    var camera = null;
    var clock = 0;
    var skyDome = null;
    var skyFollowers = [];     // objetos que viajan con la cámara (cielo)
    var timeUniforms = [];     // uniforms 'time' que avanzan con el reloj
    var fogUniforms = [];      // materiales que copian la niebla de la escena
    var playerUniforms = [];   // uniforms con la posición del jugador
    var towerRings = [];
    var searchlights = [];
    var heavyExtras = [];      // lo que se apaga en el preset 'rendimiento'
    var beaconCache = {};

    // ── Texturas generadas ───────────────────────────────────────────────────

    function makeCanvas(size) {
        var canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        return canvas;
    }

    function tiledTexture(canvas) {
        var texture = new T.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        return texture;
    }

    function makeDotTexture() {
        var canvas = makeCanvas(64);
        var g = canvas.getContext('2d');
        var gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gradient;
        g.fillRect(0, 0, 64, 64);
        return new T.CanvasTexture(canvas);
    }

    function makeGroundTexture() {
        var size = 256;
        var canvas = makeCanvas(size);
        var g = canvas.getContext('2d');
        g.fillStyle = '#0e1022';
        g.fillRect(0, 0, size, size);
        // Losas interiores un punto más claras: rompen el plano uniforme.
        g.fillStyle = '#12152b';
        g.fillRect(10, 10, 112, 112);
        g.fillRect(134, 134, 112, 112);
        g.strokeStyle = 'rgba(0,255,204,0.07)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(128, 0); g.lineTo(128, size);
        g.moveTo(0, 128); g.lineTo(size, 128);
        g.stroke();
        // Marcas de esquina tipo pista de aterrizaje
        g.strokeStyle = 'rgba(255,46,136,0.2)';
        g.lineWidth = 3;
        [[18, 18, 1, 1], [238, 18, -1, 1], [18, 238, 1, -1], [238, 238, -1, -1]].forEach(function (c) {
            g.beginPath();
            g.moveTo(c[0] + 22 * c[2], c[1]); g.lineTo(c[0], c[1]); g.lineTo(c[0], c[1] + 22 * c[3]);
            g.stroke();
        });
        g.strokeStyle = 'rgba(0,255,204,0.2)';
        g.lineWidth = 4;
        g.strokeRect(2, 2, size - 4, size - 4);
        return tiledTexture(canvas);
    }

    function makePanelTextures() {
        var size = 256;
        var half = size / 2;
        var base = makeCanvas(size);
        var b = base.getContext('2d');
        b.fillStyle = '#5c6078';
        b.fillRect(0, 0, size, size);
        var tones = ['#e4e6f2', '#cfd2e2', '#d8dbea', '#c4c8da'];
        for (var i = 0; i < 4; i++) {
            var px = (i % 2) * half, py = Math.floor(i / 2) * half;
            b.fillStyle = tones[i];
            b.fillRect(px + 3, py + 3, half - 6, half - 6);
            b.strokeStyle = 'rgba(40,44,70,0.35)';
            b.lineWidth = 2;
            b.strokeRect(px + 14, py + 14, half - 28, half - 28);
            b.fillStyle = 'rgba(30,34,56,0.7)';
            [[10, 10], [half - 10, 10], [10, half - 10], [half - 10, half - 10]].forEach(function (bolt) {
                b.beginPath(); b.arc(px + bolt[0], py + bolt[1], 3, 0, Math.PI * 2); b.fill();
            });
        }
        // Rejilla de ventilación en un panel
        b.fillStyle = 'rgba(25,28,48,0.75)';
        for (var s = 0; s < 6; s++) b.fillRect(half + 30, 34 + s * 11, half - 60, 5);

        var glow = makeCanvas(size);
        var e = glow.getContext('2d');
        e.fillStyle = '#000';
        e.fillRect(0, 0, size, size);
        // Tira de luz discontinua a media altura de cada repetición
        e.fillStyle = 'rgb(0,150,125)';
        for (var d = 0; d < 4; d++) e.fillRect(d * 64 + 8, half + 12, 40, 4);
        e.fillStyle = 'rgb(200,35,105)';
        e.fillRect(24, 40, 10, 10);
        e.fillStyle = 'rgb(0,150,125)';
        e.fillRect(40, 40, 10, 10);
        return { base: tiledTexture(base), glow: tiledTexture(glow) };
    }

    function makeMoonTexture() {
        var size = 512;
        var canvas = makeCanvas(size);
        var g = canvas.getContext('2d');
        var halo = g.createRadialGradient(256, 256, 90, 256, 256, 256);
        halo.addColorStop(0, 'rgba(255,120,190,0.55)');
        halo.addColorStop(0.45, 'rgba(160,80,255,0.16)');
        halo.addColorStop(1, 'rgba(120,60,255,0)');
        g.fillStyle = halo;
        g.fillRect(0, 0, size, size);

        var disc = g.createLinearGradient(160, 150, 360, 370);
        disc.addColorStop(0, '#fff1f8');
        disc.addColorStop(0.55, '#ff9ccb');
        disc.addColorStop(1, '#8a4fd6');
        g.fillStyle = disc;
        g.beginPath(); g.arc(256, 256, 112, 0, Math.PI * 2); g.fill();

        // Franjas horizontales recortadas al disco: luna retro de neón
        g.save();
        g.beginPath(); g.arc(256, 256, 112, 0, Math.PI * 2); g.clip();
        g.globalCompositeOperation = 'destination-out';
        for (var i = 0; i < 6; i++) {
            var y = 286 + i * 15;
            g.fillRect(120, y, 272, 3 + i * 1.6);
        }
        g.restore();
        return new T.CanvasTexture(canvas);
    }

    // ── Cielo ────────────────────────────────────────────────────────────────

    function timeUniform() {
        var uniform = { value: 0 };
        timeUniforms.push(uniform);
        return uniform;
    }

    function dressSky(dome, colors) {
        skyDome = dome;
        dome.material.dispose();
        dome.material = new T.ShaderMaterial({
            side: T.BackSide, depthWrite: false, fog: false,
            uniforms: {
                top: { value: new T.Color(colors.zenith) },
                bottom: { value: new T.Color(colors.horizon) },
                glowA: { value: new T.Color(MAGENTA) },
                glowB: { value: new T.Color(CYAN) },
                time: timeUniform()
            },
            vertexShader: [
                'varying vec3 vDir;',
                'void main() {',
                '  vDir = normalize(position);',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform vec3 top; uniform vec3 bottom; uniform vec3 glowA; uniform vec3 glowB;',
                'uniform float time; varying vec3 vDir;',
                'void main() {',
                '  float h = vDir.y;',
                '  vec3 col = mix(bottom, top, clamp(h * 1.6 + 0.15, 0.0, 1.0));',
                // Resplandor de ciudad pegado al horizonte
                '  col += glowA * pow(1.0 - clamp(abs(h) * 3.4, 0.0, 1.0), 3.0) * 0.3;',
                // Aurora: una cinta que ondula con el azimut y cortinas que la recorren
                '  float az = atan(vDir.z, vDir.x);',
                '  float wave = sin(az * 3.0 + time * 0.05) * 0.06 + sin(az * 7.0 - time * 0.08) * 0.025;',
                '  float band = smoothstep(0.17, 0.0, abs(h - 0.36 - wave));',
                '  float curtain = 0.5 + 0.5 * sin(az * 24.0 + time * 0.3 + h * 10.0);',
                '  vec3 aurora = mix(glowA, glowB, 0.5 + 0.5 * sin(az * 2.0 + time * 0.03));',
                '  col += aurora * band * (0.2 + 0.3 * curtain) * 0.55;',
                '  gl_FragColor = vec4(col, 1.0);',
                '}'
            ].join('\n')
        });
        dome.scale.setScalar(SKY_RADIUS / 320 * 1.05);
        dome.renderOrder = -10;
        skyFollowers.push(dome);
    }

    function addStars() {
        var positions = [];
        var colors = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            var azimuth = Math.random() * Math.PI * 2;
            var height = 0.06 + Math.random() * 0.94;
            var flat = Math.sqrt(1 - height * height);
            positions.push(Math.cos(azimuth) * flat * SKY_RADIUS, height * SKY_RADIUS, Math.sin(azimuth) * flat * SKY_RADIUS);
            var brightness = 0.35 + Math.random() * 0.65;
            var warm = Math.random();
            colors.push(brightness, brightness * (0.82 + warm * 0.18), brightness * (1.0 - warm * 0.25));
        }
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        var stars = new T.Points(geometry, new T.PointsMaterial({
            size: 1.8, sizeAttenuation: false, vertexColors: true, fog: false,
            transparent: true, depthWrite: false
        }));
        stars.frustumCulled = false;
        stars.renderOrder = -9;
        scene.add(stars);
        skyFollowers.push(stars);
    }

    function addMoon() {
        var moon = new T.Sprite(new T.SpriteMaterial({
            map: makeMoonTexture(), fog: false, transparent: true, depthWrite: false
        }));
        moon.scale.set(120, 120, 1);
        moon.renderOrder = -8;
        // Se guarda el desplazamiento respecto a la cámara para seguirla.
        moon.userData.offset = new T.Vector3(-0.52, 0.36, -0.78).normalize().multiplyScalar(SKY_RADIUS * 0.96);
        scene.add(moon);
        skyFollowers.push(moon);
    }

    // ── Ciudad ───────────────────────────────────────────────────────────────

    function fogUniformSet() {
        var set = { fogColor: { value: new T.Color() }, fogNear: { value: 1 }, fogFar: { value: 100 } };
        fogUniforms.push(set);
        return set;
    }

    function dressSkyline(skyline) {
        var fog = fogUniformSet();
        var baseColor = skyline.material.color ? skyline.material.color.clone() : new T.Color(0x120d24);
        skyline.material.dispose();
        skyline.material = new T.ShaderMaterial({
            uniforms: {
                base: { value: baseColor },
                fogColor: fog.fogColor, fogNear: fog.fogNear, fogFar: fog.fogFar,
                time: timeUniform()
            },
            vertexShader: [
                'varying vec3 vLocal; varying vec3 vNormalL; varying vec3 vSize; varying vec2 vSeed; varying float vDepth;',
                'void main() {',
                '  vLocal = position; vNormalL = normal;',
                '  vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));',
                '  vSeed = instanceMatrix[3].xz;',
                '  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);',
                '  vDepth = -mv.z;',
                '  gl_Position = projectionMatrix * mv;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform vec3 base; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float time;',
                'varying vec3 vLocal; varying vec3 vNormalL; varying vec3 vSize; varying vec2 vSeed; varying float vDepth;',
                'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
                'void main() {',
                '  float lit = 0.0; vec3 lightColor = vec3(0.0);',
                '  if (abs(vNormalL.y) < 0.5) {',
                '    float u = abs(vNormalL.x) > 0.5 ? vLocal.z * vSize.z : vLocal.x * vSize.x;',
                '    float v = (vLocal.y + 0.5) * vSize.y;',
                '    vec2 grid = vec2(u / 2.6, v / 3.4);',
                '    vec2 cell = floor(grid); vec2 f = fract(grid);',
                '    float seed = hash(cell + floor(vSeed));',
                '    float on = step(0.7, seed);',
                // Una de cada diez ventanas se enciende y apaga despacio
                '    float blink = step(0.5, fract(seed * 7.0 + time * 0.04 * (0.5 + seed)));',
                '    on *= mix(1.0, blink, step(0.9, seed));',
                '    lit = on * step(0.18, f.x) * step(f.x, 0.82) * step(0.2, f.y) * step(f.y, 0.7);',
                '    float pick = hash(cell * 1.7 + floor(vSeed.yx));',
                '    lightColor = pick < 0.5 ? vec3(0.0, 0.85, 0.75) : (pick < 0.8 ? vec3(1.0, 0.25, 0.6) : vec3(1.0, 0.75, 0.3));',
                '  }',
                '  float fog = smoothstep(fogNear, fogFar, vDepth);',
                '  vec3 col = mix(base, fogColor, fog * 0.86);',
                // La luz atraviesa la bruma mejor que la fachada, pero con niebla
                // cerrada (fogFar corto) también desaparece.
                '  float reach = smoothstep(fogFar * 4.5, fogFar * 0.9, vDepth);',
                '  col += lightColor * lit * reach * 0.5;',
                '  gl_FragColor = vec4(col, 1.0);',
                '}'
            ].join('\n')
        });
    }

    function addTraffic() {
        var lanes = [];
        var tints = [];
        var speeds = [];
        for (var i = 0; i < TRAFFIC_COUNT; i++) {
            var clockwise = i % 2 === 0;
            lanes.push(104 + Math.random() * 24, 14 + Math.random() * 36, Math.random() * Math.PI * 2);
            speeds.push((0.05 + Math.random() * 0.07) * (clockwise ? 1 : -1));
            if (clockwise) tints.push(1.0, 0.92, 0.75); else tints.push(1.0, 0.2, 0.3);
        }
        var geometry = new T.BufferGeometry();
        // 'position' guarda (radio, altura, fase): la órbita se calcula en GPU.
        geometry.setAttribute('position', new T.Float32BufferAttribute(lanes, 3));
        geometry.setAttribute('tint', new T.Float32BufferAttribute(tints, 3));
        geometry.setAttribute('speed', new T.Float32BufferAttribute(speeds, 1));
        var traffic = new T.Points(geometry, new T.ShaderMaterial({
            transparent: true, depthWrite: false, blending: T.AdditiveBlending,
            uniforms: { time: timeUniform() },
            vertexShader: [
                'attribute vec3 tint; attribute float speed; uniform float time; varying vec3 vTint;',
                'void main() {',
                '  float angle = position.z + time * speed;',
                '  vec3 world = vec3(cos(angle) * position.x, position.y + sin(time * 0.3 + position.z) * 1.5, sin(angle) * position.x);',
                '  vTint = tint * (0.75 + 0.25 * sin(time * 6.0 + position.z * 9.0));',
                '  gl_PointSize = 3.0;',
                '  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: 'varying vec3 vTint; void main() { gl_FragColor = vec4(vTint, 1.0); }'
        }));
        traffic.frustumCulled = false;
        scene.add(traffic);
    }

    function addSearchlights() {
        var length = 150;
        var geometry = new T.ConeGeometry(11, length, 18, 1, true);
        geometry.rotateX(Math.PI);
        geometry.translate(0, length / 2, 0);
        // Degradado por vértice: brilla en el foco y se apaga hacia el cielo.
        var positions = geometry.attributes.position;
        var colors = [];
        for (var i = 0; i < positions.count; i++) {
            var k = 1 - positions.getY(i) / length;
            colors.push(0.16 * k, 0.2 * k, 0.3 * k);
        }
        geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        var material = new T.MeshBasicMaterial({
            vertexColors: true, blending: T.AdditiveBlending, transparent: true,
            depthWrite: false, side: T.DoubleSide, fog: false
        });
        [[-118, -96, 0.0], [124, 88, 2.1]].forEach(function (spot) {
            var beam = new T.Mesh(geometry, material);
            beam.position.set(spot[0], 16, spot[1]);
            beam.userData.phase = spot[2];
            beam.frustumCulled = false;
            scene.add(beam);
            searchlights.push(beam);
            heavyExtras.push(beam);
        });
    }

    // ── Arena ────────────────────────────────────────────────────────────────

    // Textura por posición de mundo (triplanar): todas las coberturas comparten
    // material y geometría escalada, así que con UV normales el panel se
    // estiraría distinto en cada bloque.
    function dressCover(material) {
        var textures = makePanelTextures();
        material.onBeforeCompile = function (shader) {
            shader.uniforms.panelMap = { value: textures.base };
            shader.uniforms.panelGlow = { value: textures.glow };
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', 'varying vec3 vPanelPos;\nvarying vec3 vPanelNormal;\n#include <common>')
                .replace('#include <begin_vertex>', [
                    '#include <begin_vertex>',
                    'vPanelPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
                    'vPanelNormal = normalize(mat3(modelMatrix) * normal);'
                ].join('\n'));
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', [
                    'uniform sampler2D panelMap; uniform sampler2D panelGlow;',
                    'varying vec3 vPanelPos; varying vec3 vPanelNormal;',
                    '#include <common>'
                ].join('\n'))
                .replace('#include <map_fragment>', [
                    'vec3 panelAxis = abs(vPanelNormal);',
                    'vec2 panelUv = panelAxis.y > 0.5 ? vPanelPos.xz : (panelAxis.x > 0.5 ? vPanelPos.zy : vPanelPos.xy);',
                    'panelUv /= ' + PANEL_TILE.toFixed(1) + ';',
                    'diffuseColor.rgb *= texture2D(panelMap, panelUv).rgb;'
                ].join('\n'))
                .replace('#include <emissivemap_fragment>', [
                    '#include <emissivemap_fragment>',
                    'totalEmissiveRadiance += texture2D(panelGlow, panelUv).rgb * (1.0 - panelAxis.y * 0.6);'
                ].join('\n'));
        };
        // El color base era muy oscuro para que se leyeran los paneles.
        material.color.setHex(0x4a5078);
        material.needsUpdate = true;
    }

    // Tapa de paneles sobre cada bloque: deja el neón de game.js como un
    // marco en el borde en vez de una losa entera de color plano. Todas las
    // tapas van en una sola geometría (una llamada de dibujo).
    var CAP_INSET = 0.22;
    var CAP_LIFT = 0.125;

    function addCoverCaps(coverLayout, material) {
        var positions = [];
        var normals = [];
        coverLayout.forEach(function (cover) {
            var cap = new T.BoxGeometry(cover[2] - CAP_INSET * 2, 0.04, cover[4] - CAP_INSET * 2).toNonIndexed();
            cap.translate(cover[0], cover[3] + CAP_LIFT, cover[1]);
            Array.prototype.push.apply(positions, cap.attributes.position.array);
            Array.prototype.push.apply(normals, cap.attributes.normal.array);
            cap.dispose();
        });
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
        var caps = new T.Mesh(geometry, material);
        caps.receiveShadow = true;
        scene.add(caps);
    }

    function dressGround(ground) {
        var repeat = ground.material.map ? ground.material.map.repeat.clone() : new T.Vector2(50, 50);
        var texture = makeGroundTexture();
        texture.repeat.copy(repeat);
        if (ground.material.map) ground.material.map.dispose();
        ground.material.map = texture;
        ground.material.needsUpdate = true;
    }

    function playerUniform() {
        var uniform = { value: new T.Vector3() };
        playerUniforms.push(uniform);
        return uniform;
    }

    // Capa aditiva sobre el suelo: una onda que sale del centro y enciende
    // las juntas de las baldosas a su paso, más un halo que sigue al jugador.
    function addGroundPulse() {
        var plane = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShaderMaterial({
            transparent: true, depthWrite: false, blending: T.AdditiveBlending,
            uniforms: {
                time: timeUniform(), player: playerUniform(),
                colorA: { value: new T.Color(CYAN) }, colorB: { value: new T.Color(MAGENTA) }
            },
            vertexShader: [
                'varying vec2 vWorld;',
                'void main() {',
                '  vec4 world = modelMatrix * vec4(position, 1.0);',
                '  vWorld = world.xz;',
                '  gl_Position = projectionMatrix * viewMatrix * world;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform float time; uniform vec3 player; uniform vec3 colorA; uniform vec3 colorB;',
                'varying vec2 vWorld;',
                'void main() {',
                '  float tile = ' + GRID_TILE.toFixed(1) + ';',
                '  vec2 toLine = abs(fract(vWorld / tile + 0.5) - 0.5) * tile;',
                '  float away = length(vWorld - player.xz);',
                // Las líneas se ensanchan con la distancia para no parpadear
                '  float line = 1.0 - smoothstep(0.0, 0.1 + away * 0.006, min(toLine.x, toLine.y));',
                '  float cycle = fract(time * 0.16);',
                '  float ring = smoothstep(10.0, 0.0, abs(length(vWorld) - cycle * 135.0)) * (1.0 - cycle);',
                '  float halo = smoothstep(18.0, 2.0, away);',
                '  float alpha = (line * (ring * 0.95 + halo * 0.3) + ring * 0.04) * smoothstep(120.0, 50.0, away);',
                '  if (alpha < 0.004) discard;',
                '  gl_FragColor = vec4(mix(colorA, colorB, cycle) * alpha, 1.0);',
                '}'
            ].join('\n')
        }));
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 0.03;
        plane.renderOrder = 1;
        scene.add(plane);
        heavyExtras.push(plane);
    }

    function addTowerBeacons(coverLayout) {
        var beamHeight = 70;
        var beams = [];
        var beamColors = [];
        var ringGeometry = new T.TorusGeometry(4.6, 0.09, 6, 40);
        var ringMaterials = {};

        coverLayout.forEach(function (cover, index) {
            if (cover[3] < TOWER_MIN_HEIGHT) return;
            var hex = index % 2 === 0 ? CYAN : MAGENTA;
            var tint = new T.Color(hex);

            var beam = new T.CylinderGeometry(0.55, 0.55, beamHeight, 10, 1, true).toNonIndexed();
            beam.translate(cover[0], cover[3] + beamHeight / 2, cover[1]);
            var positions = beam.attributes.position;
            for (var i = 0; i < positions.count; i++) {
                var k = 1 - (positions.getY(i) - cover[3]) / beamHeight;
                beams.push(positions.getX(i), positions.getY(i), positions.getZ(i));
                beamColors.push(tint.r * k * 0.55, tint.g * k * 0.55, tint.b * k * 0.55);
            }
            beam.dispose();

            if (!ringMaterials[hex]) ringMaterials[hex] = new T.MeshBasicMaterial({ color: hex, fog: false });
            for (var r = 0; r < 2; r++) {
                var ring = new T.Mesh(ringGeometry, ringMaterials[hex]);
                ring.position.set(cover[0], cover[3] + 1.6 + r * 1.3, cover[1]);
                ring.rotation.x = Math.PI / 2;
                ring.scale.setScalar(r === 0 ? 1 : 0.66);
                ring.userData.spin = (r === 0 ? 0.7 : -1.1) * (index % 2 === 0 ? 1 : -1);
                ring.userData.baseY = ring.position.y;
                ring.userData.phase = index + r;
                scene.add(ring);
                towerRings.push(ring);
            }
        });

        if (!beams.length) return;
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(beams, 3));
        geometry.setAttribute('color', new T.Float32BufferAttribute(beamColors, 3));
        var mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({
            vertexColors: true, blending: T.AdditiveBlending, transparent: true,
            depthWrite: false, side: T.DoubleSide, fog: false
        }));
        mesh.frustumCulled = false;
        scene.add(mesh);
    }

    // Barrera de energía en el límite del mapa: casi invisible de lejos, se
    // dibuja al acercarse para que el borde no sea un muro que no se ve.
    function addPerimeter(mapHalf) {
        var positions = [];
        var corners = [
            [-mapHalf, -mapHalf, mapHalf, -mapHalf], [mapHalf, -mapHalf, mapHalf, mapHalf],
            [mapHalf, mapHalf, -mapHalf, mapHalf], [-mapHalf, mapHalf, -mapHalf, -mapHalf]
        ];
        corners.forEach(function (c) {
            positions.push(
                c[0], 0, c[1], c[2], 0, c[3], c[2], FIELD_HEIGHT, c[3],
                c[0], 0, c[1], c[2], FIELD_HEIGHT, c[3], c[0], FIELD_HEIGHT, c[1]
            );
        });
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        var field = new T.Mesh(geometry, new T.ShaderMaterial({
            transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
            uniforms: {
                time: timeUniform(), player: playerUniform(),
                color: { value: new T.Color(CYAN) }, edge: { value: mapHalf - 0.5 }
            },
            vertexShader: [
                'varying vec3 vWorld;',
                'void main() {',
                '  vWorld = position;',
                '  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform float time; uniform vec3 player; uniform vec3 color; uniform float edge;',
                'varying vec3 vWorld;',
                'void main() {',
                '  float away = distance(vWorld.xz, player.xz);',
                '  float closeness = smoothstep(44.0, 6.0, away);',
                '  float along = abs(vWorld.x) > edge ? vWorld.z : vWorld.x;',
                '  vec2 cell = abs(fract(vec2(along, vWorld.y + time * 0.6) / 2.2) - 0.5);',
                '  float lattice = smoothstep(0.455, 0.5, max(cell.x, cell.y));',
                '  float diagonal = smoothstep(0.05, 0.0, abs(cell.x - cell.y)) * 0.3;',
                '  float scan = 0.5 + 0.5 * sin(vWorld.y * 3.0 - time * 4.0);',
                '  float rail = smoothstep(0.9, 0.0, vWorld.y) * smoothstep(190.0, 70.0, away);',
                '  float fade = smoothstep(' + FIELD_HEIGHT.toFixed(1) + ', 3.0, vWorld.y);',
                '  float alpha = (lattice * 0.8 + diagonal + scan * 0.05) * closeness * fade + rail * (0.3 + 0.7 * closeness);',
                '  if (alpha < 0.01) discard;',
                '  gl_FragColor = vec4(color * alpha, 1.0);',
                '}'
            ].join('\n')
        }));
        field.frustumCulled = false;
        field.renderOrder = 2;
        scene.add(field);
    }

    // Motas de polvo luminoso: la caja de partículas se repite alrededor de
    // la cámara, así siempre hay ambiente sin simular nada en la CPU.
    function addMotes() {
        var positions = [];
        for (var i = 0; i < MOTE_COUNT; i++) {
            positions.push(Math.random() * 60, Math.random() * 18, Math.random() * 60);
        }
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        var motes = new T.Points(geometry, new T.ShaderMaterial({
            transparent: true, depthWrite: false, blending: T.AdditiveBlending,
            uniforms: {
                time: timeUniform(), player: playerUniform(),
                color: { value: new T.Color(0x7fffe6) }, scale: { value: 90 }
            },
            vertexShader: [
                'uniform float time; uniform vec3 player; uniform float scale; varying float vAlpha;',
                'void main() {',
                '  vec3 box = vec3(60.0, 18.0, 60.0);',
                '  vec3 p = position;',
                '  p.y += time * (0.25 + fract(position.x * 7.3) * 0.3);',
                '  p.x += sin(time * 0.4 + position.z) * 0.6;',
                '  vec3 rel = mod(p - player + box * 0.5, box) - box * 0.5;',
                '  vec4 mv = viewMatrix * vec4(player + rel, 1.0);',
                '  gl_PointSize = scale * (0.6 + fract(position.z * 3.1)) / max(0.5, -mv.z);',
                '  vAlpha = smoothstep(30.0, 16.0, length(rel.xz)) * smoothstep(0.6, 3.0, -mv.z) * 0.6;',
                '  gl_Position = projectionMatrix * mv;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform vec3 color; varying float vAlpha;',
                'void main() {',
                '  float soft = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));',
                '  gl_FragColor = vec4(color * soft * vAlpha, 1.0);',
                '}'
            ].join('\n')
        }));
        motes.frustumCulled = false;
        scene.add(motes);
        heavyExtras.push(motes);
    }

    // ── Chispas (una sola nube de puntos para todo el juego) ─────────────────

    var sparks = null;

    function initSparks() {
        var positions = new Float32Array(SPARK_COUNT * 3);
        var colors = new Float32Array(SPARK_COUNT * 3);
        for (var i = 0; i < SPARK_COUNT; i++) positions[i * 3 + 1] = -999;
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
        var points = new T.Points(geometry, new T.PointsMaterial({
            size: 0.34, map: makeDotTexture(), vertexColors: true, blending: T.AdditiveBlending,
            transparent: true, depthWrite: false, fog: false
        }));
        points.frustumCulled = false;
        scene.add(points);
        sparks = {
            points: points, positions: positions, colors: colors,
            velocity: new Float32Array(SPARK_COUNT * 3),
            tint: new Float32Array(SPARK_COUNT * 3),
            life: new Float32Array(SPARK_COUNT),
            span: new Float32Array(SPARK_COUNT),
            weight: new Float32Array(SPARK_COUNT),
            cursor: 0, alive: 0
        };
    }

    var _sparkColor = new T.Color();

    // La reserva es circular: si se llena, la chispa nueva pisa a la más vieja.
    function emitSpark(x, y, z, vx, vy, vz, seconds, weight) {
        var i = sparks.cursor;
        sparks.cursor = (i + 1) % SPARK_COUNT;
        if (sparks.life[i] <= 0) sparks.alive++;
        var o = i * 3;
        sparks.positions[o] = x; sparks.positions[o + 1] = y; sparks.positions[o + 2] = z;
        sparks.velocity[o] = vx; sparks.velocity[o + 1] = vy; sparks.velocity[o + 2] = vz;
        sparks.tint[o] = _sparkColor.r; sparks.tint[o + 1] = _sparkColor.g; sparks.tint[o + 2] = _sparkColor.b;
        sparks.life[i] = sparks.span[i] = seconds;
        sparks.weight[i] = weight;
    }

    // Estallido: chispas en todas direcciones con sesgo hacia (dirX, dirZ).
    function burst(x, y, z, colorHex, count, speed, dirX, dirZ) {
        if (!sparks) return;
        _sparkColor.setHex(colorHex);
        dirX = dirX || 0; dirZ = dirZ || 0;
        for (var i = 0; i < count; i++) {
            var azimuth = Math.random() * Math.PI * 2;
            var rise = Math.random() * 1.2 - 0.2;
            var force = speed * (0.35 + Math.random() * 0.65);
            emitSpark(x, y, z,
                Math.cos(azimuth) * force * 0.7 + dirX * speed * 0.5,
                rise * force,
                Math.sin(azimuth) * force * 0.7 + dirZ * speed * 0.5,
                0.35 + Math.random() * 0.55, 1);
        }
    }

    // Columna ascendente: se usa cuando algo se materializa o se recoge.
    function column(x, z, colorHex, height) {
        if (!sparks) return;
        _sparkColor.setHex(colorHex);
        var count = 12;
        for (var i = 0; i < count; i++) {
            var azimuth = Math.random() * Math.PI * 2;
            var radius = 0.3 + Math.random() * 0.5;
            emitSpark(x + Math.cos(azimuth) * radius, Math.random() * 0.6, z + Math.sin(azimuth) * radius,
                0, (height || 4) * (1.1 + Math.random() * 1.3), 0, 0.4 + Math.random() * 0.35, 0);
        }
    }

    function updateSparks(delta) {
        if (!sparks || sparks.alive === 0) return;
        var positions = sparks.positions, colors = sparks.colors, velocity = sparks.velocity;
        for (var i = 0; i < SPARK_COUNT; i++) {
            if (sparks.life[i] <= 0) continue;
            var o = i * 3;
            sparks.life[i] -= delta;
            if (sparks.life[i] <= 0) {
                positions[o + 1] = -999;
                colors[o] = colors[o + 1] = colors[o + 2] = 0;
                sparks.alive--;
                continue;
            }
            velocity[o + 1] -= SPARK_GRAVITY * sparks.weight[i] * delta;
            positions[o] += velocity[o] * delta;
            positions[o + 1] += velocity[o + 1] * delta;
            positions[o + 2] += velocity[o + 2] * delta;
            // Rebote amortiguado en el suelo: las chispas no lo atraviesan.
            if (positions[o + 1] < 0.05 && velocity[o + 1] < 0) {
                positions[o + 1] = 0.05;
                velocity[o + 1] *= -0.35;
            }
            var fade = sparks.life[i] / sparks.span[i];
            colors[o] = sparks.tint[o] * fade;
            colors[o + 1] = sparks.tint[o + 1] * fade;
            colors[o + 2] = sparks.tint[o + 2] * fade;
        }
        sparks.points.geometry.attributes.position.needsUpdate = true;
        sparks.points.geometry.attributes.color.needsUpdate = true;
    }

    // ── Ondas en el suelo ────────────────────────────────────────────────────

    var rings = [];
    var ringCursor = 0;

    function initRings() {
        var geometry = new T.RingGeometry(0.84, 1, 48);
        geometry.rotateX(-Math.PI / 2);
        for (var i = 0; i < RING_COUNT; i++) {
            var mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({
                blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false, side: T.DoubleSide
            }));
            mesh.visible = false;
            mesh.renderOrder = 3;
            scene.add(mesh);
            rings.push({ mesh: mesh, age: 0, radius: 1, active: false });
        }
    }

    function ring(x, z, colorHex, radius) {
        if (!rings.length) return;
        var slot = rings[ringCursor];
        ringCursor = (ringCursor + 1) % rings.length;
        slot.mesh.position.set(x, 0.06, z);
        slot.mesh.material.color.setHex(colorHex);
        slot.mesh.visible = true;
        slot.age = 0;
        slot.radius = radius;
        slot.active = true;
    }

    function updateRings(delta) {
        for (var i = 0; i < rings.length; i++) {
            var slot = rings[i];
            if (!slot.active) continue;
            slot.age += delta;
            var k = slot.age / RING_SECONDS;
            if (k >= 1) { slot.active = false; slot.mesh.visible = false; continue; }
            var grown = 1 - (1 - k) * (1 - k);
            slot.mesh.scale.setScalar(0.2 + grown * slot.radius);
            slot.mesh.material.opacity = 1 - k;
        }
    }

    function explosion(x, y, z, radius, colorHex) {
        burst(x, y, z, colorHex, 42, radius * 2.2, 0, 0);
        burst(x, y, z, 0xffffff, 12, radius * 1.2, 0, 0);
        ring(x, z, colorHex, radius);
    }

    // ── Recogibles ───────────────────────────────────────────────────────────

    // Haz de luz + aro en el suelo para que un recogible se vea desde lejos.
    // Geometría y materiales se comparten por color: aparecer y desaparecer
    // no reserva ni libera nada.
    function beacon(colorHex, dropToGround) {
        var cached = beaconCache[colorHex];
        if (!cached) {
            var tint = new T.Color(colorHex);
            var pillar = new T.CylinderGeometry(0.26, 0.26, 6, 10, 1, true);
            pillar.translate(0, 3, 0);
            var positions = pillar.attributes.position;
            var colors = [];
            for (var i = 0; i < positions.count; i++) {
                var k = Math.pow(1 - positions.getY(i) / 6, 1.6) * 0.3;
                colors.push(tint.r * k, tint.g * k, tint.b * k);
            }
            pillar.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
            var halo = new T.RingGeometry(0.75, 0.95, 32);
            halo.rotateX(-Math.PI / 2);
            cached = beaconCache[colorHex] = {
                pillar: pillar, halo: halo,
                pillarMaterial: new T.MeshBasicMaterial({
                    vertexColors: true, blending: T.AdditiveBlending, transparent: true,
                    depthWrite: false, side: T.DoubleSide, fog: false
                }),
                haloMaterial: new T.MeshBasicMaterial({
                    color: colorHex, blending: T.AdditiveBlending, transparent: true,
                    opacity: 0.7, depthWrite: false, side: T.DoubleSide, fog: false
                })
            };
        }
        var group = new T.Group();
        var pillarMesh = new T.Mesh(cached.pillar, cached.pillarMaterial);
        var haloMesh = new T.Mesh(cached.halo, cached.haloMaterial);
        pillarMesh.position.y = -dropToGround + 0.05;
        haloMesh.position.y = -dropToGround + 0.07;
        group.add(pillarMesh);
        group.add(haloMesh);
        return group;
    }

    var medkitParts = null;

    function medkit() {
        if (!medkitParts) {
            medkitParts = {
                body: new T.BoxGeometry(0.66, 0.5, 0.3),
                crossWide: new T.BoxGeometry(0.34, 0.11, 0.34),
                crossTall: new T.BoxGeometry(0.11, 0.34, 0.34),
                handle: new T.BoxGeometry(0.3, 0.06, 0.1),
                shell: new T.MeshLambertMaterial({ color: 0xe8eef5, emissive: 0x35504a }),
                cross: new T.MeshBasicMaterial({ color: 0x00ff66 }),
                trim: new T.MeshLambertMaterial({ color: 0x2a3140 })
            };
        }
        var group = new T.Group();
        group.add(new T.Mesh(medkitParts.body, medkitParts.shell));
        group.add(new T.Mesh(medkitParts.crossWide, medkitParts.cross));
        group.add(new T.Mesh(medkitParts.crossTall, medkitParts.cross));
        var handle = new T.Mesh(medkitParts.handle, medkitParts.trim);
        handle.position.y = 0.29;
        group.add(handle);
        return group;
    }

    var starShape = null;

    function starGeometry() {
        if (starShape) return starShape;
        var shape = new T.Shape();
        for (var i = 0; i < 10; i++) {
            var radius = i % 2 === 0 ? 0.58 : 0.25;
            var angle = Math.PI / 2 + i * Math.PI / 5;
            var x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        shape.closePath();
        starShape = new T.ExtrudeGeometry(shape, {
            depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1
        });
        starShape.translate(0, 0, -0.08);
        return starShape;
    }

    // ── Ciclo de vida ────────────────────────────────────────────────────────

    function init(options) {
        scene = options.scene;
        camera = options.camera;

        if (options.skyDome) dressSky(options.skyDome, options.colors);
        addStars();
        addMoon();
        if (options.skyline) dressSkyline(options.skyline);
        addTraffic();
        addSearchlights();

        if (options.coverMaterial) {
            dressCover(options.coverMaterial);
            addCoverCaps(options.coverLayout || [], options.coverMaterial);
        }
        if (options.ground) dressGround(options.ground);
        addGroundPulse();
        addTowerBeacons(options.coverLayout || []);
        addPerimeter(options.mapHalf);
        addMotes();

        initSparks();
        initRings();
    }

    function setQuality(name) {
        var showHeavy = name !== 'rendimiento';
        for (var i = 0; i < heavyExtras.length; i++) heavyExtras[i].visible = showHeavy;
    }

    function update(delta) {
        if (!scene) return;
        clock += delta;
        var i;
        for (i = 0; i < timeUniforms.length; i++) timeUniforms[i].value = clock;
        for (i = 0; i < playerUniforms.length; i++) playerUniforms[i].value.copy(camera.position);

        var fog = scene.fog;
        if (fog) {
            for (i = 0; i < fogUniforms.length; i++) {
                fogUniforms[i].fogColor.value.copy(fog.color);
                fogUniforms[i].fogNear.value = fog.near;
                fogUniforms[i].fogFar.value = fog.far;
            }
        }

        // El cielo viaja con la cámara: nunca se llega al borde de la cúpula.
        for (i = 0; i < skyFollowers.length; i++) {
            var follower = skyFollowers[i];
            follower.position.copy(camera.position);
            if (follower.userData.offset) follower.position.add(follower.userData.offset);
        }

        for (i = 0; i < towerRings.length; i++) {
            var towerRing = towerRings[i];
            towerRing.rotation.z += towerRing.userData.spin * delta;
            towerRing.position.y = towerRing.userData.baseY + Math.sin(clock * 1.3 + towerRing.userData.phase) * 0.35;
        }

        for (i = 0; i < searchlights.length; i++) {
            var light = searchlights[i];
            var sweep = clock * 0.16 + light.userData.phase;
            light.rotation.set(0.55 + Math.sin(sweep * 1.3) * 0.3, sweep, 0.35 + Math.cos(sweep) * 0.25);
        }

        updateSparks(delta);
        updateRings(delta);
    }

    root.WorldFX = {
        init: init,
        update: update,
        setQuality: setQuality,
        burst: burst,
        column: column,
        ring: ring,
        explosion: explosion,
        beacon: beacon,
        medkit: medkit,
        starGeometry: starGeometry
    };

})(typeof window !== 'undefined' ? window : this);
