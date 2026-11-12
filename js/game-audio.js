/**
 * ============================================================================
 * NEON SIEGE — MÚSICA, AMBIENTE Y EFECTOS SINTETIZADOS
 * js/game-audio.js
 *
 * Complementa a gun-audio.js (que solo cubre las armas) con todo lo demás:
 * música que crece con el combate, pasos, salto, dash, voces y muertes de
 * cada arquetipo con paneo estéreo, recogibles, oleadas y latido con poca
 * vida. Igual que el resto del juego, no carga ningún archivo: todo se
 * construye con osciladores y ruido filtrado de Web Audio.
 *
 * Uso: GameAudio.init(ctx, masterGain) una vez; después setScene/setIntensity
 * desde el bucle y los disparadores sueltos (footstep, enemyDeath, pickup…)
 * desde los eventos del juego.
 * ============================================================================
 */
(function () {
    'use strict';

    var SILENCE = 0.0001;
    var MAX_VOICES = 26;
    var NOISE_SECONDS = 2;
    var REVERB_SECONDS = 1.6;
    var MUSIC_VOLUME = 0.7;
    var PAUSED_MUSIC_VOLUME = 0.55;
    var HEARING_RANGE = 16;        // distancia a la que un sonido baja a la mitad

    var TEMPO = 104;
    var STEP_SECONDS = 60 / TEMPO / 4;   // semicorchea
    var STEPS_PER_BAR = 16;
    // Medio segundo de margen: si un frame se atasca (móvil, pestaña ocupada)
    // las notas ya están programadas y el ritmo no se corta.
    var LOOKAHEAD_SECONDS = 0.5;
    var SCHEDULER_MS = 40;

    // Progresión i–VI–III–VII en La menor; la del jefe cierra en Mi mayor
    // para que suene a amenaza. Notas en MIDI.
    var CHORDS = {
        Am: [45, 57, 60, 64], F: [41, 57, 60, 65], C: [36, 55, 60, 64],
        G: [43, 55, 59, 62], E: [40, 56, 59, 64]
    };
    var PROGRESSION = ['Am', 'F', 'C', 'G'];
    var BOSS_PROGRESSION = ['Am', 'Am', 'F', 'E'];
    var ARP_PATTERN = [1, 2, 3, 2, 1, 3, 2, 3];

    var ctx = null;
    var sfxBus = null;
    var musicBus = null;
    var reverbInput = null;
    var arpEcho = null;
    var whiteNoise = null;
    var pinkNoise = null;
    var voices = 0;
    var throttles = {};
    var stepToggle = false;

    var music = {
        enabled: true, scene: 'off', level: 0, target: 0, boss: false,
        step: 0, nextTime: 0, timer: null,
        lowHealth: false, nextBeat: 0
    };

    // ── Infraestructura ──────────────────────────────────────────────────────

    function midiToHz(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    function makeNoise(pink) {
        var length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
        var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        var smooth = 0;
        for (var i = 0; i < length; i++) {
            var white = Math.random() * 2 - 1;
            // Filtro de un polo: suficiente para un ruido "rosado" de ambiente.
            smooth = pink ? smooth * 0.94 + white * 0.06 : white;
            data[i] = pink ? smooth * 3.2 : white;
        }
        return buffer;
    }

    function buildReverb() {
        var length = Math.floor(ctx.sampleRate * REVERB_SECONDS);
        var impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (var channel = 0; channel < 2; channel++) {
            var data = impulse.getChannelData(channel);
            for (var i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
            }
        }
        var convolver = ctx.createConvolver();
        convolver.buffer = impulse;
        var wet = ctx.createGain();
        wet.gain.value = 0.35;
        reverbInput = ctx.createGain();
        reverbInput.connect(convolver);
        convolver.connect(wet);
        wet.connect(sfxBus);
    }

    // Eco con realimentación para el arpegio: le da la cola de sintetizador
    // ochentero sin gastar más notas.
    function buildArpEcho() {
        arpEcho = ctx.createGain();
        var delay = ctx.createDelay(1);
        delay.delayTime.value = STEP_SECONDS * 3;
        var feedback = ctx.createGain();
        feedback.gain.value = 0.34;
        arpEcho.connect(musicBus);
        arpEcho.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(musicBus);
    }

    function ready() {
        return !!ctx && ctx.state !== 'closed';
    }

    // Impide que el mismo sonido se apile cuando muchos eventos coinciden
    // (por ejemplo, veinte enemigos apareciendo a la vez).
    function throttled(key, milliseconds) {
        var now = ctx.currentTime * 1000;
        if (throttles[key] && now - throttles[key] < milliseconds) return true;
        throttles[key] = now;
        return false;
    }

    // Punto de salida con posición: paneo estéreo y atenuación por distancia.
    function place(pan, distance) {
        var gain = ctx.createGain();
        var falloff = distance ? 1 / (1 + Math.pow(distance / HEARING_RANGE, 2)) : 1;
        gain.gain.value = falloff;
        if (pan && ctx.createStereoPanner) {
            var panner = ctx.createStereoPanner();
            panner.pan.value = Math.max(-1, Math.min(1, pan));
            gain.connect(panner);
            panner.connect(sfxBus);
        } else {
            gain.connect(sfxBus);
        }
        return gain;
    }

    function shapeEnvelope(param, when, spec) {
        var attack = spec.attack === undefined ? 0.004 : spec.attack;
        param.setValueAtTime(SILENCE, when);
        param.linearRampToValueAtTime(spec.vol, when + attack);
        param.exponentialRampToValueAtTime(SILENCE, when + attack + spec.dur);
    }

    function finish(source, spec, envelope, when) {
        var destination = spec.to || sfxBus;
        envelope.connect(destination);
        if (spec.wet && reverbInput) {
            var send = ctx.createGain();
            send.gain.value = spec.wet;
            envelope.connect(send);
            send.connect(reverbInput);
        }
        var attack = spec.attack === undefined ? 0.004 : spec.attack;
        voices++;
        source.onended = function () { voices--; };
        source.start(when);
        source.stop(when + attack + spec.dur + 0.05);
    }

    // Oscilador con barrido de tono. spec: { type, from, toHz, dur, vol,
    // attack, at, to, wet, tremolo: { rate, depth }, cutoff }
    function wave(spec) {
        if (voices >= MAX_VOICES) return;
        var when = ctx.currentTime + 0.005 + (spec.at || 0);
        var oscillator = ctx.createOscillator();
        oscillator.type = spec.type || 'sine';
        oscillator.frequency.setValueAtTime(spec.from, when);
        if (spec.toHz) oscillator.frequency.exponentialRampToValueAtTime(spec.toHz, when + spec.dur);
        var node = oscillator;

        if (spec.cutoff) {
            var filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(spec.cutoff, when);
            if (spec.cutoffEnd) filter.frequency.exponentialRampToValueAtTime(spec.cutoffEnd, when + spec.dur);
            node.connect(filter);
            node = filter;
        }
        if (spec.tremolo) {
            var wobble = ctx.createGain();
            var lfo = ctx.createOscillator();
            var depth = ctx.createGain();
            lfo.frequency.value = spec.tremolo.rate;
            depth.gain.value = spec.tremolo.depth;
            lfo.connect(depth);
            depth.connect(wobble.gain);
            lfo.start(when);
            lfo.stop(when + spec.dur + 0.1);
            node.connect(wobble);
            node = wobble;
        }
        var envelope = ctx.createGain();
        shapeEnvelope(envelope.gain, when, spec);
        node.connect(envelope);
        finish(oscillator, spec, envelope, when);
    }

    // Ruido filtrado. spec: { filter, freq, freqEnd, q, dur, vol, attack, at,
    // to, wet, pink }
    function noise(spec) {
        if (voices >= MAX_VOICES) return;
        var when = ctx.currentTime + 0.005 + (spec.at || 0);
        var source = ctx.createBufferSource();
        source.buffer = spec.pink ? pinkNoise : whiteNoise;
        source.loop = true;
        var filter = ctx.createBiquadFilter();
        filter.type = spec.filter || 'lowpass';
        filter.frequency.setValueAtTime(spec.freq, when);
        if (spec.freqEnd) filter.frequency.exponentialRampToValueAtTime(spec.freqEnd, when + spec.dur);
        filter.Q.value = spec.q || 0.8;
        var envelope = ctx.createGain();
        shapeEnvelope(envelope.gain, when, spec);
        source.connect(filter);
        filter.connect(envelope);
        finish(source, spec, envelope, when);
    }

    function notes(hzList, spacing, spec) {
        for (var i = 0; i < hzList.length; i++) {
            wave({
                type: spec.type, from: hzList[i], dur: spec.dur, vol: spec.vol,
                at: (spec.at || 0) + i * spacing, wet: spec.wet, to: spec.to
            });
        }
    }

    // ── Música ───────────────────────────────────────────────────────────────

    function musicNote(hz, when, spec) {
        var oscillator = ctx.createOscillator();
        oscillator.type = spec.type;
        oscillator.frequency.setValueAtTime(hz, when);
        if (spec.detune) oscillator.detune.value = spec.detune;
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(spec.cutoff, when);
        if (spec.cutoffEnd) filter.frequency.exponentialRampToValueAtTime(spec.cutoffEnd, when + spec.dur);
        var envelope = ctx.createGain();
        envelope.gain.setValueAtTime(SILENCE, when);
        envelope.gain.linearRampToValueAtTime(spec.vol, when + spec.attack);
        envelope.gain.exponentialRampToValueAtTime(SILENCE, when + spec.dur);
        oscillator.connect(filter);
        filter.connect(envelope);
        envelope.connect(spec.to || musicBus);
        oscillator.start(when);
        oscillator.stop(when + spec.dur + 0.05);
    }

    function drumNoise(when, filterType, freq, dur, vol) {
        var source = ctx.createBufferSource();
        source.buffer = whiteNoise;
        source.loop = true;
        var filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = freq;
        var envelope = ctx.createGain();
        envelope.gain.setValueAtTime(vol, when);
        envelope.gain.exponentialRampToValueAtTime(SILENCE, when + dur);
        source.connect(filter);
        filter.connect(envelope);
        envelope.connect(musicBus);
        source.start(when);
        source.stop(when + dur + 0.02);
    }

    function kick(when, vol) {
        var oscillator = ctx.createOscillator();
        oscillator.frequency.setValueAtTime(140, when);
        oscillator.frequency.exponentialRampToValueAtTime(42, when + 0.13);
        var envelope = ctx.createGain();
        envelope.gain.setValueAtTime(vol, when);
        envelope.gain.exponentialRampToValueAtTime(SILENCE, when + 0.2);
        oscillator.connect(envelope);
        envelope.connect(musicBus);
        oscillator.start(when);
        oscillator.stop(when + 0.22);
    }

    // Cada capa entra a partir de un nivel de intensidad: con la arena vacía
    // queda el colchón de acordes, y en plena oleada suena la batería entera.
    function scheduleStep(step, when) {
        var combat = music.scene === 'combat';
        var level = music.level;
        var inBar = step % STEPS_PER_BAR;
        var bar = Math.floor(step / STEPS_PER_BAR) % 4;
        var chord = CHORDS[(music.boss ? BOSS_PROGRESSION : PROGRESSION)[bar]];
        var barSeconds = STEP_SECONDS * STEPS_PER_BAR;

        if (inBar === 0) {
            for (var n = 1; n < chord.length; n++) {
                musicNote(midiToHz(chord[n]), when, {
                    type: 'sawtooth', detune: n % 2 ? 7 : -7, cutoff: 520, cutoffEnd: 900,
                    attack: barSeconds * 0.3, dur: barSeconds * 1.05, vol: 0.04
                });
            }
        }

        var arpEvery = combat && level > 0.2 ? 1 : 4;
        if (inBar % arpEvery === 0 && (combat || inBar % 4 === 0)) {
            var tone = chord[ARP_PATTERN[(step / arpEvery) % ARP_PATTERN.length | 0]] + 12;
            musicNote(midiToHz(tone), when, {
                type: 'square', cutoff: 2600, cutoffEnd: 700, attack: 0.005,
                dur: STEP_SECONDS * 1.6, vol: combat ? 0.022 + 0.02 * level : 0.016, to: arpEcho
            });
        }

        if (!combat) return;

        if (inBar % 2 === 0) {
            var octave = inBar % 8 === 6 ? 12 : 0;
            musicNote(midiToHz(chord[0] - 12 + octave), when, {
                type: 'sawtooth', cutoff: 420 + 500 * level, cutoffEnd: 140, attack: 0.006,
                dur: STEP_SECONDS * 1.8, vol: 0.11 + 0.07 * level
            });
        }
        if (level > 0.22 && inBar % 4 === 0) kick(when, 0.34 + 0.2 * level);
        if (level > 0.45 && inBar % 2 === 1) drumNoise(when, 'highpass', 7000, 0.035, 0.05 + 0.04 * level);
        if (level > 0.62 && (inBar === 4 || inBar === 12)) {
            drumNoise(when, 'bandpass', 1900, 0.13, 0.16);
            drumNoise(when, 'highpass', 5000, 0.07, 0.07);
        }
    }

    function heartbeat(when) {
        [0, 0.17].forEach(function (offset, index) {
            var oscillator = ctx.createOscillator();
            oscillator.frequency.setValueAtTime(index ? 58 : 66, when + offset);
            oscillator.frequency.exponentialRampToValueAtTime(36, when + offset + 0.12);
            var envelope = ctx.createGain();
            envelope.gain.setValueAtTime(index ? 0.32 : 0.42, when + offset);
            envelope.gain.exponentialRampToValueAtTime(SILENCE, when + offset + 0.16);
            oscillator.connect(envelope);
            envelope.connect(sfxBus);
            oscillator.start(when + offset);
            oscillator.stop(when + offset + 0.2);
        });
    }

    function tick() {
        if (!ready() || ctx.state !== 'running') return;
        var now = ctx.currentTime;
        // Pestaña en segundo plano: el temporizador se retrasa. Mejor saltar
        // al presente (sin perder el compás) que disparar de golpe todos los
        // pasos atrasados.
        if (music.nextTime < now) {
            var missed = Math.ceil((now - music.nextTime) / STEP_SECONDS);
            music.step += missed;
            music.nextTime += missed * STEP_SECONDS;
        }

        var playing = music.enabled && music.scene !== 'off';
        while (music.nextTime < now + LOOKAHEAD_SECONDS) {
            music.level += (music.target - music.level) * 0.07;
            if (playing) scheduleStep(music.step, music.nextTime);
            music.step++;
            music.nextTime += STEP_SECONDS;
        }

        if (music.lowHealth && now >= music.nextBeat) {
            heartbeat(now + 0.02);
            music.nextBeat = now + 0.82;
        }
    }

    function applyMusicVolume() {
        if (!musicBus) return;
        var target = !music.enabled ? 0 : (music.scene === 'combat' ? MUSIC_VOLUME : PAUSED_MUSIC_VOLUME);
        musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
    }

    // Rumor de ciudad: ruido grave que sube y baja muy despacio.
    function startAmbience() {
        var source = ctx.createBufferSource();
        source.buffer = pinkNoise;
        source.loop = true;
        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 240;
        filter.Q.value = 0.4;
        var level = ctx.createGain();
        level.gain.value = 0.05;
        var lfo = ctx.createOscillator();
        var depth = ctx.createGain();
        lfo.frequency.value = 0.07;
        depth.gain.value = 0.025;
        lfo.connect(depth);
        depth.connect(level.gain);
        source.connect(filter);
        filter.connect(level);
        level.connect(sfxBus);
        source.start();
        lfo.start();
    }

    // ── API: ciclo de vida y estado ──────────────────────────────────────────

    function init(context, destination) {
        if (!context || ctx) return;
        ctx = context;
        sfxBus = ctx.createGain();
        sfxBus.connect(destination || ctx.destination);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0;
        musicBus.connect(destination || ctx.destination);
        whiteNoise = makeNoise(false);
        pinkNoise = makeNoise(true);
        buildReverb();
        buildArpEcho();
        startAmbience();
        music.nextTime = ctx.currentTime + 0.1;
        music.timer = setInterval(tick, SCHEDULER_MS);
        applyMusicVolume();
    }

    function setMusicEnabled(enabled) {
        music.enabled = !!enabled;
        if (ready()) applyMusicVolume();
    }

    // 'menu' y 'paused' dejan solo el colchón y un arpegio lento; 'combat'
    // activa bajo y batería según la intensidad.
    function setScene(scene) {
        if (music.scene === scene) return;
        music.scene = scene;
        if (ready()) applyMusicVolume();
    }

    function setIntensity(value, isBoss) {
        music.target = Math.max(0, Math.min(1, value));
        music.boss = !!isBoss;
    }

    function setLowHealth(isLow) {
        music.lowHealth = !!isLow;
    }

    // ── API: jugador ─────────────────────────────────────────────────────────

    function footstep(isSprinting) {
        if (!ready()) return;
        stepToggle = !stepToggle;
        var pitch = stepToggle ? 1 : 0.86;
        noise({ pink: true, freq: 520 * pitch, freqEnd: 150, dur: 0.07, vol: isSprinting ? 0.5 : 0.36, attack: 0.002 });
        wave({ from: 92 * pitch, toHz: 55, dur: 0.06, vol: isSprinting ? 0.16 : 0.11 });
    }

    function jump() {
        if (!ready()) return;
        noise({ filter: 'bandpass', freq: 420, freqEnd: 1500, q: 1.2, dur: 0.16, vol: 0.14, attack: 0.03 });
    }

    function land(strength) {
        if (!ready()) return;
        var k = Math.max(0, Math.min(1, strength));
        wave({ from: 115, toHz: 42, dur: 0.15, vol: 0.2 + 0.3 * k });
        noise({ pink: true, freq: 700, freqEnd: 140, dur: 0.12, vol: 0.3 + 0.4 * k, attack: 0.002 });
    }

    function dash() {
        if (!ready()) return;
        noise({ filter: 'bandpass', freq: 320, freqEnd: 3000, q: 1.4, dur: 0.2, vol: 0.32, attack: 0.08, wet: 0.2 });
        noise({ filter: 'bandpass', freq: 2800, freqEnd: 500, q: 1.2, dur: 0.2, vol: 0.18, attack: 0.01, at: 0.16 });
        wave({ type: 'sawtooth', from: 170, toHz: 560, dur: 0.2, vol: 0.05, cutoff: 1400 });
    }

    function hurt() {
        if (!ready()) return;
        wave({ from: 185, toHz: 58, dur: 0.24, vol: 0.4 });
        noise({ freq: 1000, freqEnd: 180, dur: 0.13, vol: 0.28, attack: 0.002 });
        wave({ type: 'square', from: 880, toHz: 300, dur: 0.08, vol: 0.05 });
    }

    function playerDeath() {
        if (!ready()) return;
        wave({ type: 'sawtooth', from: 220, toHz: 32, dur: 1.2, vol: 0.28, cutoff: 1800, cutoffEnd: 120, wet: 0.5 });
        noise({ pink: true, freq: 1400, freqEnd: 60, dur: 1.1, vol: 0.5, wet: 0.5 });
        wave({ from: 70, toHz: 28, dur: 1.0, vol: 0.35 });
    }

    function headshot() {
        if (!ready()) return;
        wave({ from: 1320, dur: 0.28, vol: 0.2, wet: 0.35 });
        wave({ from: 1980, dur: 0.2, vol: 0.1, wet: 0.35 });
        wave({ from: 2640, dur: 0.12, vol: 0.06 });
        noise({ filter: 'highpass', freq: 5000, dur: 0.03, vol: 0.12, attack: 0.001 });
    }

    function equip() {
        if (!ready()) return;
        noise({ filter: 'bandpass', freq: 2100, q: 4, dur: 0.03, vol: 0.24, attack: 0.001 });
        wave({ type: 'square', from: 330, toHz: 220, dur: 0.04, vol: 0.07, at: 0.07 });
        noise({ filter: 'bandpass', freq: 1300, q: 3, dur: 0.04, vol: 0.2, attack: 0.001, at: 0.07 });
    }

    // ── API: enemigos ────────────────────────────────────────────────────────

    function enemySpawn(pan, distance) {
        if (!ready() || throttled('spawn', 70)) return;
        var out = place(pan, distance);
        wave({ from: 180, toHz: 1400, dur: 0.28, vol: 0.12, to: out, wet: 0.3 });
        wave({ type: 'triangle', from: 360, toHz: 2800, dur: 0.28, vol: 0.05, to: out });
    }

    function enemyHit(pan, distance) {
        if (!ready() || throttled('hit', 35)) return;
        var out = place(pan, distance * 0.5);
        wave({ type: 'square', from: 1500, toHz: 700, dur: 0.04, vol: 0.07, to: out });
        noise({ filter: 'bandpass', freq: 2400, q: 3, dur: 0.035, vol: 0.14, attack: 0.001, to: out });
    }

    var DEATH_RECIPES = {
        recluta: function (out) {
            wave({ type: 'sawtooth', from: 320, toHz: 50, dur: 0.45, vol: 0.2, cutoff: 1600, cutoffEnd: 200, to: out, wet: 0.25 });
            wave({ type: 'square', from: 640, toHz: 80, dur: 0.3, vol: 0.06, to: out });
            noise({ freq: 1500, freqEnd: 200, dur: 0.25, vol: 0.2, to: out });
        },
        chacal: function (out) {
            wave({ type: 'sawtooth', from: 950, toHz: 210, dur: 0.22, vol: 0.15, tremolo: { rate: 34, depth: 0.5 }, to: out, wet: 0.2 });
            wave({ type: 'square', from: 1500, toHz: 300, dur: 0.18, vol: 0.05, to: out });
            noise({ filter: 'bandpass', freq: 2600, freqEnd: 800, q: 2, dur: 0.12, vol: 0.14, to: out });
        },
        mastodonte: function (out) {
            wave({ type: 'sawtooth', from: 112, toHz: 28, dur: 0.9, vol: 0.34, cutoff: 700, cutoffEnd: 90, to: out, wet: 0.4 });
            wave({ from: 62, toHz: 30, dur: 0.7, vol: 0.34, to: out });
            noise({ pink: true, freq: 520, freqEnd: 60, dur: 0.8, vol: 0.6, to: out, wet: 0.3 });
        },
        zumbador: function (out) {
            wave({ type: 'square', from: 2100, toHz: 110, dur: 0.16, vol: 0.12, to: out });
        },
        coloso: function (out) {
            wave({ type: 'sawtooth', from: 165, toHz: 24, dur: 1.9, vol: 0.4, cutoff: 1200, cutoffEnd: 70, tremolo: { rate: 11, depth: 0.35 }, to: out, wet: 0.6 });
            noise({ pink: true, freq: 900, freqEnd: 50, dur: 1.7, vol: 0.7, to: out, wet: 0.5 });
            wave({ from: 55, toHz: 24, dur: 1.6, vol: 0.4, to: out });
            notes([392, 330, 262, 196], 0.22, { type: 'triangle', dur: 0.5, vol: 0.12, at: 0.2, wet: 0.6 });
        }
    };

    function enemyDeath(key, pan, distance) {
        if (!ready() || throttled('death:' + key, 50)) return;
        (DEATH_RECIPES[key] || DEATH_RECIPES.recluta)(place(pan, distance));
    }

    function enemyAttack(key, pan, distance) {
        if (!ready()) return;
        var out = place(pan, distance);
        var isHeavy = key === 'mastodonte' || key === 'coloso';
        noise({ filter: 'bandpass', freq: 1300, freqEnd: 300, q: 1.4, dur: 0.13, vol: 0.26, attack: 0.02, to: out });
        if (isHeavy) wave({ from: 82, toHz: 34, dur: 0.28, vol: 0.42, to: out });
    }

    var VOICE_RECIPES = {
        recluta: function (out) {
            wave({ type: 'square', from: 700, toHz: 900, dur: 0.05, vol: 0.05, to: out });
            wave({ type: 'square', from: 500, toHz: 650, dur: 0.05, vol: 0.05, at: 0.08, to: out });
        },
        chacal: function (out) {
            for (var i = 0; i < 3; i++) {
                wave({ type: 'sawtooth', from: 1100, toHz: 1550, dur: 0.03, vol: 0.06, at: i * 0.05, to: out });
            }
        },
        mastodonte: function (out) {
            wave({ type: 'sawtooth', from: 62, toHz: 46, dur: 0.55, vol: 0.2, cutoff: 500, tremolo: { rate: 22, depth: 0.5 }, to: out });
            noise({ pink: true, freq: 220, dur: 0.5, vol: 0.2, attack: 0.1, to: out });
        },
        zumbador: function (out) {
            wave({ type: 'sawtooth', from: 138, toHz: 152, dur: 0.34, vol: 0.12, cutoff: 1800, tremolo: { rate: 38, depth: 0.8 }, to: out });
            wave({ type: 'square', from: 276, toHz: 304, dur: 0.34, vol: 0.03, tremolo: { rate: 38, depth: 0.8 }, to: out });
        },
        coloso: function (out) {
            wave({ type: 'sawtooth', from: 92, toHz: 54, dur: 1.0, vol: 0.28, cutoff: 900, tremolo: { rate: 14, depth: 0.45 }, to: out, wet: 0.5 });
            noise({ pink: true, freq: 420, dur: 0.9, vol: 0.35, attack: 0.15, to: out, wet: 0.4 });
        }
    };

    function enemyVoice(key, pan, distance) {
        if (!ready() || throttled('voice:' + key, 180)) return;
        (VOICE_RECIPES[key] || VOICE_RECIPES.recluta)(place(pan, distance));
    }

    // ── API: recogibles, oleadas e interfaz ──────────────────────────────────

    function pickup(kind) {
        if (!ready()) return;
        if (kind === 'heal') {
            notes([523, 659, 784, 1047], 0.07, { type: 'triangle', dur: 0.2, vol: 0.14, wet: 0.4 });
        } else if (kind === 'star') {
            notes([784, 988, 1175, 1568, 1976, 2349], 0.055, { type: 'triangle', dur: 0.22, vol: 0.12, wet: 0.5 });
            noise({ filter: 'highpass', freq: 6000, dur: 0.5, vol: 0.05, attack: 0.05 });
        } else {
            wave({ type: 'sawtooth', from: 200, toHz: 820, dur: 0.24, vol: 0.1, cutoff: 2400, wet: 0.3 });
            notes([660, 990], 0.1, { type: 'square', dur: 0.16, vol: 0.06, at: 0.16, wet: 0.3 });
        }
    }

    function waveStart(isBoss) {
        if (!ready()) return;
        if (isBoss) {
            [55, 55.6, 82.4].forEach(function (hz) {
                wave({ type: 'sawtooth', from: hz, dur: 1.7, vol: 0.2, attack: 0.25, cutoff: 220, cutoffEnd: 1000, wet: 0.6 });
            });
            wave({ from: 41, dur: 2.0, vol: 0.3, attack: 0.2 });
            wave({ type: 'sawtooth', from: 51.9, dur: 1.4, vol: 0.2, attack: 0.1, cutoff: 600, at: 1.0, wet: 0.6 });
            return;
        }
        [220, 330, 440].forEach(function (hz) {
            wave({ type: 'sawtooth', from: hz, dur: 0.7, vol: 0.09, attack: 0.03, cutoff: 500, cutoffEnd: 2600, wet: 0.4 });
        });
        noise({ filter: 'bandpass', freq: 400, freqEnd: 3200, q: 1.5, dur: 0.5, vol: 0.08, attack: 0.35 });
    }

    function waveClear() {
        if (!ready()) return;
        notes([440, 554, 659, 880], 0.09, { type: 'triangle', dur: 0.35, vol: 0.13, wet: 0.5 });
        wave({ from: 110, toHz: 55, dur: 0.3, vol: 0.2 });
    }

    function victory() {
        if (!ready()) return;
        notes([523, 659, 784, 1047, 1319], 0.13, { type: 'triangle', dur: 0.5, vol: 0.14, wet: 0.6 });
        [262, 330, 392].forEach(function (hz) {
            wave({ type: 'sawtooth', from: hz, dur: 1.2, vol: 0.07, attack: 0.05, cutoff: 1800, at: 0.65, wet: 0.5 });
        });
    }

    function ui(kind) {
        if (!ready()) return;
        if (kind === 'buy') {
            notes([1319, 1976], 0.08, { type: 'triangle', dur: 0.3, vol: 0.14, wet: 0.3 });
            noise({ filter: 'highpass', freq: 6500, dur: 0.05, vol: 0.06, attack: 0.001 });
        } else if (kind === 'deny') {
            wave({ type: 'square', from: 180, toHz: 140, dur: 0.12, vol: 0.07 });
        } else {
            wave({ from: 600, toHz: 800, dur: 0.07, vol: 0.08 });
        }
    }

    window.GameAudio = {
        init: init,
        setMusicEnabled: setMusicEnabled,
        setScene: setScene,
        setIntensity: setIntensity,
        setLowHealth: setLowHealth,
        footstep: footstep,
        jump: jump,
        land: land,
        dash: dash,
        hurt: hurt,
        playerDeath: playerDeath,
        headshot: headshot,
        equip: equip,
        enemySpawn: enemySpawn,
        enemyHit: enemyHit,
        enemyDeath: enemyDeath,
        enemyAttack: enemyAttack,
        enemyVoice: enemyVoice,
        pickup: pickup,
        waveStart: waveStart,
        waveClear: waveClear,
        victory: victory,
        ui: ui
    };

})();
