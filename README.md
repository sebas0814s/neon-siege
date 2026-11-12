# NEON SIEGE · 3D Browser FPS

<div align="center">

![Game Banner](https://img.shields.io/badge/NEON%20SIEGE-3D%20SHOOTER-00ffcc?style=for-the-badge&labelColor=0a0a1e&color=00ffcc)
&nbsp;
![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=threedotjs&logoColor=white)
&nbsp;
![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
&nbsp;
![HTML5](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)

**A browser-based 3D wave survival FPS with cyberpunk aesthetics, built entirely from scratch with Three.js and vanilla JavaScript. No game engine. No framework. Just raw browser tech.**

[▶ Play Now](#) · [📱 Mobile Branch](#mobile-version) · [🐛 Report Bug](../../issues)

---

</div>

## ✦ What is Neon Siege?

Neon Siege is a **first-person wave survival shooter** that runs entirely in the browser — no download, no installation. Built with Three.js as the only external dependency, it delivers a full 3D game loop with real-time rendering, spatial audio, enemy AI, progression systems, and two distinct game modes.

The project started as an MVP to validate a single question: **can a game feel genuinely addictive using only browser APIs?**

The answer, after multiple iterations on game feel, feedback systems, and mechanics: yes.

---

## 🎮 Game Modes

### 🌊 Wave Survival
The classic endless arena. Survive increasingly brutal waves of enemies, earn cash for each kill, and spend it at the armory between rounds.

- Enemies grow faster and tankier each wave
- 4 difficulty levels with distinct stats (health drops, starting money, enemy damage)
- Procedural health pickup drops from fallen enemies
- No ceiling — see how far you can go

### 🔫 Gun Game
A pure skill test. Start with a baseball bat. Every kill gives you the next weapon. Reach the **Golden Gun** and land one final shot to win.

| # | Weapon | Flavor |
|---|--------|--------|
| 1 | 🪃 Bate | One swing, one prayer |
| 2 | 🔫 Pistola | Classic starter |
| 3 | 🔫 Revólver | High risk, high reward |
| 4 | ⚡ SMG | Spray and pray |
| 5 | 🎯 Rifle AR | Balanced aggression |
| 6 | 💥 Escopeta | Lethal at close range |
| 7 | 🔭 Francotirador | One shot, maybe |
| 8 | 🌀 Minigun | Chaos |
| 9 | 🚀 Lanzacohetes | Overkill |
| 10 | ⭐ Pistola Dorada | Glory or bust |

---

## 👾 Roster de enemigos

Cinco arquetipos que se leen por silueta y color antes de entrar en rango. Los multiplicadores se aplican sobre la curva de oleada y la dificultad, así que el balance global sigue viviendo en un solo sitio.

| Arquetipo | Vida | Vel | Daño | $ | Qué te obliga a hacer |
|-----------|------|-----|------|---|------------------------|
| **Recluta** | ×1.0 | ×1.0 | ×1.0 | 200 | Nada: es la vara de medir |
| **Chacal** | ×0.45 | ×1.95 | ×0.6 | 260 | Orbita mientras cierra: seguirlo con la mira |
| **Mastodonte** | ×3.2 | ×0.55 | ×1.9 | 420 | Gastar cargador o esquivar con dash |
| **Zumbador** | ×0.8 | ×1.3 | ×1.0 | 300 | Matarlo lejos: explota (radio 7, 18 de daño) |
| **Coloso** (jefe) | ×14 | ×0.85 | ×2.4 | 1500 | Aparece cada 5 oleadas, con barra de vida propia |

**Composición:** oleadas 1-2 solo Recluta · Chacal desde la 3 · Mastodonte desde la 4 · Zumbador desde la 5 · desde la 8 el Chacal domina · jefe en cada múltiplo de 5.

**Reglas de oleada:** cada tres oleadas (nunca en la de jefe) entra un modificador — `JAURÍA` (solo Chacales), `NIEBLA DENSA` (visibilidad reducida) o `SIN SUMINISTROS` (no caen botiquines).

---

## 🔧 Armería y power-ups

Cinco armas en Oleadas (Pistol, Rifle, Shotgun, SMG, Sniper) más cuatro líneas de mejora permanentes que valen para todas:

| Mejora | Efecto por nivel | Niveles |
|--------|------------------|---------|
| Cargador | +30% balas por cargador | 4 |
| Recarga | −15% tiempo de recarga | 4 |
| Daño | +15% daño de arma | 4 |
| Velocidad | +8% velocidad al correr | 3 |

Además de la estrella hay dos power-ups que caen de las bajas: **munición infinita** (9s, sin recargas) y **cámara lenta** (7s, los enemigos van al 40% — el jugador no).

---

## ⚡ Core Features

| Feature | Description |
|---------|-------------|
| **Screen Shake** | Per-weapon recoil with exponential decay — shotgun punches, rifle taps |
| **⭐ Star Power-Up** | Golden sphere pickup — 8s of invulnerability + 1.75× speed + golden border flash |
| **Headshots** | 2.5× damage multiplier on head collisions via raycasting |
| **Minimap** | Real-time radar with enemy dots, health pickups (✚) and star location (★) |
| **Weapon Kick** | View model recoil animation per shot |
| **Dash (E)** | 5-second cooldown dash with animated cooldown bar |
| **Procedural Audio** | All sounds synthesized via Web Audio API — zero audio files |
| **Difficulty System** | 4 tiers affecting enemy HP, speed, damage, health drop rate, and starting cash |
| **Persistent Stats** | Best wave, total kills, games played, time played — stored in localStorage |

---

## 🕹️ Controls

| Input | Action |
|-------|--------|
| `W A S D` | Move |
| `Mouse` | Aim |
| `Left Click` | Shoot |
| `R` | Reload |
| `Space` | Jump |
| `E` | Dash |
| `1` … `5` | Cambiar arma |
| `B` | Open armory (Wave mode) |
| `ESC` | Pause |

---

## 🏗️ How It Was Built

### Architecture

The game is a **single-script monolith** (`game.js`) structured into clearly separated sections, each responsible for one concern. No bundler, no transpiler — just a browser loading one JavaScript file.

```
game.js
 ├── CONFIG          → Weapon stats, map constants, difficulty tables
 ├── SETTINGS        → Player preferences (localStorage)
 ├── STATS           → Session statistics (localStorage)
 ├── STATE           → Shared mutable game state object
 ├── AUDIO           → Procedural synthesis via Web Audio API
 ├── SCENE           → Three.js setup: renderer, camera, lighting, ground
 ├── PLAYER          → Movement, jumping, dash, weapon model, arm bob
 ├── SCREEN SHAKE    → Camera shake with per-weapon intensity + decay
 ├── UI              → HUD, minimap, shop, wave announcements, menus
 ├── ENEMIES         → Spawn, AI (seek + melee), wave config, GG continuous spawn
 ├── HEALTH PICKUPS  → Drop system, animate, proximity pickup
 ├── STAR PICKUP     → 3D golden sphere, invulnerability + speed power-up
 ├── COMBAT          → Raycasting, hit detection, damage, gun game progression
 └── GAME LOOP       → requestAnimationFrame, delta time, menu camera orbit
```

### Core Game Loop

Every frame runs on `requestAnimationFrame` with capped delta time (`Math.min(delta, 0.05)`) to prevent physics tunneling on slow machines:

```
frame
 ├── applyPhysics(delta)      → gravity, jump velocity
 ├── applyShake()             → camera shake with decay
 ├── handleMovement(delta)    → WASD + star speed boost
 ├── updateEnemyAI(delta)     → seek player, animate legs, melee attack
 ├── updateStarPickup(delta)  → animate 3D star, proximity check, auto-spawn
 ├── tickStarPower()          → countdown invulnerability, update HUD bar
 ├── updateHealthPickups(delta) → animate, pickup, despawn
 ├── tickGunGameSpawn(delta)  → maintain 5 enemies alive (Gun Game only)
 └── render                  → Three.js scene render
```

### Rendering

- **Renderer:** `THREE.WebGLRenderer` with hardware shadows (`PCFSoftShadowMap`)
- **Camera:** FPS perspective camera added to `scene` so its children (arms, weapon model, muzzle flash) render correctly in view space
- **Enemy models:** Procedural articulated androids (`js/enemy-models.js`) — hips, torso, head, shoulders, elbows and knees, one merged vertex-coloured geometry per limb, 10 meshes and a single material per enemy
- **Hit detection:** `THREE.Raycaster` from screen center — checks against enemy geometry with per-part damage multipliers (`head: 2.5×`, `torso: 1×`, `legs: 0.7×`)

### Audio Design

Zero audio files. All sounds are synthesized at runtime using the Web Audio API:

```javascript
// Every sound is a tone() call with oscillator type, frequency sweep, volume, duration
function playShootSound(id) { tone('sawtooth', freq[id], 80, 0.28, 0.18); }
function playStarSound()    { /* 3-note ascending arpeggio */ }
function playGGWinSound()   { /* 4-chord fanfare */ }
```

### Screen Shake System

Shake is accumulated per trigger (`Math.max` ensures bigger shake wins) and applied as a random offset on `camera.rotation.y/x` each frame, decaying by `0.72×` per frame:

```javascript
// Weapon shake intensities
{ pistol: 0.008, rifle: 0.005, shotgun: 0.026, gg_rpg: 0.05, gg_golden: 0.04 }
// Damage shake
triggerShake(0.042);
```

### Star Power-Up

The star is a `THREE.Group` containing:
- A metallic golden `SphereGeometry` with emissive material
- A `TorusGeometry` ring that orbits on a tilted axis
- A `PointLight` that casts the golden glow on nearby surfaces

Auto-spawns every 60 seconds if no star is on the map. Also drops with 15–20% chance on enemy kill.

---

## 📱 Mobile Version

A dedicated branch `mobile/android` contains the mobile adaptation of Neon Siege using **Capacitor** to compile as a native Android APK.

### Mobile-Specific Changes
- **Virtual joystick** (left thumb) for movement
- **Tap-to-shoot** button (right thumb)
- **Gyroscope aiming** option
- Touch-optimized HUD (larger elements, repositioned)
- Landscape-locked orientation
- Reduced render resolution for performance on mid-range devices

> See [`mobile/android` branch](../../tree/mobile/android) for setup and build instructions.

---

## 🎬 Personajes, escenario y sonido

Tres módulos opcionales que `game.js` usa si están cargados (sin ellos el juego vuelve al muñeco, el cielo plano y los pitidos de antes):

| Módulo | Qué aporta |
|--------|------------|
| `js/enemy-models.js` | Un modelo articulado por arquetipo (porra del Recluta, cuchillas y hocico del Chacal, puños del Mastodonte, núcleo que late del Zumbador, corona y mazo del Coloso). Animaciones de aparición, marcha, ataque, impacto y muerte: caen en la dirección del disparo y un tiro a la cabeza se la arranca. |
| `js/world-fx.js` | Cielo con aurora, estrellas y luna; ventanas encendidas y tráfico aéreo en el horizonte; paneles en las coberturas; pulso de energía en el suelo; balizas en las torres; barrera en el borde del mapa; polvo en suspensión; chispas y ondas para muertes, explosiones y recogibles. |
| `js/game-audio.js` | Música sintetizada que suma capas (bajo, bombo, platos, caja) según los enemigos vivos, pasos, salto, dash, voces y muertes por arquetipo con paneo estéreo, latido con poca vida. Se apaga en Ajustes → Música. |

Además: manos y animación de recarga en el arma, balanceo al girar, campo de visión que se abre al correr y en el dash, inclinación al moverse de lado, cámara que cae al morir y números de daño sobre los enemigos (`css/game-fx.css`).

En el preset **Rendimiento** se apagan el pulso del suelo, el polvo y los focos del cielo.

---

## 🎚 Rendimiento

El juego trae tres presets de calidad (Ajustes → Calidad gráfica), aplicables en caliente salvo el antialiasing:

| Preset | Escala de render | AA | Sombras | Luces de arena |
|--------|------------------|----|---------|----------------|
| Rendimiento | 0.75× | no | no | no |
| Medio (por defecto) | 1.0× | no | sí (1024) | sí |
| Alto | 1.0× (hasta 2× DPR) | sí | sí (2048) | sí |

Decisiones que sostienen el framerate: renderer con `powerPreference: 'high-performance'`, materiales Lambert en vez de PBR, geometrías y materiales compartidos por arquetipo, el horizonte entero en un `InstancedMesh` (1 draw call para 150 edificios), HUD con caché de nodos y escritura solo cuando el valor cambia, minimapa a 30 Hz y screen shake con decaimiento por segundo (no por frame). Arena vacía ≈ 60 draw calls; cada enemigo suma 10 (12 con sombras).

Hay un contador de FPS activable en Ajustes.

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Rendering | [Three.js r128](https://threejs.org/) |
| Language | Vanilla JavaScript (ES5 compatible) |
| Audio | Web Audio API (procedural synthesis) |
| Physics | Custom (gravity, AABB clamping, raycasting) |
| Storage | localStorage (settings, statistics) |
| Mobile | Capacitor + Android SDK |
| Hosting | Any static file server or CDN |

---

## 🗺️ Roadmap

- [x] Roster de enemigos con arquetipos y jefe
- [x] Identidad visual (logotipo, tipografía de display, iconografía del HUD)
- [x] Mundo con cielo, horizonte y trazado de arena
- [x] Mejoras de armería, dos armas más, power-ups y reglas de oleada
- [x] Tutorial dentro del juego, pantalla de muerte con récord, puntería y racha
- [x] Personajes articulados y animados, escenario vivo y banda sonora sintetizada
- [ ] Mobile APK (in progress — `mobile/android` branch)
- [ ] Character models via Blender + Mixamo pipeline
- [ ] Multiplayer (WebSocket / WebRTC)
- [ ] Additional game modes (Deathmatch, King of the Hill)
- [ ] Unity port for full release

---

## 👤 Author

Built by **[@sebas0814s](https://github.com/sebas0814s)** · MVP-first approach · Browser → Mobile → Engine

---

<div align="center">

*"No estoy haciendo código. Estoy diseñando una experiencia que alguien va a querer repetir."*

</div>
