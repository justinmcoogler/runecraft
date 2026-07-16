// For each baked mob model: where is the head relative to the body along Z?
// Head at MORE NEGATIVE z than body centre => authored facing -Z; at more
// positive => facing +Z. Tells us which rigs need the 180° spin under the
// shared `rotation.y = facing + PI` convention.
import { readFileSync } from "node:fs";
const src = readFileSync("src/content/mob-models-data.ts", "utf8");
const m = src.match(/MOBS_JSON: string = "((?:[^"\\]|\\.)*)"/s);
const json = JSON.parse(JSON.parse(`"${m[1]}"`));
const rows = [];
for (const model of json.models) {
  // Collect cube centroids per named bone (walk the bone tree with origins).
  const els = model.elements;
  const boneZ = {};
  const walk = (bone, parentOff) => {
    const off = [parentOff[0] + 0, parentOff[1] + 0, parentOff[2] + 0]; // origins are absolute in bake? assume o is absolute pivot
    for (const id of bone.cubes ?? []) {
      const c = els[id];
      if (!c) continue;
      const cz = (c.f[2] + c.t[2]) / 2;
      (boneZ[bone.n] ??= []).push(cz);
    }
    for (const k of bone.kids ?? []) walk(k, off);
  };
  for (const r of model.roots) walk(r, [0, 0, 0]);
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const headKeys = Object.keys(boneZ).filter((n) => /head|snout|nose|beak/i.test(n));
  const bodyKeys = Object.keys(boneZ).filter((n) => /body|torso/i.test(n));
  const headZ = headKeys.length ? avg(headKeys.flatMap((k) => boneZ[k])) : null;
  const bodyZ = bodyKeys.length ? avg(bodyKeys.flatMap((k) => boneZ[k])) : null;
  let verdict = "?";
  if (headZ !== null && bodyZ !== null) verdict = headZ < bodyZ ? "faces -Z" : headZ > bodyZ ? "faces +Z" : "flat";
  else if (headZ !== null) verdict = headZ < 0 ? "faces -Z" : "faces +Z";
  rows.push(`${model.id.padEnd(12)} headZ=${headZ?.toFixed(1) ?? "n/a "} bodyZ=${bodyZ?.toFixed(1) ?? "n/a "}  ${verdict}`);
}
console.log(rows.join("\n"));
