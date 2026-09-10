# PILGRIMS

> You don't control the pilgrims.  
> You control what they follow.

A small deterministic puzzle game built with **TypeScript + Three.js**.

---

## 1. High Concept

**Pilgrims** is a grid-based puzzle game where the player does not directly control the characters.

Instead, the player controls a **Shrine**.

Every pilgrim automatically moves toward the Shrine according to simple deterministic rules.

The player must reposition the Shrine to guide pilgrims through obstacles, hazards, gates, bridges, and eventually to safety.

The basic loop is:

```text
Move Shrine
    ↓
Pilgrims decide
    ↓
Pilgrims move
    ↓
World reacts
    ↓
Solve / Undo / Continue
```

The player manipulates **intent**, not units.

---

# 2. Design Pillars

The game should be:

- deterministic
- immediately readable
- playable entirely with four directional inputs
- based on small handcrafted levels
- forgiving through unlimited undo
- visually atmospheric without becoming technically heavy
- increasingly cruel through combinations of simple rules

A player should understand the fundamental mechanic within 30 seconds.

A later puzzle should still be capable of making them stare at a 9×9 board for twenty minutes.

---

# 3. Scope

This is intentionally a **small game**.

Initial commercial target:

```text
40–60 handcrafted levels
```

Prototype target:

```text
10 levels
```

No procedural generation is required.

No combat.

No inventory.

No dialogue system.

No character statistics.

No pathfinding AI beyond simple deterministic movement.

No open world.

No scrolling maps.

---

# 4. Technology

Recommended stack:

```text
TypeScript
Three.js
Vite
HTML / CSS
Web Audio API
JSON level definitions
```

Optional later additions:

```text
Howler.js        - audio management
Tauri            - desktop packaging
Electron         - alternative desktop packaging
Steamworks SDK   - Steam integration
```

The actual puzzle engine must **not depend on Three.js**.

Three.js is the renderer.

The simulation is plain TypeScript.

Architecture:

```text
INPUT
  ↓
SIMULATION
  ↓
BOARD STATE
  ↓
RENDERER
  ↓
THREE.JS
```

This separation is important.

---

# 5. Architectural Principle

The core game should theoretically be playable without rendering anything.

For example:

```ts
const nextState = resolveTurn(currentState, Direction.Left);
```

should be enough to calculate the entire next turn.

Three.js should then simply animate:

```text
currentState
    ↓
nextState
```

This provides:

- deterministic behaviour
- trivial undo
- easy testing
- easy replay
- easier level validation
- potential solver support
- renderer independence

---

# 6. Project Structure

Suggested layout:

```text
src/
│
├── main.ts
│
├── game/
│   ├── Game.ts
│   ├── GameState.ts
│   ├── TurnResolver.ts
│   ├── Movement.ts
│   ├── CollisionResolver.ts
│   ├── WinCondition.ts
│   └── UndoManager.ts
│
├── entities/
│   ├── Pilgrim.ts
│   ├── Shrine.ts
│   └── Entity.ts
│
├── world/
│   ├── Board.ts
│   ├── Tile.ts
│   ├── Level.ts
│   └── LevelLoader.ts
│
├── rendering/
│   ├── Renderer.ts
│   ├── SceneBuilder.ts
│   ├── CameraController.ts
│   ├── BoardRenderer.ts
│   ├── EntityRenderer.ts
│   ├── AnimationManager.ts
│   └── Effects.ts
│
├── input/
│   └── InputManager.ts
│
├── audio/
│   └── AudioManager.ts
│
├── ui/
│   ├── UI.ts
│   ├── LevelComplete.ts
│   └── LevelSelect.ts
│
└── levels/
    ├── 001.json
    ├── 002.json
    └── ...
```

Keep simulation classes ignorant of Three.js.

This is desirable:

```ts
interface Position {
    x: number;
    y: number;
}
```

Not:

```ts
THREE.Vector3
```

inside game logic.

---

# 7. Coordinate System

Game simulation uses a 2D integer grid:

```text
x = horizontal
y = vertical
```

Example:

```ts
interface GridPosition {
    x: number;
    y: number;
}
```

Rendering converts that into world coordinates.

Example:

```ts
worldX = gridX * TILE_SIZE;
worldZ = gridY * TILE_SIZE;
```

Y in Three.js is reserved for height.

Therefore:

```text
Game X → World X
Game Y → World Z
Height → World Y
```

---

# 8. Board

Typical board sizes:

```text
7×7
9×9
11×11
```

Rare maximum:

```text
15×15
```

The entire puzzle should normally remain visible.

No camera scrolling should be necessary.

---

# 9. Camera

Recommended:

**Orthographic camera.**

Something similar to:

```text
      camera
        \
         \
          board
```

Use a slightly elevated pseudo-isometric angle.

Example visual target:

```text
           ▲
         Shrine

    Pilgrim      Wall

        stone path

       dark void
```

The board should look like a small physical diorama.

Avoid unrestricted camera rotation.

The puzzle's spatial relationships must remain immediately understandable.

Possible camera:

```text
rotation:
X ≈ -50°
Y ≈ 0°
Z ≈ -35°
```

Exact values are aesthetic rather than mechanical.

---

# 10. Rendering Style

Three.js should create a restrained miniature-world aesthetic.

Think:

- low-poly
- miniature diorama
- soft shadows
- slightly uneven terrain
- tiny stylised travellers
- stone shrine
- autumn grass
- snow
- fog
- ruined bridges
- cliffs disappearing into darkness

Avoid realistic graphics.

Small forms are preferable.

The board itself should feel almost like a physical tabletop puzzle.

---

# 11. Lighting

Keep lighting simple.

Suggested:

```text
1 × HemisphereLight
1 × DirectionalLight
```

Potential:

```ts
HemisphereLight
DirectionalLight
Ambient fog
```

Directional light should cast soft shadows.

Do not build complicated lighting rigs.

---

# 12. Environment

Possible chapter environments:

```text
Chapter 1
Stone road + grass

Chapter 2
River valley

Chapter 3
Mountain gates

Chapter 4
Snow

Chapter 5
Ruins

Chapter 6
Night pilgrimage
```

These are mostly visual themes.

Core mechanics stay identical.

---

# 13. Core Entities

## Shrine

The player-controlled object.

```ts
interface ShrineState {
    position: GridPosition;
}
```

Moves one orthogonal tile per turn.

Directions:

```text
UP
DOWN
LEFT
RIGHT
```

The Shrine cannot enter:

- walls
- void
- blocked terrain

---

# 14. Pilgrim

Base pilgrim:

```ts
interface PilgrimState {
    id: string;
    type: "normal";
    position: GridPosition;
    exited: boolean;
}
```

Pilgrims are autonomous.

They react after every Shrine movement.

---

# 15. Pilgrim Movement Rule

Each pilgrim attempts to reduce Manhattan distance to the Shrine.

Example:

```text
P . . .
. . . .
. . . S
```

Possible deterministic rule:

```text
1. Calculate dx.
2. Calculate dy.
3. Prefer the axis with the greater distance.
4. If equal, prefer horizontal.
5. Attempt movement.
6. If blocked, attempt the other axis.
7. If both are blocked, wait.
```

Example implementation:

```ts
function getPilgrimIntent(
    pilgrim: PilgrimState,
    shrine: ShrineState,
    board: BoardState
): GridPosition {
    const dx = shrine.position.x - pilgrim.position.x;
    const dy = shrine.position.y - pilgrim.position.y;

    const horizontal = {
        x: Math.sign(dx),
        y: 0
    };

    const vertical = {
        x: 0,
        y: Math.sign(dy)
    };

    const primary =
        Math.abs(dx) >= Math.abs(dy)
            ? horizontal
            : vertical;

    const secondary =
        primary === horizontal
            ? vertical
            : horizontal;

    // attempt primary
    // attempt secondary
    // otherwise remain
}
```

Exact implementation may differ.

The important property is:

> Same board + same Shrine movement = same result.

Always.

---

# 16. Shrine Adjacency

Recommended rule:

If a pilgrim is orthogonally adjacent to the Shrine:

```text
P S
```

the pilgrim does not move.

The Shrine therefore works as both:

- destination
- obstacle
- temporary parking mechanism

This is useful for puzzle design.

---

# 17. Turn Resolution

Each player movement creates one turn.

Resolution:

```text
1. Validate Shrine movement
2. Move Shrine
3. Snapshot board state
4. Calculate all pilgrim intents
5. Resolve collisions
6. Apply pilgrim movement
7. Resolve terrain
8. Resolve mechanisms
9. Remove exiting pilgrims
10. Evaluate failure
11. Evaluate victory
12. Animate changes
```

Simulation resolves immediately.

Animation happens afterward.

---

# 18. Movement Intents

Pilgrims should not move individually while decisions are still being calculated.

Generate intents first:

```ts
interface MoveIntent {
    entityId: string;
    from: GridPosition;
    to: GridPosition;
}
```

Example:

```text
P1 → (4,3)
P2 → (4,3)
P3 → (7,5)
```

Collision resolver then evaluates them.

---

# 19. Collision Rule

If multiple pilgrims attempt to enter the same tile:

```text
P → X ← P
```

all conflicting pilgrims remain stationary.

This should be deterministic and visually obvious.

Recommended:

```text
intent A = cancelled
intent B = cancelled
```

No random priority.

No entity-order priority.

---

# 20. Tile Types

Initial tiles:

```text
Floor
Wall
Void
Exit
Hazard
```

Later:

```text
Pressure Plate
Door
Bridge
Collapsing Bridge
One-Way Gate
Ice
```

---

# 21. Floor

Normal traversable tile.

```text
.
```

---

# 22. Wall

Blocks Shrine and pilgrims.

```text
#
```

Could visually be:

- rock
- ruined wall
- mountain
- tree line

---

# 23. Void

Impassable.

```text
~
```

Could represent:

- deep water
- cliff
- darkness
- collapsed path

---

# 24. Exit

```text
E
```

When a pilgrim enters:

```text
pilgrim.exited = true
```

Remove it from board simulation.

Play a short exit animation first.

Level is complete when:

```ts
remainingRequiredPilgrims === 0
```

---

# 25. Hazard

```text
X
```

If a pilgrim enters:

```text
failure
```

Example:

- cliff
- deep river
- fire
- collapsing ground

Failure should permit immediate:

```text
UNDO
```

---

# 26. Undo

Unlimited undo.

Critical feature.

Every turn stores a full immutable snapshot.

Example:

```ts
interface GameState {
    shrine: ShrineState;
    pilgrims: PilgrimState[];
    board: BoardState;
    turn: number;
}
```

Undo stack:

```ts
const history: GameState[] = [];
```

Before resolving player input:

```ts
history.push(structuredClone(state));
```

Undo:

```ts
state = history.pop();
```

Game states are tiny.

Do not implement clever reversible commands.

Snapshot everything.

---

# 27. Restart

Restart returns immediately to initial level state.

Input:

```text
R
```

or UI button.

No confirmation dialog.

---

# 28. Animation

Animation must never determine simulation.

Simulation says:

```text
Pilgrim A:
(2,3) → (3,3)
```

Renderer interpolates:

```text
world position A → world position B
```

Recommended duration:

```text
150–250 ms
```

Animations:

### Pilgrim

```text
idle
walk
blocked
fall
exit
```

### Shrine

```text
idle pulse
move
arrival pulse
```

### Environment

```text
gate opening
bridge collapsing
plate depression
```

---

# 29. Animation Manager

Suggested abstraction:

```ts
class AnimationManager {
    async animateTurn(
        previous: GameState,
        next: GameState
    ): Promise<void>;
}
```

Input should normally be locked while animation resolves.

Flow:

```ts
await animationManager.animateTurn(oldState, newState);

input.unlock();
```

Later, allow fast animation mode.

---

# 30. Input

Keyboard:

```text
Arrow Keys / WASD
    Move Shrine

Z / Ctrl+Z
    Undo

R
    Restart

Space
    Wait

Esc
    Pause
```

Mobile:

```text
Swipe
or
4 directional buttons
```

Game should also be playable entirely with mouse/touch.

Possible:

```text
tap adjacent square to move Shrine
```

---

# 31. Level Format

Use JSON.

Example:

```json
{
  "id": "001",
  "name": "The First Step",
  "width": 7,
  "height": 7,
  "map": [
    "#######",
    "#.....#",
    "#.P...#",
    "#.....#",
    "#...S.#",
    "#....E#",
    "#######"
  ]
}
```

Legend:

```text
# wall
. floor
P pilgrim
S shrine
E exit
X hazard
~ void
```

---

# 32. Extended Level Format

Later:

```json
{
  "id": "021",
  "name": "Two Roads",
  "theme": "mountain",
  "par": 14,

  "map": [
    "#########",
    "#P......#",
    "#..###..#",
    "#.......#",
    "#...S...#",
    "#.......#",
    "#....E..#",
    "#########"
  ],

  "pilgrims": [
    {
      "id": "p1",
      "type": "normal",
      "x": 1,
      "y": 1
    }
  ]
}
```

---

# 33. Level Loader

Interface:

```ts
interface LevelDefinition {
    id: string;
    name: string;
    width: number;
    height: number;
    map: string[];
}
```

Loader:

```ts
function loadLevel(
    definition: LevelDefinition
): GameState;
```

No Three.js objects are created here.

Renderer receives the resulting state separately.

---

# 34. First Ten Levels

Prototype campaign:

```text
01 — Follow
Teach attraction

02 — Around
Teach walls

03 — Not Yet
Teach moving Shrine away from goal

04 — The Edge
Introduce hazard

05 — Together
Two pilgrims

06 — Narrow Road
Corridor manipulation

07 — Meeting
Collision

08 — Wrong Way
Obvious Shrine movement causes failure

09 — Around Again
Multi-stage route

10 — Pilgrims
First serious combined puzzle
```

Level 10 should be intentionally nasty.

---

# 35. Prototype Mechanics

Implement only:

```text
Shrine movement

Normal pilgrim

Walls

Floor

Void

Hazard

Exit

Multiple pilgrims

Collision

Undo

Restart

Level progression
```

Nothing else.

---

# 36. Explicitly Not Prototype Scope

Do not build:

```text
Level editor
Steam integration
Achievements
Particle systems
Complex shaders
Story system
Dialogue
Save cloud
Multiplayer
Procedural levels
Character customization
Dynamic camera
Special pilgrim classes
Pressure plates
Doors
Memory mechanics
```

Make the puzzle fun first.

---

# 37. Advanced Mechanics

Only introduce these after the first ten levels prove the game.

---

## Pressure Plate

```text
o
```

Activated while pilgrim stands on it.

Can control:

```text
doors
bridges
gates
```

---

# 38. Doors

```text
D
```

Open based on associated mechanism.

Doors should affect movement during the **next appropriate simulation phase**, never based on animation timing.

---

# 39. One-Way Gates

```text
→
←
↑
↓
```

Pilgrims may enter only from one direction.

Good source of irreversible decisions.

---

# 40. Collapsing Bridge

```text
=
```

After crossing:

```text
=
```

becomes:

```text
~
```

Creates commitment.

---

# 41. Pilgrim Variants

Later chapters can introduce variations.

Avoid creating dozens.

Each variant should substantially change spatial reasoning.

---

## Normal

```text
P
```

Follows current Shrine.

---

## Elder

```text
O
```

Moves every second turn.

Useful for synchronization.

---

## Child

```text
c
```

Only moves when another pilgrim is adjacent.

Creates dependency.

---

## Doubter

```text
?
```

Targets the Shrine's **previous position**.

This should be the game's major advanced mechanic.

---

# 42. Shrine Memory

Maintain recent Shrine positions:

```ts
interface ShrineHistory {
    positions: GridPosition[];
}
```

Example:

```text
Turn 10: (4,5)
Turn 11: (5,5)
Turn 12: (5,4)
```

Normal pilgrim targets:

```text
(5,4)
```

Doubter targets:

```text
(5,5)
```

Potential later pilgrim:

```text
Traditionalist
```

targets:

```text
Shrine position 3 turns ago
```

Do not overuse this.

---

# 43. Why Shrine Memory Matters

With normal pilgrims the question is:

```text
Where should the Shrine be?
```

With Doubters:

```text
Where should the Shrine be now
so that where it was previously
becomes useful later?
```

This introduces temporal planning while preserving the game's single player verb.

That is excellent puzzle economy.

---

# 44. Visual Representation of Memory

Avoid UI text.

Possible subtle effects:

```text
faint Shrine afterimage
small fading footprint
brief ghost silhouette
soft light remaining on previous tile
```

The previous Shrine position should be visually understandable.

Do not make players memorize invisible state.

---

# 45. Diorama Rendering

Each tile can be its own Three.js group:

```ts
class TileView {
    root: THREE.Group;
}
```

Possible hierarchy:

```text
Scene
│
├── BoardGroup
│   ├── Tile
│   ├── Tile
│   └── Tile
│
├── EntityGroup
│   ├── Shrine
│   └── Pilgrims
│
├── EffectsGroup
│
└── EnvironmentGroup
```

Keep world representation distinct from simulation data.

---

# 46. Geometry

Prototype art can use primitives.

Shrine:

```text
CylinderGeometry
BoxGeometry
ConeGeometry
```

Pilgrim:

```text
Capsule / cylinder
sphere head
tiny hat / cloak
```

Terrain:

```text
BoxGeometry
```

You should be able to build the entire first prototype without opening Blender.

That is desirable.

---

# 47. Asset Strategy

Prototype:

```text
procedural primitives
simple materials
```

Production:

```text
.glb models
```

Suggested later:

```text
assets/
├── models/
│   ├── pilgrim.glb
│   ├── shrine.glb
│   ├── bridge.glb
│   └── environment/
│
├── textures/
└── audio/
```

Use `GLTFLoader` when real assets appear.

---

# 48. Materials

Prefer simple materials:

```text
MeshStandardMaterial
```

Avoid custom shaders initially.

Potential stylistic improvements later:

```text
vertex colour variation
subtle fog
ambient particles
soft shadows
tone mapping
```

These are polish.

None are gameplay.

---

# 49. Grid Readability

Every tile must remain visually distinguishable.

Potential treatment:

```text
slight gaps between tiles
subtle height differences
stone seams
grass edges
```

Players must be able to determine immediately:

```text
Can I walk there?
Can the pilgrim walk there?
Is that dangerous?
Where is the exit?
```

Never sacrifice puzzle readability for scenery.

---

# 50. Shrine Readability

Shrine must always be the strongest visual landmark.

Possible:

```text
warm emissive material
tiny floating light
soft pulse
vertical silhouette
```

Do not rely exclusively on colour.

Shape should be distinct.

---

# 51. Pilgrim Feedback

When pilgrims calculate movement:

Optional micro-animation:

```text
turn head
pause
walk
```

This subtly communicates:

> The pilgrim decided where to go.

Not:

> The player directly moved them.

That distinction reinforces the game's identity.

---

# 52. Camera Framing

Camera should automatically frame the board when loading a level.

Calculate:

```text
board width
board height
```

then determine appropriate orthographic bounds.

Avoid manual per-level cameras.

Pseudo:

```ts
fitCameraToBoard(board);
```

---

# 53. Responsive Display

The renderer should fill available space.

Example:

```ts
renderer.setSize(
    container.clientWidth,
    container.clientHeight
);
```

Handle resize:

```text
ResizeObserver
```

rather than assuming fullscreen.

---

# 54. Game Loop

The puzzle is turn based.

There is no need for complex real-time simulation.

Three.js still needs rendering frames:

```ts
function animate(time: number) {
    requestAnimationFrame(animate);

    animationManager.update(time);

    renderer.render(scene, camera);
}
```

Game state changes only when turns resolve.

---

# 55. Simulation State

Recommended:

```ts
enum SimulationMode {
    WaitingForInput,
    Resolving,
    Animating,
    Completed,
    Failed
}
```

Input is accepted only in:

```text
WaitingForInput
```

---

# 56. Game State Immutability

Prefer treating resolved states as immutable.

Conceptually:

```ts
state = resolveTurn(state, direction);
```

rather than modifying dozens of objects in place.

This makes:

```text
undo
testing
replay
solver
```

much cleaner.

---

# 57. Save Data

Minimal:

```json
{
  "highestLevel": 14,
  "completed": [
    "001",
    "002",
    "003"
  ],
  "bestMoves": {
    "001": 8,
    "002": 14
  }
}
```

For browser prototype:

```text
localStorage
```

is sufficient.

Desktop version can later move saves elsewhere.

---

# 58. Move Counter

Display:

```text
MOVES  12
```

Optional par:

```text
12 / 10
```

Par is purely optional optimization.

Never prevent progression because the player exceeded par.

---

# 59. UI

Keep it minimal.

Example:

```text
┌─────────────────────────────┐
│  07 — Meeting      Moves 12 │
│                             │
│                             │
│           GAME              │
│                             │
│                             │
│  Undo     Restart     Menu   │
└─────────────────────────────┘
```

Most of the screen belongs to the board.

---

# 60. Audio

Sparse.

Required:

```text
Shrine move
Pilgrim step
Pilgrim blocked
Fall
Exit
Gate
Bridge
Solve
Undo
```

Music:

```text
quiet
melancholy
spacious
```

Possible instruments:

```text
flute
plucked strings
bell
wind
low drone
```

Silence is useful.

---

# 61. Atmosphere

The game can have emotional texture despite almost no narrative.

Potential themes:

```text
belief
leadership
trust
memory
migration
responsibility
unintended consequences
```

Never explain these heavily.

The mechanics already communicate them.

---

# 62. Narrative Style

Opening:

> They walk toward what they believe will save them.

Then begin.

Chapter interstitials might contain one sentence.

Examples:

> The road disappeared.

> Still, they followed.

> Some remembered differently.

> Some followed a place that no longer existed.

No dialogue trees.

No lore database.

No codex.

---

# 63. Level Complete

When final pilgrim exits:

```text
pause

soft bell

Shrine settles

SOLVED
```

Then:

```text
Next
Retry
Level Select
```

Transition should be fast.

---

# 64. Failure

Failure examples:

```text
pilgrim falls
required pilgrim becomes lost
critical mechanism becomes impossible
```

Do not immediately reload.

Show state.

Let player understand what they did.

Then allow:

```text
Undo
Restart
```

---

# 65. Puzzle Design Philosophy

Difficulty should emerge from **interacting simple rules**.

Avoid:

```text
huge boards
hidden mechanics
random behaviour
obscure exceptions
timers
precision movement
```

Ideal hard puzzle:

```text
9×9 board
2 pilgrims
1 hazard
1 wall arrangement
```

and somehow horrible.

---

# 66. Puzzle Design Test

For every level ask:

```text
What idea does this puzzle test?
```

If answer requires:

```text
"Well, lots of things happen..."
```

the level is probably too noisy.

Good answer:

```text
"This teaches that moving the Shrine away
can cause a pilgrim to approach the exit."
```

---

# 67. Prototype Milestones

## Milestone 1

Render board.

```text
camera
tiles
basic lighting
Shrine
pilgrim
```

---

## Milestone 2

Shrine movement.

```text
keyboard
grid validation
smooth animation
```

---

## Milestone 3

Pilgrim simulation.

```text
intent
movement
blocking
```

---

## Milestone 4

Multiple pilgrims.

```text
simultaneous intent
collision resolution
```

---

## Milestone 5

Game loop.

```text
exit
failure
undo
restart
```

---

## Milestone 6

JSON levels.

```text
load
reset
advance
```

---

## Milestone 7

Ten puzzles.

This milestone matters more than graphical polish.

---

# 68. Prototype Success Criteria

Continue development only if the prototype produces these behaviours:

### Test 1

Someone understands:

```text
"I move the Shrine and they follow it."
```

without instruction.

### Test 2

They can predict pilgrim behaviour.

### Test 3

When they fail they say:

```text
"Ah, I shouldn't have moved there."
```

rather than:

```text
"Why did he do that?"
```

### Test 4

Undo gets used constantly.

### Test 5

A later level produces:

```text
"Wait..."
```

followed by staring.

### Test 6

Level 10 makes the tester angry at themselves.

Success.

---

# 69. First Expansion

If the first ten levels are good:

Implement:

# DOUBTER

```text
Normal Pilgrim:
follows current Shrine

Doubter:
follows Shrine position from previous turn
```

Build another ten levels using this mechanic.

Do not introduce anything else until those levels exist.

If this produces good puzzles, the design has enough depth for a full game.

---

# 70. Potential Campaign

```text
Chapter I
THE ROAD
01–10

Normal pilgrims
Walls
Hazards
```

```text
Chapter II
THE RIVER
11–20

Bridges
Collapsing paths
```

```text
Chapter III
THE GATE
21–30

Plates
Doors
One-way gates
```

```text
Chapter IV
THE PEOPLE
31–40

Behaviour variants
```

```text
Chapter V
MEMORY
41–50

Doubters
Delayed targeting
```

```text
Chapter VI
THE PILGRIMAGE
51–60

Combined mastery
```

---

# 71. Possible Desktop Distribution

The core game remains a web application.

Production builds can later target:

```text
Browser
↓
PWA

Desktop
↓
Tauri / Electron

Steam
↓
desktop wrapper + Steamworks
```

Do not make packaging decisions affect game architecture.

---

# 72. Testing

Because simulation is independent from Three.js, unit testing should be easy.

Example:

```ts
it("pilgrim moves toward shrine", () => {
    const state = createTestState(`
        .....
        .P...
        .....
        ...S.
        .....
    `);

    const next = resolveTurn(
        state,
        Direction.Right
    );

    expect(
        next.pilgrims[0].position
    ).toEqual({
        x: 2,
        y: 1
    });
});
```

Important cases:

```text
equal axis distance
blocked primary movement
blocked secondary movement
two pilgrims same destination
exit
hazard
Shrine adjacency
undo restoration
```

---

# 73. Debug Mode

During development allow:

```text
G
```

to toggle debug overlays.

Show:

```text
grid coordinates
pilgrim target
movement intent
Shrine history
collision destinations
```

Example:

```text
P
↓
(4,3)

? → targeting Shrine[-1]
```

Extremely useful when building puzzles.

Remove or hide it in release builds.

---

# 74. Level Authoring Workflow

Keep authoring primitive.

Edit:

```text
src/levels/012.json
```

Refresh.

Play.

Do not build a level editor until manually editing JSON becomes genuinely painful.

A level editor is exactly the sort of thing that can consume an entire weekend while producing zero actual puzzles.

---

# 75. Future Solver

Because the state space is:

```text
small
discrete
deterministic
```

an automated solver may eventually be feasible.

Possible use:

```text
validate solvability
find minimum move count
detect accidental shortcuts
calculate par
```

State:

```text
Shrine position
Pilgrim positions
World state
```

Edges:

```text
Up
Down
Left
Right
Wait
```

Then BFS may be sufficient for small levels.

This is useful later.

It is absolutely not part of the prototype.

---

# 76. Performance

Performance should be nearly irrelevant.

Typical scene:

```text
< 225 tiles
< 20 characters
few static meshes
simple lighting
```

Three.js can handle vastly more than required.

Optimization priority should be:

```text
correctness
readability
feel
```

not rendering throughput.

---

# 77. Core Rule

Never introduce direct pilgrim control.

Not:

```text
select pilgrim
```

Not:

```text
click destination
```

Not:

```text
special command
```

The identity of the game is:

> You cannot command them.

> You can only change what they follow.

---

# 78. Feature Filter

Before adding anything, ask:

> Does this make moving the Shrine create a new interesting consequence?

If yes:

Consider it.

If the feature simply adds another thing to manage:

Reject it.

---

# 79. MVP Definition

Version `0.1` is complete when:

```text
Three.js scene works

Orthographic board renders

Shrine moves

Pilgrims follow deterministically

Walls work

Hazards work

Exits work

Multiple pilgrims work

Collision works

Undo works

Restart works

10 JSON levels exist

Level 10 is unpleasant
```

Nothing else is necessary.

---

# 80. Elevator Pitch

> **Pilgrims** is a tiny deterministic puzzle game where you move a Shrine instead of controlling the people themselves. Every pilgrim walks toward it, forcing you to manipulate what they believe their destination is to guide them safely through the world.

Shorter:

> You don't control the pilgrims.

> You control what they follow.

---

# 81. Development Commandment

Keep it tiny.

If development begins involving:

```text
skill trees
inventories
quest systems
NPC dialogue
crafting
procedural biomes
open worlds
```

something has gone catastrophically wrong.

The desired development experience is:

```text
one evening:
new mechanic

next evening:
five horrible puzzles
```

The desired player experience is:

> "If I move left, this one goes down... but then that one goes right... unless I move away first..."

That is **Pilgrims**.