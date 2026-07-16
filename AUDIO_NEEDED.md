# Runecraft — Audio List

Every sound and music cue the game wants for real immersion, ready to hand to
an AI audio generator. Style guide: warm lo-fi fantasy — think classic
RuneScape's MIDI-flavoured charm rendered with modern samples. Nothing harsh;
short SFX (≤600 ms) with soft transients; loops must be seamless.

Delivery: OGG/MP3, 44.1 kHz. SFX mono, music/ambience stereo. Keep SFX under
~50 KB each where possible (the game ships as a single HTML file).

Priority key: **P0** = core feel · **P1** = strongly wanted · **P2** = polish.

## 1. Music (loops, 60–120 s, seamless)

| Cue | Priority | Direction |
|---|---|---|
| Title / start screen theme | **P0** | Gentle harp + flute motif, hopeful; the "Scape Main" moment. |
| Tutorial island theme | **P0** | Light, curious, pastoral — strings + recorder, mid-tempo. |
| Overworld day (meadow) | **P0** | Warm acoustic guitar + strings; wandering melody. |
| Overworld night | P1 | Same motif slowed, celesta + soft pads, sparse. |
| Town / settlement | P1 | Bustling folk — lute, hand drum, fiddle. |
| Forest deep | P1 | Airy woodwinds, birdsong-adjacent trills. |
| Desert / mesa | P2 | Oud-like plucks, open fifths. |
| Snow / tundra | P2 | Music-box + choir pad, slow. |
| Swamp / corrupted biome | P1 | Low drones, detuned bells, unsettling but quiet. |
| Dungeon (standard) | **P0** | Low percussion, cavern echo, tense ostinato. |
| Dungeon boss | P1 | Driving drums + brass stabs, 100–120 BPM. |
| Dragon encounter | P2 | Full orchestral hit, soaring horn line. |
| Graduation / achievement fanfare (non-loop, 4 s) | **P0** | The RS level-up jingle moment — harp gliss + trumpet. |

## 2. Ambient Beds (loops, 30–60 s)

| Cue | Priority | Direction |
|---|---|---|
| Meadow day (birds, breeze, distant sheep) | **P0** | |
| Night crickets + owl | **P0** | |
| Rain (light + heavy variants) | P1 | Ducked under music. |
| Thunder rumbles (3 one-shots) | P1 | |
| Cave drips + hollow wind | **P0** | |
| Shoreline lap + gulls | P2 | |
| Marsh frogs + bubbles | P2 | |
| Town walla (murmurs, cart wheels, dog bark) | P2 | |
| Wind through pines (forest bed) | P1 | |

## 3. Skill SFX (one-shots; 2–3 variations each)

| Cue | Priority | Direction |
|---|---|---|
| Axe chop into wood + tree crash | **P0** | The most-heard sound in the game. |
| Pickaxe clink on stone + ore crumble | **P0** | Bright "tink" per strike, rubble on deplete. |
| Fishing cast splash + reel + catch plop | **P0** | |
| Cooking sizzle + food-done "pat" | **P0** | |
| Burnt food "fssss" | P1 | Comedy beat. |
| Furnace roar + molten pour | P1 | |
| Anvil hammer ring (3 pitches) | **P0** | Classic smithing rhythm. |
| Bow draw + arrow loose + arrow thunk (hit) / whiff (miss) | **P0** | Arrows now consume + drop; the loose/thunk sells it. |
| Sword swing + hit thud + shield block | **P0** | |
| Hoe tilling earth (scrape + soil turn) | **P0** | New tilling feature. |
| Seed sow (soft rattle + pat) | P1 | |
| Crop harvest rustle | P1 | |
| Herb pick (leafy pluck) | P2 | |
| Thieving: coin snatch + "caught!" sting | P1 | |
| Agility: jump grunt + landing scuff | P2 | |
| Firemaking: match strike + whoosh + crackle loop | **P0** | |
| Prayer: bone bury (dig + chime) | P1 | |
| Runecrafting: essence bind (crystal shimmer) | P1 | |
| Magic: alchemy cast (arcane zap + coin clink) | P1 | |
| Summoning: pouch bind (deep hum + pop) | P2 | |
| Construction: sawing + hammering + "complete" thunk | P1 | |
| Digging (archaeology trowel scrapes + discovery chime) | P2 | |
| Brewing bubble + cork pop | P2 | |

## 4. World & Creature SFX

| Cue | Priority | Direction |
|---|---|---|
| Footsteps: grass, dirt, stone, sand, water wade, wood | **P0** | 4 variations each, quiet. |
| Cow moo, pig oink, sheep baa, chicken cluck + egg-lay squawk | **P0** | Chickens now lay eggs — the squawk cues the drop. |
| Chicken wing flutter | P1 | |
| Skeleton rattle, zombie groan | P1 | |
| Dragon roar + wing beats + fire breath | P1 | |
| Goblin chatter (future mob) | P2 | |
| Door/gate creak open + latch close | **P0** | Pen gates are click-to-open now. |
| Chest open (wooden creak + gold shimmer for loot) | **P0** | |
| Barrel pry open | P2 | |
| Portal hum loop + teleport whoosh | **P0** | Nether-style gateway. |
| Boat oar strokes + hull creak | P2 | |
| Bed sleep (yawn + fade harp) | P2 | |
| Item pickup "blip" (ground items) | **P0** | Distinct from inventory click. |
| Item drop soft thud | P1 | |

## 5. UI & Feedback SFX

| Cue | Priority | Direction |
|---|---|---|
| Level-up jingle (short fanfare, per-skill pitch shift) | **P0** | THE dopamine hit — harp + horn, 1.5 s. |
| Quest accepted (scroll unfurl) | **P0** | |
| Quest complete (two-chord triumph) | **P0** | |
| XP drop tick (tiny soft blip) | P2 | Very quiet, rate-limited. |
| Inventory open/close (leather flap) | P1 | |
| Button click (soft wooden tick) | **P0** | |
| Coin transaction (shop buy/sell) | P1 | |
| Error/reject thunk (dull, friendly) | **P0** | Pairs with "You can't do that." toasts. |
| Eat bite + gulp | P1 | |
| Potion drink + fizz | P1 | |
| Low-HP heartbeat loop (subtle) | P1 | |
| Death sting (descending three notes) + respawn shimmer | **P0** | |
| Save "quill scratch" tick | P2 | |
| Toast pop (parchment slide) | P2 | |

## 6. Mixing Notes

- Music at −18 LUFS-ish under gameplay; ambience −6 dB below music; SFX peaks ≤ −6 dBFS.
- Day/night and biome transitions should crossfade beds over ~4 s.
- Combat music only for bosses — regular fights stay on ambient + SFX (RS-style).
- Everything must survive being heard 500 times: soft attacks, no shrill highs.
