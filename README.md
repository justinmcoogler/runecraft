# Runecraft

A top-down **voxel skilling RPG** for the browser — chop, mine, fish, farm,
fight and build your way up 20+ skills across an endless, seed-generated world.
Written in **TypeScript + [three.js](https://threejs.org/)** with **no UI
framework**: a headless simulation drives a thin renderer and HUD.

> Also referred to as *runecraftgame*.

## Play right now (no build)

Open the prebuilt single-file build — it's completely self-contained (no server,
no network):

```
dist/runecraft.html
```

Double-click it, or serve the folder and open it. Add `?seed=<number>` to the URL
to jump straight into a specific world (skips the start screen).

## Run from source

Requires Node 18+.

```bash
npm install
npm run dev        # Vite dev server with hot reload
```

Then open the printed local URL.

## Build the standalone

```bash
npm run build      # -> dist/runecraft.html (+ .fragment.html)
```

The build inlines all JS, CSS, fonts and textures into one HTML file.

## Test

```bash
npm test           # vitest — the headless simulation suite
```

## How it's built

- **`src/sim/`** — the headless, deterministic game simulation (world gen,
  skills, inventory, movement, combat). All gameplay logic and tests live here.
- **`src/render/`** — the three.js renderer: terrain meshing, character/mob
  rigs, textures baked as original pixel art (a loaded resource pack can
  override any material on-device).
- **`src/ui/`** — the HUD, panels, and the start screen (all DOM, no framework).
- **`src/content/`** — data-driven blocks, items, objects, skills, quests.
- **`src/structures/`** — importer + behavior parity for `.nbt`/`.schem`/model
  assets (stairs walkable, doors openable, windows translucent, …).

The world is an endless pure function of `(seed, x, z)`, streamed in chunks.
See **[CLAUDE.md](./CLAUDE.md)** for the project's working rules (Minecraft-exact
sizes, original art only, sim-first, verify-in-browser).

## Credits & licenses

Original art and code. Third-party fonts and any referenced assets are credited
in **[CREDITS.md](./CREDITS.md)** and `docs/third-party/`. User-imported skins and
resource packs stay on the player's device and are never redistributed.
