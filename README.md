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
| `1 / 2 / 3` | Switch weapon |
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
- **Enemy models:** Procedural humanoid meshes (sphere head + box torso + box legs) with walking animation via sine wave on leg rotation
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
