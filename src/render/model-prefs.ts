// Player model preferences: any baked model (tree, prop, rock, dragon,
// NPC outfit) can be switched off in the Models settings panel. Disabled
// models drop out of every deterministic pick pool — the remaining models
// take their place — and disabled dragons stop spawning entirely.
// Stored on-device only.

const STORAGE_KEY = "stoneleaf.models.disabled";

const disabled = new Set<string>();
let loaded = false;

export function loadModelPrefs(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) disabled.add(id);
  } catch {
    // Corrupt prefs: start clean.
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabled]));
  } catch {
    // Storage full/unavailable: the session still works, prefs just don't stick.
  }
}

export function isModelEnabled(id: string): boolean {
  return !disabled.has(id);
}

export function setModelEnabled(id: string, enabled: boolean): void {
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  save();
}

export function disabledModelIds(): ReadonlySet<string> {
  return disabled;
}
