export type ThemeId = "nebula" | "midnight" | "forest" | "ember" | "daylight" | "sand";

export const THEMES: { id: ThemeId; name: string; blurb: string; swatch: string[] }[] = [
  {
    id: "nebula",
    name: "Nebula",
    blurb: "Deep violet with a cyan spark",
    swatch: ["#231a33", "#a855f7", "#67e8f9"],
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Calm deep blue",
    swatch: ["#161d2e", "#5b8def", "#8fd6ff"],
  },
  {
    id: "forest",
    name: "Forest",
    blurb: "Dark green, easy on the eyes",
    swatch: ["#16241f", "#4ade80", "#bef264"],
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Warm dark amber",
    swatch: ["#271a12", "#fb923c", "#fcd34d"],
  },
  {
    id: "daylight",
    name: "Daylight",
    blurb: "Bright and crisp",
    swatch: ["#ffffff", "#7c3aed", "#38bdf8"],
  },
  {
    id: "sand",
    name: "Sand",
    blurb: "Soft paper tones",
    swatch: ["#f6efe2", "#a2643a", "#d8b26a"],
  },
];

export const DEFAULT_THEME: ThemeId = "nebula";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}
