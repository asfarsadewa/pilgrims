# PILGRIMS

> You don't control the pilgrims. You control what they follow.

A small deterministic puzzle game built with **TypeScript + Three.js**, playable in any
modern browser and deployable as a Cloudflare Worker (static assets).

Move the Shrine. Every pilgrim walks toward it according to simple, visible rules. Guide
them around walls, past hazards and into exits — or watch them walk into the dark.

---

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move Shrine | Arrow keys / WASD | Swipe or on-screen d-pad |
| Wait | Space | Centre d-pad button |
| Undo | `Z` / `Ctrl+Z` | Undo button |
| Restart | `R` | Restart button |
| Menu / pause | `Esc` | Menu button |
| Mute | `M` | Sound button |

The prototype campaign has **10 handcrafted levels**. Progress and best move counts are
saved to `localStorage`.

### Camera views

The board can be viewed from three angles, selectable on the opening screen or in the
pause menu, and remembered between sessions:

| View | Pitch | Feel |
| --- | --- | --- |
| **Diorama** (default) | ~35° | low tabletop miniature |
| Classic | ~48° | the original raised angle |
| Elevated | ~58° | higher, clearest read of the whole board |

Only the pitch changes between views, so the grid orientation stays consistent.

---

## Core rules

1. Each input resolves exactly one turn.
2. The Shrine moves one orthogonal tile (never into walls, void, hazards or pilgrims).
3. Every pilgrim then moves one tile toward the Shrine:
   - it waits if it is orthogonally adjacent to the Shrine (the Shrine is also a roadblock);
   - it prefers the axis with the greater remaining distance (ties favour horizontal);
   - it falls back to the other axis if the preferred tile is blocked;
   - otherwise it waits.
4. Pilgrims decide **simultaneously**. Two pilgrims targeting the same tile both stay.
   Chains follow only when the leader actually moves. Swapping is forbidden.
5. Entering an exit removes a pilgrim. Entering a hazard loses one — you may undo freely.
6. The level is solved when every pilgrim has exited.

The simulation is fully deterministic: same board + same Shrine move = same result.

---

## Architecture

The puzzle engine has **no dependency on Three.js**. It is plain, testable TypeScript:

```text
input → simulation → GameState → renderer → Three.js
```

```text
src/
├── game/          pure simulation (types, movement, collisions, turn resolution, undo)
├── world/         board, tiles, level format + loader
├── entities/      simulation-side entity types
├── rendering/     Three.js only: board, entities, camera, animation, effects, themes
├── input/         keyboard, swipe, d-pad
├── audio/         procedural Web Audio (no assets)
├── ui/            HUD, overlays, level select, save data
└── levels/        handcrafted JSON levels 001–010
```

Animations never drive the simulation: a turn is resolved instantly, then the renderer
interpolates from the previous snapshot to the next one.

---

## Opening screen

Launching the game shows a sparse, meditative title: **three travellers** crossing the
dark toward a distant AI-authored **wayside monument**, one of them carrying a small
flickering lantern. The camera drifts on a very slow orbit through the fog, and the UI is
deliberately minimal — a wordmark, a hairline rule, one sentence and a single way forward —
revealed on a slow stagger.

The monument is the high-quality successor to the original "block glyph": a carved menhir
with a suspended block glyph, produced through the same image → Hunyuan → Blender pipeline
as the pilgrim and shrine. The travellers are individual skinned clones of the rigged
pilgrim, each with its own `idle` playback offset, and the lantern is a small procedural
prop with a warm point light.

---

## Asset pipeline

The game ships no hand-drawn art and no recorded audio. Everything is generated from
code and reproducible:

```text
Blender (procedural bmesh)      Lyria 3.5 (Gemini API)
        │                                │
   .glb models                       .mp3 music
```

### Models

The shipped pilgrim and shrine are **AI-generated**: a reference image from
`gpt-image-2.5-sunburst`, reconstructed with **fal Hunyuan 3D 3.1 Pro**, then
prepared and rigged in Blender.

```text
gpt-image-2.5-sunburst  →  fal Hunyuan 3D 3.1 Pro  →  Blender prep/rig  →  public/models
```

Reference images live in `output/imagegen/`; the raw provider GLBs and review
renders live under `output/3d/<name>-<timestamp>/`. The prep script
(`tools/blender/prepare_ai_models.py`) bakes orientation, centres and grounds
the mesh, scales it, decimates to a game budget, builds an armature with skin
weights, authors `idle` + `walk` clips, and exports a self-contained GLB.

| File | Source | Notes |
| --- | --- | --- |
| `pilgrim.glb` | AI image → Hunyuan → rig | 14k tris, 14-bone rig, `idle` + `walk` clips |
| `shrine.glb` | AI image → Hunyuan | 18k tris, textured |
| `title.glb` | AI image → Hunyuan | 16k tris, the opening-screen monument |
| `props.glb` | procedural Blender | trees, rocks, grass, pillar |
| `procedural/*` | procedural Blender | fallbacks, not loaded by default |

```bash
npm run models      # regenerate props + procedural fallbacks (Blender)
npm run og          # regenerate the social card and app icons
```

The AI steps are run with the Codex skills' bundled helpers (they read
`OPENAI_API_KEY` and `FAL_AI_KEY` from the environment):

```bash
# 1. reference images (gpt-image-2.5-sunburst)
python "$CODEX_HOME/skills/.system/imagegen/scripts/image_gen.py" generate \
  --model gpt-image-2.5-sunburst --prompt "..." --size 1024x1536 --quality xhigh \
  --background transparent --output-format png --out output/imagegen/pilgrim-front.png

# 2. image -> 3D (fal Hunyuan 3.1 Pro), resumable
python "$CODEX_HOME/skills/image-to-3d/scripts/hunyuan_3d.py" generate \
  --image output/3d/refs/pilgrim-front.png --name pilgrim --out-dir output/3d

# 3. prepare + rig in Blender
blender --background --factory-startup --python tools/blender/prepare_ai_models.py -- \
  --kind pilgrim --input output/3d/<run>/model.glb --out public/models/pilgrim.glb \
  --height 0.82 --tris 14000 --yaw 90 --rig
```

Facing was determined automatically by comparing the reference silhouette with
orthographic review renders; the pilgrim's front is `+X`, matching the
renderer's `setFacing()` convention.

### Procedural fallback models

```bash
npm run models      # requires Blender 5.x on PATH (or the blender-mcp install)
```

`tools/blender/build_models.py` builds and exports, with named parts so the renderer can
animate them:

| File | Parts |
| --- | --- |
| `pilgrim.glb` | `LegL/LegR`, `ArmL/ArmR`, `HandL/HandR`, `Cloak`, `Hood`, `Belt`, `Scarf`, `Head`, `Staff` |
| `shrine.glb` | `ShrineBase`, `ShrineBody`, `ShrineRunes`, `ShrineRoof`, `ShrineOrb` |
| `props.glb` | `TreeA/B/C`, `RockA/B/C`, `GrassA`, `PillarA` |
| `title.glb` | `TitlePedestal`, `TitleRing`, `TitleMonoliths`, `TitleGlyph`, `TitleCore` |

Pilgrim limbs pivot at the hip/shoulder so the runtime walk cycle reads correctly.

### Music

```bash
npm run music       # requires GEMINI_API_KEY; skips existing tracks
```

`tools/generate_music.mjs` calls Lyria 3.5 through the Gemini Interactions API
(`POST /v1beta/interactions`) and writes looping, instrumental tracks to
`public/audio/`: `title.mp3`, `pilgrimage.mp3`, `night.mp3`. Tracks stream lazily and
crossfade by scene; audio starts on the first user gesture (browser autoplay rules).

---

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # typecheck + production build into dist/
npm run test       # unit tests for the simulation
npm run solve      # BFS-verify every level is solvable
npm run models     # regenerate props + procedural fallbacks (Blender)
npm run og         # regenerate the social card + icons
npm run music      # regenerate the Lyria 3.5 soundtrack
npm run preview    # serve the production build locally
npm run smoke      # headless Chrome smoke test (needs a preview server running)
npm run deploy     # build + deploy to Cloudflare Workers
```

### Level format

```json
{
  "id": "001",
  "name": "Follow",
  "theme": "road",
  "par": 3,
  "width": 7,
  "height": 7,
  "map": [
    "#######",
    "#.....#",
    "#..E..#",
    "#.....#",
    "#..S..#",
    "#..P..#",
    "#######"
  ]
}
```

Legend: `#` wall · `.` floor · `~` void · `E` exit · `X` hazard · `P` pilgrim · `S` shrine.

Themes: `road`, `river`, `mountain`, `snow`, `ruins`, `night`.

Add a level by dropping a JSON file into `src/levels/` and registering it in
`src/levels/index.ts`. `npm run solve` proves it is solvable and reports the minimum
move count, which is a good value for `par`.

---

## Deployment

The build is a static site served by a Cloudflare Worker using the static-assets
binding (`wrangler.jsonc`). The Worker has no server logic. It is served on the custom
domain **https://pilgrims.asfarlab.fun/** (with the workers.dev URL as a fallback).

```bash
npm run deploy
```

`wrangler` must be authenticated (`npx wrangler whoami`). To try a version without
promoting it to production:

```bash
npm run deploy:preview
```

---

## Testing

Because the simulation is independent of Three.js, the deterministic core is fully
covered by `npm test`:

- `tests/simulation.test.ts` — movement, collisions, terrain, exits, hazards, undo snapshots.
- `tests/determinism.test.ts` — purity (identical input → identical state, no `Math.random`
  or clock use, no input mutation), order-independent collision resolution, stable state
  signatures, and a stable minimum solution whose replay solves every campaign level.

`npm run solve` additionally proves each level solvable and reports its minimum move count.

---

## Scope

Prototype scope is deliberately tiny: Shrine movement, normal pilgrims, walls, floors,
void, hazards, exits, multiple pilgrims, collision, unlimited undo, restart and level
progression. Everything else in the design document is intentionally not built yet.
