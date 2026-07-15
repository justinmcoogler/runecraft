// Seasons: the world clock cycles spring→summer→autumn→winter over a year, and
// the season leans the weather (summer clear, winter foul & snowy).

import { describe, expect, it } from "vitest";
import { GameSimulation, DAY_LENGTH_S, DAYS_PER_SEASON, WEATHER_SPELL_S } from "../simulation";

const YEAR_DAYS = DAYS_PER_SEASON * 4;

describe("seasons", () => {
  it("cycles the four seasons over the year", () => {
    const sim = GameSimulation.createEndless(1);
    const seen: string[] = [];
    for (let day = 0; day < YEAR_DAYS; day++) {
      sim.timeS = (day + 0.5) * DAY_LENGTH_S;
      seen.push(sim.season());
    }
    // Day 0 is spring; each season spans DAYS_PER_SEASON days in order.
    expect(seen[0]).toBe("spring");
    expect(seen[DAYS_PER_SEASON]).toBe("summer");
    expect(seen[DAYS_PER_SEASON * 2]).toBe("autumn");
    expect(seen[DAYS_PER_SEASON * 3]).toBe("winter");
    expect(new Set(seen).size).toBe(4);
    // The year wraps back to spring.
    sim.timeS = (YEAR_DAYS + 0.5) * DAY_LENGTH_S;
    expect(sim.season()).toBe("spring");
  });

  it("reports progress, tint and cold for the season", () => {
    const sim = GameSimulation.createEndless(1);
    sim.timeS = 0;
    let info = sim.seasonInfo();
    expect(info.season).toBe("spring");
    expect(info.progress).toBeCloseTo(0, 5);
    expect(info.cold).toBe(false);
    // Deep winter is cold.
    sim.timeS = (DAYS_PER_SEASON * 3 + 1) * DAY_LENGTH_S;
    info = sim.seasonInfo();
    expect(info.season).toBe("winter");
    expect(info.cold).toBe(true);
    expect(info.tint).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("keeps weather deterministic but leans it by season", () => {
    const a = GameSimulation.createEndless(9);
    const b = GameSimulation.createEndless(9);
    // Sweep many spells across many years, bucketing each by its season, so
    // summer and winter each get a large sample.
    let sumClear = 0, sumN = 0, winClear = 0, winN = 0;
    for (let epoch = 0; epoch < 4000; epoch++) {
      a.timeS = b.timeS = epoch * WEATHER_SPELL_S + 1;
      expect(a.weather()).toBe(b.weather()); // determinism holds under the bias
      const w = a.weather();
      const s = a.season();
      if (s === "summer") { sumN++; if (w === "clear") sumClear++; }
      else if (s === "winter") { winN++; if (w === "clear") winClear++; }
    }
    // Summer skies run clearer than winter's.
    expect(sumClear / sumN).toBeGreaterThan(winClear / winN);
    // And winter is the cold season (snow), summer is not.
    a.timeS = (DAYS_PER_SEASON * 3 + 1) * DAY_LENGTH_S;
    expect(a.seasonInfo().cold).toBe(true);
    a.timeS = (DAYS_PER_SEASON + 1) * DAY_LENGTH_S;
    expect(a.seasonInfo().cold).toBe(false);
  });
});
