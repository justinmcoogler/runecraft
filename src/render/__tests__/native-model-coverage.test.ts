import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import { ARACHNID_ENEMY_IDS } from "../arachnid-model";
import { BOSS_ENEMY_IDS } from "../boss-model";
import { CANID_ENEMY_IDS } from "../canid-model";
import { CONSTRUCT_ENEMY_IDS } from "../construct-model";
import { FLIER_ENEMY_IDS } from "../flier-model";
import { OOZE_ENEMY_IDS } from "../ooze-model";
import { RAIDER_ENEMY_IDS } from "../raider-model";
import { SIGNATURE_ENEMY_IDS } from "../signature-model";
import { NATIVE_UNDEAD_ENEMY_IDS } from "../undead-model";
import { UNGULATE_ENEMY_IDS } from "../ungulate-model";

// Creatures added after the native-model handoff: the wildlife/gap-filler
// roster (hand-built rig cases) and the wave-2 warband (painted pixel skins),
// plus reskins that deliberately ride an existing rig (duck on chicken,
// bandit/poacher on the raider pillager, magma hound on the classic wolf).
const POST_HANDOFF_ORIGINAL_RIGS = [
  "enemy.fox", "enemy.rabbit", "enemy.stag", "enemy.doe", "enemy.crab.shore",
  "enemy.duck", "enemy.goat", "enemy.frog", "enemy.squirrel",
  "enemy.giant_rat", "enemy.bandit", "enemy.wisp", "enemy.mimic",
  "enemy.goblin", "enemy.goblin_shaman", "enemy.goblin_chief",
  "enemy.rattlesnake", "enemy.werewolf", "enemy.yeti",
  "enemy.magma_hound", "enemy.poacher",
  "enemy.squid", // classic vanilla-style rig (left the flier family)
] as const;

describe("complete live enemy model coverage", () => {
  it("accounts for all live enemies with native rigs", () => {
    const covered = [
      ...ARACHNID_ENEMY_IDS,
      ...NATIVE_UNDEAD_ENEMY_IDS,
      ...CONSTRUCT_ENEMY_IDS,
      ...OOZE_ENEMY_IDS,
      ...CANID_ENEMY_IDS,
      ...UNGULATE_ENEMY_IDS,
      ...RAIDER_ENEMY_IDS,
      ...FLIER_ENEMY_IDS,
      ...SIGNATURE_ENEMY_IDS,
      ...BOSS_ENEMY_IDS,
      ...POST_HANDOFF_ORIGINAL_RIGS,
    ];
    const liveIds = Object.keys(ENEMIES).sort();

    expect(liveIds).toHaveLength(82);
    expect(new Set(covered).size).toBe(covered.length);
    expect([...covered].sort()).toEqual(liveIds);
    for (const id of BOSS_ENEMY_IDS.slice(0, 4)) expect(ENEMIES[id].view).toBe("dragon");
    expect(ENEMIES[BOSS_ENEMY_IDS[4]].view).toBe("warden");
  });

  it("keeps every native family on a dedicated animation branch and shared combat hooks", () => {
    const source = readFileSync("src/render/renderer.ts", "utf8");
    for (const family of ["arachnid", "undead", "construct", "ooze", "canid", "ungulate", "raider", "flier", "signature", "boss"]) {
      expect(source, family).toContain(`anim.${family}`);
    }
    expect(source).toContain("const attackPulse = anim.lungeT > 0");
    expect(source).toContain("anim.body.position.z = -extension * 0.28");
    expect(source).toContain('view3 === "squid" && onWater');
    expect(source).toContain('if (view3 === "ghast") cellH += 2.6');
  });
});
