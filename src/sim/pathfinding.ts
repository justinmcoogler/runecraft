// Grid A* over WorldState. 8-directional with corner-cut prevention and step<=1 elevation.

import type { Cell } from "./types";
import { cellKey } from "./types";
import type { WorldState } from "./world";

const DIRS: Array<{ dx: number; dz: number; cost: number }> = [
  { dx: 1, dz: 0, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
];

function heuristic(a: Cell, b: Cell): number {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

/**
 * Expansion budget: a real path expands a few thousand cells (the heuristic
 * keeps A* tight); only unreachable goals would flood the whole grid, so cap
 * the search instead of stalling for seconds. Cross-province journeys (the
 * accessibility test suite, long map clicks) pass a larger budget.
 */
const MAX_EXPANSIONS = 60_000;

/**
 * Returns the path from `start` to `goal` as a list of cells excluding `start`,
 * or null if unreachable. Deterministic (stable tie-breaking by insertion order).
 */
export function findPath(
  world: WorldState,
  start: Cell,
  goal: Cell,
  maxExpansions = MAX_EXPANSIONS,
  boat = false,
): Cell[] | null {
  if (!world.walkable(goal, boat)) return null;
  if (start.x === goal.x && start.z === goal.z) return [];

  const open: Array<{ cell: Cell; f: number; g: number; order: number }> = [];
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, Cell>();
  const closed = new Set<string>();
  let order = 0;

  gScore.set(cellKey(start), 0);
  open.push({ cell: start, g: 0, f: heuristic(start, goal), order: order++ });

  // Binary min-heap keyed on (f, order): the map is big now, so extract-min
  // must be O(log n). Deterministic tie-breaking by insertion order.
  const less = (a: number, b: number) =>
    open[a].f < open[b].f || (open[a].f === open[b].f && open[a].order < open[b].order);
  const swap = (a: number, b: number) => {
    const t = open[a];
    open[a] = open[b];
    open[b] = t;
  };
  const heapPush = () => {
    let i = open.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(i, parent)) break;
      swap(i, parent);
      i = parent;
    }
  };
  const heapPop = () => {
    const top = open[0];
    const last = open.pop()!;
    if (open.length > 0) {
      open[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < open.length && less(l, m)) m = l;
        if (r < open.length && less(r, m)) m = r;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    return top;
  };

  while (open.length > 0) {
    if (closed.size > maxExpansions) return null;
    const current = heapPop();
    const curKey = cellKey(current.cell);
    if (closed.has(curKey)) continue;
    closed.add(curKey);

    if (current.cell.x === goal.x && current.cell.z === goal.z) {
      const path: Cell[] = [];
      let c: Cell | undefined = current.cell;
      while (c && !(c.x === start.x && c.z === start.z)) {
        path.push(c);
        c = cameFrom.get(cellKey(c));
      }
      path.reverse();
      return path;
    }

    for (const d of DIRS) {
      const next: Cell = { x: current.cell.x + d.dx, z: current.cell.z + d.dz };
      if (!world.walkable(next, boat)) continue;
      if (!world.stepOk(current.cell, next, boat)) continue;
      if (d.dx !== 0 && d.dz !== 0) {
        // No corner cutting: both orthogonal neighbours must be passable.
        const sideA: Cell = { x: current.cell.x + d.dx, z: current.cell.z };
        const sideB: Cell = { x: current.cell.x, z: current.cell.z + d.dz };
        if (!world.walkable(sideA, boat) || !world.walkable(sideB, boat)) continue;
        if (!world.stepOk(current.cell, sideA, boat) || !world.stepOk(current.cell, sideB, boat)) continue;
      }
      const nextKey = cellKey(next);
      if (closed.has(nextKey)) continue;
      const tentativeG = current.g + d.cost;
      const known = gScore.get(nextKey);
      if (known !== undefined && tentativeG >= known) continue;
      gScore.set(nextKey, tentativeG);
      cameFrom.set(nextKey, current.cell);
      open.push({ cell: next, g: tentativeG, f: tentativeG + heuristic(next, goal), order: order++ });
      heapPush();
    }
  }
  return null;
}
