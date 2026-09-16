import { GAME_RULES } from "./engine";

export type RankingEntry = { id: string; name: string; score: number; time: number; date: string };

export function sortRanking(entries: RankingEntry[]) {
  return [...entries].sort((a, b) => b.score - a.score || a.time - b.time || a.date.localeCompare(b.date)).slice(0, 10);
}

export function loadRanking(): RankingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(GAME_RULES.rankingKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return sortRanking(parsed.filter((entry): entry is RankingEntry =>
      !!entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.name === "string" && Number.isFinite(entry.score) && Number.isFinite(entry.time) && typeof entry.date === "string"
    ));
  } catch { return []; }
}

export function saveRanking(entry: RankingEntry) {
  const entries = sortRanking([...loadRanking(), entry]);
  try { localStorage.setItem(GAME_RULES.rankingKey, JSON.stringify(entries)); } catch { /* storage may be unavailable */ }
  return { entries, position: entries.findIndex((item) => item.id === entry.id) + 1 };
}
