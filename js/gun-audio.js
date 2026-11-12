/**
 * ============================================================================
 * NEON SIEGE — AUDIO DE ARMAS SINTETIZADO
 * js/gun-audio.js
 *
 * No carga ningún archivo de audio: cada disparo se construye en runtime con
 * Web Audio API (ruido filtrado + osciladores) para que cada arma suene
 * distinta. Todo el sonido sale por el destinationNode que entrega el juego,
 * así el volumen general y el mute del juego siguen mandando.
 *
 * Uso: GunAudio.init(ctx, masterGain) una vez, luego shot/reload/dry/impact/
 * explosion/minigunSpin desde el bucle de juego.
 * ============================================================================
 */
(function () {
    'use strict';

    var NOISE_SECONDS = 2;
    var IMPULSE_SECONDS = 0.8;
    var REVERB_WET = 0.18;
    var MAX_VOICES = 12;
    var PITCH_JITTER = 0.06;
    var VOLUME_JITTER = 0.10;
    var SILENCE = 0.0001;
    // Los parciales metálicos suenan más largos que el propio clic.
    var PARTIAL_TAIL = 3.2;

    var audioCtx = null;
    var outputNode = null;
    var whiteNoise = null;
    var pinkNoise = null;
    var reverbInput = null;
    var activeVoices = 0;
    var engineMotor = null;

    // ── Buffers compartidos ──────────────────────────────────────────────────

    function createNoiseBuffer(seconds, usePinkFilter) {
        var length = Math.floor(audioCtx.sampleRate * seconds);
        var buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
        var data = buffer.getChannelData(0);
        var i;
        if (!usePinkFilter) {
            for (i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
            return buffer;
        }
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (i = 0; i < length; i++) {
            var white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
        return buffer;
    }

    // Ruido con caída exponencial: da un eco corto de espacio abierto.
    function createImpulseResponse(seconds) {
        var length = Math.floor(audioCtx.sampleRate * seconds);
        var buffer = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
        for (var channel = 0; channel < 2; channel++) {
            var data = buffer.getChannelData(channel);
            for (var i = 0; i < length; i++) {
                var remaining = 1 - i / length;
                data[i] = (Math.random() * 2 - 1) * Math.pow(remaining, 2.6);
            }
        }
        return buffer;
    }

    function buildReverb() {
        var convolver = audioCtx.createConvolver();
        convolver.buffer = createImpulseResponse(IMPULSE_SECONDS);
        var wet = audioCtx.createGain();
        wet.gain.value = REVERB_WET;
        reverbInput = audioCtx.createGain();
        reverbInput.gain.value = 1;
        reverbInput.connect(convolver);
        convolver.connect(wet);
        wet.connect(outputNode);
    }

    // ── Utilidades ───────────────────────────────────────────────────────────

    function isReady() {
        return !!audioCtx && !!outputNode;
    }

    function jitter(base, amount) {
        return base * (1 + (Math.random() * 2 - 1) * amount);
    }

    function createNoiseSource(buffer) {
        var source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = jitter(1, PITCH_JITTER);
        return source;
    }

    function connectOutput(node, wetAmount) {
        node.connect(outputNode);
        if (!wetAmount || !reverbInput) return null;
        var send = audioCtx.createGain();
        send.gain.value = wetAmount;
        node.connect(send);
        send.connect(reverbInput);
        return send;
    }

    function applyShape(gainParam, when, spec) {
        var peak = jitter(spec.vol, VOLUME_JITTER);
        var dur = spec.dur;
        if (spec.shape === 'swell') {
            var swellPeak = spec.attack === undefined ? dur * 0.6 : spec.attack;
            gainParam.setValueAtTime(SILENCE, when);
            gainParam.linearRampToValueAtTime(peak, when + swellPeak);
            gainParam.exponentialRampToValueAtTime(SILENCE, when + dur);
            return;
        }
        if (spec.shape === 'swoosh') {
            gainParam.setValueAtTime(SILENCE, when);
            gainParam.linearRampToValueAtTime(peak, when + dur * 0.42);
            gainParam.exponentialRampToValueAtTime(SILENCE, when + dur);
            return;
        }
        var attack = spec.attack === undefined ? 0.002 : spec.attack;
        gainParam.setValueAtTime(SILENCE, when);
        gainParam.linearRampToValueAtTime(peak, when + attack);
        gainParam.exponentialRampToValueAtTime(SILENCE, when + attack + dur);
    }

    // Cada capa se autolimpia: al terminar su última fuente, desconecta sus nodos
    // y avisa con onDone para que la voz pueda liberarse antes que el temporizador.
    function runSources(sources, nodes, when, stopTime, onDone) {
        var pending = sources.length;
        function finish() {
            for (var i = 0; i < nodes.length; i++) {
                try {
                    nodes[i].disconnect();
                } catch (error) {
                    // El nodo ya estaba desconectado: nada que hacer.
                }
            }
            if (onDone) onDone();
        }
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            source.onended = function () {
                pending -= 1;
                if (pending === 0) finish();
            };
            source.start(when);
            source.stop(when + stopTime);
        }
    }

    // ── Capas de sonido ──────────────────────────────────────────────────────

    function playNoiseBand(when, spec) {
        var source = createNoiseSource(spec.buffer || whiteNoise);
        var filter = audioCtx.createBiquadFilter();
        filter.type = spec.filterType || 'lowpass';
        filter.Q.value = spec.q === undefined ? 0.7 : spec.q;
        filter.frequency.setValueAtTime(jitter(spec.freq, PITCH_JITTER), when);
        if (spec.freqEnd) {
            var sweep = spec.sweep === undefined ? spec.dur : spec.sweep;
            filter.frequency.exponentialRampToValueAtTime(jitter(spec.freqEnd, PITCH_JITTER), when + sweep);
        }
        var gain = audioCtx.createGain();
        applyShape(gain.gain, when, spec);
        source.connect(filter);
        filter.connect(gain);
        var send = connectOutput(gain, spec.wet);
        var nodes = [source, filter, gain];
        if (send) nodes.push(send);
        runSources([source], nodes, when, spec.dur + 0.03, spec.onDone);
    }

    function playWave(when, spec) {
        var osc = audioCtx.createOscillator();
        osc.type = spec.type || 'sine';
        osc.frequency.setValueAtTime(jitter(spec.from, PITCH_JITTER), when);
        if (spec.to) {
            osc.frequency.exponentialRampToValueAtTime(jitter(spec.to, PITCH_JITTER), when + spec.dur);
        }
        var gain = audioCtx.createGain();
        applyShape(gain.gain, when, spec);
        osc.connect(gain);
        var send = connectOutput(gain, spec.wet);
        var nodes = [osc, gain];
        if (send) nodes.push(send);
        runSources([osc], nodes, when, spec.dur + 0.03, spec.onDone);
    }

    // Clic metálico: ráfaga de ruido bandpass agudo + parciales agudos que
    // suenan a resorte de Mechanismo.
    function playMetalClick(when, spec) {
        playNoiseBand(when, {
            buffer: spec.buffer || whiteNoise,
            filterType: 'bandpass',
            freq: spec.freq,
            freqEnd: spec.freq * 0.7,
            sweep: spec.dur,
            q: spec.q,
            dur: spec.dur,
            attack: 0.001,
            vol: spec.vol,
            wet: spec.wet
        });
        if (!spec.partials) return;
        for (var i = 0; i < spec.partials.length; i++) {
            var partial = spec.partials[i];
            playWave(when, {
                type: 'triangle',
                from: spec.freq * partial,
                to: spec.freq * partial * 0.92,
                dur: spec.dur * PARTIAL_TAIL,
                vol: spec.vol * 0.5,
                wet: spec.wet
            });
        }
    }

    // ── Recetas por arma ──────────────────────────────────────────────────────
    // Cada receta: crack (transitorio) + body (boom) + tail (cola a la reverb)
    // + action (mecánica diferida). `total` alimenta el límite de voces.

    var RECIPES = {
        pistol: {
            crack: { filterType: 'highpass', freq: 1800, dur: 0.03, vol: 0.45, attack: 0.001, wet: 0.12 },
            bodyNoise: { filterType: 'lowpass', freq: 1400, freqEnd: 300, sweep: 0.09, dur: 0.09, vol: 0.43, wet: 0.1 },
            bodyWave: { from: 150, to: 60, dur: 0.1, vol: 0.31, wet: 0.08 },
            tail: { filterType: 'lowpass', freq: 520, freqEnd: 220, dur: 0.22, vol: 0.14, wet: 0.35 },
            action: null
        },
        revolver: {
            crack: { filterType: 'highpass', freq: 1200, dur: 0.05, vol: 0.50, attack: 0.001, wet: 0.16 },
            bodyNoise: { filterType: 'lowpass', freq: 900, freqEnd: 200, sweep: 0.18, dur: 0.18, vol: 0.47, wet: 0.14 },
            bodyWave: { from: 130, to: 42, dur: 0.28, vol: 0.40, wet: 0.12 },
            tail: { filterType: 'lowpass', freq: 380, freqEnd: 150, dur: 0.5, vol: 0.17, wet: 0.5 },
            action: null
        },
        smg: {
            crack: { filterType: 'bandpass', freq: 3200, q: 1.2, dur: 0.02, vol: 0.29, attack: 0.001, wet: 0.08 },
            bodyNoise: { filterType: 'lowpass', freq: 2600, freqEnd: 700, sweep: 0.05, dur: 0.05, vol: 0.27, wet: 0.06 },
            bodyWave: { from: 190, to: 90, dur: 0.05, vol: 0.16, wet: 0.05 },
            tail: { filterType: 'lowpass', freq: 900, freqEnd: 500, dur: 0.08, vol: 0.09, wet: 0.12 },
            action: null
        },
        rifle: {
            crack: { filterType: 'highpass', freq: 1500, dur: 0.045, vol: 0.50, attack: 0.001, wet: 0.14 },
            bodyNoise: { filterType: 'lowpass', freq: 2000, freqEnd: 320, sweep: 0.13, dur: 0.13, vol: 0.50, wet: 0.12 },
            bodyWave: { from: 165, to: 55, dur: 0.16, vol: 0.38, wet: 0.1 },
            tail: { filterType: 'lowpass', freq: 700, freqEnd: 260, dur: 0.3, vol: 0.16, wet: 0.35 },
            action: null
        },
        shotgun: {
            crack: { filterType: 'bandpass', freq: 2400, q: 0.9, dur: 0.05, vol: 0.38, attack: 0.001, wet: 0.15 },
            bodyNoise: { filterType: 'lowpass', freq: 1200, freqEnd: 140, sweep: 0.32, dur: 0.32, vol: 0.54, wet: 0.2 },
            bodyWave: { from: 120, to: 32, dur: 0.34, vol: 0.45, wet: 0.16 },
            tail: { filterType: 'lowpass', freq: 320, freqEnd: 120, dur: 0.7, vol: 0.20, wet: 0.5 },
            action: { delay: 0.35, count: 2, spacing: 0.11, freq: 2600, q: 2.2, dur: 0.045, vol: 0.2, wet: 0.25, partials: [1.9, 2.7] }
        },
        sniper: {
            crack: { filterType: 'highpass', freq: 1000, dur: 0.07, vol: 0.46, attack: 0.001, wet: 0.22 },
            bodyNoise: { filterType: 'lowpass', freq: 1500, freqEnd: 150, sweep: 0.4, dur: 0.4, vol: 0.46, wet: 0.24 },
            bodyWave: { from: 140, to: 30, dur: 0.4, vol: 0.42, wet: 0.2 },
            tail: { filterType: 'lowpass', freq: 300, freqEnd: 110, dur: 1.1, vol: 0.22, wet: 0.9 },
            action: { delay: 0.6, count: 1, spacing: 0, freq: 2000, q: 2.4, dur: 0.06, vol: 0.26, wet: 0.4, partials: [1.7, 2.4, 3.6] }
        },
        minigun: {
            crack: { filterType: 'bandpass', freq: 3400, q: 1.4, dur: 0.018, vol: 0.20, attack: 0.001, wet: 0.05 },
            bodyNoise: { filterType: 'lowpass', freq: 2400, freqEnd: 600, sweep: 0.04, dur: 0.04, vol: 0.18, wet: 0.04 },
            bodyWave: { from: 200, to: 100, dur: 0.035, vol: 0.11, wet: 0.03 },
            tail: { filterType: 'lowpass', freq: 1000, freqEnd: 600, dur: 0.06, vol: 0.06, wet: 0.08 },
            action: null
        },
        rpg: {
            crack: null,
            bodyNoise: {
                filterType: 'bandpass', freq: 400, freqEnd: 1500, sweep: 0.6, q: 1.6,
                dur: 0.6, vol: 0.50, attack: 0.3, shape: 'swell', wet: 0.3
            },
            bodyWave: { from: 90, to: 45, dur: 0.55, vol: 0.18, wet: 0.2 },
            tail: { filterType: 'lowpass', freq: 900, freqEnd: 200, dur: 0.35, vol: 0.14, wet: 0.45 },
            action: null
        },
        golden: {
            crack: { filterType: 'highpass', freq: 2200, dur: 0.03, vol: 0.38, attack: 0.001, wet: 0.12 },
            bodyNoise: { filterType: 'lowpass', freq: 1500, freqEnd: 320, sweep: 0.08, dur: 0.08, vol: 0.36, wet: 0.1 },
            bodyWave: { from: 150, to: 60, dur: 0.1, vol: 0.27, wet: 0.08 },
            tail: null,
            action: null,
            bell: [
                { from: 1568, to: 1560, dur: 0.7, vol: 0.16, wet: 0.6 },
                { from: 2349, to: 2340, dur: 0.5, vol: 0.1, wet: 0.6 },
                { from: 3136, to: 3120, dur: 0.35, vol: 0.06, wet: 0.6 }
            ]
        },
        bat: {
            crack: null,
            bodyNoise: {
                filterType: 'bandpass', freq: 220, freqEnd: 1600, sweep: 0.14, q: 1.1,
                dur: 0.22, vol: 0.27, shape: 'swoosh', wet: 0.25
            },
            bodyWave: null,
            tail: null,
            action: null
        }
    };

    var RECIPE_ALIASES = {
        pistol: 'pistol',
        gg_pistol: 'pistol',
        revolver: 'revolver',
        gg_revolver: 'revolver',
        smg: 'smg',
        gg_smg: 'smg',
        rifle: 'rifle',
        gg_rifle: 'rifle',
        shotgun: 'shotgun',
        gg_shotgun: 'shotgun',
        sniper: 'sniper',
        gg_sniper: 'sniper',
        minigun: 'minigun',
        gg_minigun: 'minigun',
        rpg: 'rpg',
        gg_rpg: 'rpg',
        golden: 'golden',
        gg_golden: 'golden',
        bat: 'bat',
        gg_bat: 'bat'
    };

    var RELOAD_STYLE = {
        pistol:   { outFreq: 620,  outVol: 0.30, inFreq: 1500, inVol: 0.40, chkFreq: 2400, chkVol: 0.28 },
        revolver: { outFreq: 500,  outVol: 0.36, inFreq: 1200, inVol: 0.42, chkFreq: 2000, chkVol: 0.30 },
        smg:      { outFreq: 700,  outVol: 0.26, inFreq: 1700, inVol: 0.36, chkFreq: 2800, chkVol: 0.24 },
        rifle:    { outFreq: 560,  outVol: 0.32, inFreq: 1600, inVol: 0.44, chkFreq: 2600, chkVol: 0.30 },
        shotgun:  { outFreq: 460,  outVol: 0.40, inFreq: 1250, inVol: 0.50, chkFreq: 2100, chkVol: 0.34 },
        sniper:   { outFreq: 430,  outVol: 0.42, inFreq: 1150, inVol: 0.52, chkFreq: 1900, chkVol: 0.36 },
        minigun:  { outFreq: 380,  outVol: 0.44, inFreq: 1000, inVol: 0.56, chkFreq: 1700, chkVol: 0.38 },
        rpg:      { outFreq: 340,  outVol: 0.46, inFreq: 900,  inVol: 0.50, chkFreq: 1500, chkVol: 0.30 },
        golden:   { outFreq: 680,  outVol: 0.30, inFreq: 1800, inVol: 0.42, chkFreq: 2900, chkVol: 0.30 },
        bat:      { outFreq: 700,  outVol: 0.20, inFreq: 1800, inVol: 0.20, chkFreq: 2600, chkVol: 0.16 }
    };

    function getRecipeName(id) {
        if (typeof id !== 'string') return null;
        return RECIPE_ALIASES[id] || null;
    }

    // ── Control de voces simultáneas ─────────────────────────────────────────

    // Una voz se ocupa al empezar el disparo y se libera sola cuando acaba la
    // capa mas larga, asi el contador refleja el sonido real y no un reloj.
    function acquireVoice() {
        if (activeVoices >= MAX_VOICES) return null;
        activeVoices += 1;
        var isReleased = false;
        return {
            release: function () {
                if (isReleased) return;
                isReleased = true;
                activeVoices -= 1;
            }
        };
    }

    // Copia una receta injecting onDone en la capa que dura mas, para que la
    // voz se devuelva en cuanto esa capa termina de sonar.
    function withVoiceRelease(layer, voice) {
        var copy = {};
        for (var key in layer) {
            if (Object.prototype.hasOwnProperty.call(layer, key)) copy[key] = layer[key];
        }
        copy.onDone = voice.release;
        return copy;
    }

    // ── API pública ──────────────────────────────────────────────────────────

    function init(ctx, destination) {
        if (!ctx) return;
        stopEngine();
        audioCtx = ctx;
        outputNode = destination || ctx.destination;
        whiteNoise = createNoiseBuffer(NOISE_SECONDS, false);
        pinkNoise = createNoiseBuffer(NOISE_SECONDS, true);
        activeVoices = 0;
        buildReverb();
    }

    // La capa mas larga de cada receta es la que devuelve la voz al pool.
    var VOICE_HOLDER = 'tail';

    function shot(id) {
        if (!isReady()) return;
        var name = getRecipeName(id);
        if (!name) return;
        var recipe = RECIPES[name];
        var voice = acquireVoice();
        if (!voice) return;
        var when = audioCtx.currentTime + 0.005;
        if (recipe.crack) playNoiseBand(when, recipe.crack);
        if (recipe.bodyNoise) playNoiseBand(when, recipe.bodyNoise);
        if (recipe.bodyWave) playWave(when, recipe.bodyWave);
        if (recipe.bell) playBell(when, recipe.bell);
        if (recipe.action) playAction(when + recipe.action.delay, recipe.action);
        var longest = recipe[VOICE_HOLDER] || recipe.bodyNoise || recipe.crack;
        if (longest) {
            playNoiseBand(when, withVoiceRelease(longest, voice));
        } else {
            voice.release();
        }
    }

    function playBell(when, partials) {
        for (var i = 0; i < partials.length; i++) {
            playWave(when, partials[i]);
        }
    }

    function playAction(when, spec) {
        var count = spec.count || 1;
        for (var i = 0; i < count; i++) {
            playMetalClick(when + i * spec.spacing, spec);
        }
    }

    function reload(id, durationMs) {
        if (!isReady()) return;
        var name = getRecipeName(id);
        if (!name) return;
        var style = RELOAD_STYLE[name];
        var total = (durationMs > 0 ? durationMs : 1400) / 1000;
        var when = audioCtx.currentTime + 0.005;
        playNoiseBand(when + total * 0.1, {
            filterType: 'bandpass', freq: style.outFreq, q: 1.8,
            dur: 0.05, attack: 0.001, vol: style.outVol, wet: 0.2
        });
        playMetalClick(when + total * 0.5, {
            freq: style.inFreq, q: 2.2, dur: 0.055, vol: style.inVol,
            wet: 0.3, partials: [1.8, 2.6]
        });
        playMetalClick(when + total * 0.84, {
            freq: style.chkFreq, q: 2.6, dur: 0.04, vol: style.chkVol,
            wet: 0.25, partials: [2.1]
        });
    }

    function dry() {
        if (!isReady()) return;
        var when = audioCtx.currentTime + 0.005;
        playNoiseBand(when, {
            filterType: 'bandpass', freq: 900, q: 3, dur: 0.02,
            attack: 0.001, vol: 0.3, wet: 0.1
        });
        playWave(when, { type: 'square', from: 220, to: 180, dur: 0.02, vol: 0.12, wet: 0.1 });
    }

    function impact(kind) {
        if (!isReady()) return;
        var when = audioCtx.currentTime + 0.005;
        if (kind === 'flesh') {
            playNoiseBand(when, {
                buffer: pinkNoise, filterType: 'lowpass', freq: 500, freqEnd: 180,
                sweep: 0.13, dur: 0.13, vol: 0.45, wet: 0.1
            });
            playWave(when, { from: 110, to: 55, dur: 0.12, vol: 0.3, wet: 0.08 });
            return;
        }
        playNoiseBand(when, {
            filterType: 'bandpass', freq: 3200, freqEnd: 1400, sweep: 0.09, q: 5,
            dur: 0.14, vol: 0.28, wet: 0.4
        });
        playWave(when, { type: 'triangle', from: 2600, to: 1500, dur: 0.13, vol: 0.12, wet: 0.4 });
    }

    function explosion() {
        if (!isReady()) return;
        var when = audioCtx.currentTime + 0.005;
        playNoiseBand(when, {
            filterType: 'highpass', freq: 1200, dur: 0.07, vol: 0.4, attack: 0.001, wet: 0.3
        });
        playNoiseBand(when, {
            buffer: pinkNoise, filterType: 'lowpass', freq: 1800, freqEnd: 80,
            sweep: 1.2, dur: 1.2, vol: 0.55, wet: 0.6
        });
        playWave(when, { from: 70, to: 28, dur: 1.0, vol: 0.32, wet: 0.3 });
    }

    // ── Motor continuo de la minigun ─────────────────────────────────────────

    function startEngine() {
        var when = audioCtx.currentTime + 0.005;
        var nodes = [];
        var sources = [];

        var motorGain = audioCtx.createGain();
        motorGain.gain.setValueAtTime(SILENCE, when);
        motorGain.gain.linearRampToValueAtTime(0.18, when + 0.12);
        var send = connectOutput(motorGain, 0.1);
        nodes.push(motorGain);
        if (send) nodes.push(send);

        var toneOsc = audioCtx.createOscillator();
        toneOsc.type = 'sawtooth';
        toneOsc.frequency.value = 78;
        var toneOsc2 = audioCtx.createOscillator();
        toneOsc2.type = 'sawtooth';
        toneOsc2.frequency.value = 84;
        var toneGain = audioCtx.createGain();
        toneGain.gain.value = 0.5;
        toneOsc.connect(toneGain);
        toneOsc2.connect(toneGain);
        toneGain.connect(motorGain);

        var roar = createNoiseSource(pinkNoise);
        roar.loop = true;
        var roarFilter = audioCtx.createBiquadFilter();
        roarFilter.type = 'bandpass';
        roarFilter.frequency.value = 800;
        roarFilter.Q.value = 0.8;
        var roarGain = audioCtx.createGain();
        roarGain.gain.value = 0.9;
        roar.connect(roarFilter);
        roarFilter.connect(roarGain);
        roarGain.connect(motorGain);

        // Trémolo cuadrado: da el traqueteo de las cañones girando.
        var tremolo = audioCtx.createOscillator();
        tremolo.type = 'sawtooth';
        tremolo.frequency.value = 24;
        var tremoloDepth = audioCtx.createGain();
        tremoloDepth.gain.value = 0.14;
        tremolo.connect(tremoloDepth);
        tremoloDepth.connect(motorGain.gain);

        sources.push(toneOsc, toneOsc2, roar, tremolo);
        nodes.push(toneGain, roarFilter, roarGain, tremoloDepth);
        for (var i = 0; i < sources.length; i++) sources[i].start(when);

        engineMotor = {
            sources: sources,
            nodes: nodes,
            gain: motorGain
        };
    }

    function stopEngine() {
        if (!engineMotor) return;
        var motor = engineMotor;
        engineMotor = null;
        var when = audioCtx.currentTime;
        motor.gain.gain.cancelScheduledValues(when);
        motor.gain.gain.setValueAtTime(Math.max(motor.gain.gain.value, SILENCE), when);
        motor.gain.gain.linearRampToValueAtTime(SILENCE, when + 0.14);
        var pending = motor.sources.length;
        var isCleanedUp = false;
        function cleanup() {
            if (isCleanedUp) return;
            isCleanedUp = true;
            for (var i = 0; i < motor.nodes.length; i++) {
                try {
                    motor.nodes[i].disconnect();
                } catch (error) {
                    // El nodo ya estaba desconectado: nada que hacer.
                }
            }
        }
        for (var i = 0; i < motor.sources.length; i++) {
            motor.sources[i].onended = function () {
                pending -= 1;
                if (pending === 0) cleanup();
            };
            motor.sources[i].stop(when + 0.2);
        }
        // Red de seguridad: si onended no llegara, los nodos se suelan igual.
        setTimeout(cleanup, 400);
    }

    function minigunSpin(isSpinning) {
        if (!isReady()) return;
        if (isSpinning) {
            if (!engineMotor) startEngine();
            return;
        }
        stopEngine();
    }

    window.GunAudio = {
        init: init,
        shot: shot,
        reload: reload,
        dry: dry,
        impact: impact,
        explosion: explosion,
        minigunSpin: minigunSpin
    };
})();
