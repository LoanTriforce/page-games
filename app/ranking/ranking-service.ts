export type GameResultInput = {
  nome: string;
  palavrasEncontradas: number;
  tempoTotalMs: number;
  dataInicio: string;
  dataFinalizacao: string;
};

export type RankingEntry = GameResultInput & {
  id: string;
};

const rankingApiUrl = process.env.NEXT_PUBLIC_WORD_SEARCH_RANKING_API_URL?.trim();
export const RANKING_POLL_INTERVAL_MS = 3_000;

export function isRankingConfigured() {
  return Boolean(rankingApiUrl);
}

function getRankingApiUrl() {
  if (!rankingApiUrl) {
    throw new Error("Configure NEXT_PUBLIC_WORD_SEARCH_RANKING_API_URL para ativar o ranking persistente.");
  }
  return rankingApiUrl;
}

export function sanitizePlayerName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function formatDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function sortRanking(entries: RankingEntry[]) {
  return [...entries].sort(
    (a, b) =>
      b.palavrasEncontradas - a.palavrasEncontradas ||
      a.tempoTotalMs - b.tempoTotalMs ||
      new Date(a.dataFinalizacao).getTime() - new Date(b.dataFinalizacao).getTime(),
  );
}

function normalizeEntry(value: unknown): RankingEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RankingEntry>;
  const nome = typeof item.nome === "string" ? sanitizePlayerName(item.nome) : "";
  const palavrasEncontradas = Number(item.palavrasEncontradas);
  const tempoTotalMs = Number(item.tempoTotalMs);
  const dataInicio = typeof item.dataInicio === "string" ? item.dataInicio : "";
  const dataFinalizacao = typeof item.dataFinalizacao === "string" ? item.dataFinalizacao : "";
  const id = typeof item.id === "string" && item.id.trim() ? item.id : `${nome}-${dataFinalizacao}-${tempoTotalMs}`;

  if (!nome || !Number.isFinite(palavrasEncontradas) || !Number.isFinite(tempoTotalMs) || !dataInicio || !dataFinalizacao) return null;
  if (palavrasEncontradas < 0 || tempoTotalMs < 0) return null;

  return { id, nome, palavrasEncontradas, tempoTotalMs, dataInicio, dataFinalizacao };
}

function normalizeRankingPayload(payload: unknown) {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return sortRanking(list.map(normalizeEntry).filter((entry): entry is RankingEntry => entry !== null));
}

export async function fetchRanking() {
  const response = await fetch(getRankingApiUrl(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível carregar o ranking.");
  return normalizeRankingPayload(await response.json());
}

export async function submitGameResult(input: GameResultInput, totalWords: number) {
  const nome = sanitizePlayerName(input.nome);
  const palavrasEncontradas = Number(input.palavrasEncontradas);
  const tempoTotalMs = Number(input.tempoTotalMs);

  if (!nome) throw new Error("Informe o nome do participante antes de iniciar.");
  if (!Number.isInteger(palavrasEncontradas) || palavrasEncontradas < 0 || palavrasEncontradas > totalWords) {
    throw new Error("Quantidade de palavras inválida.");
  }
  if (!Number.isFinite(tempoTotalMs) || tempoTotalMs < 0) throw new Error("Tempo total inválido.");

  const response = await fetch(getRankingApiUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      palavrasEncontradas,
      tempoTotalMs: Math.round(tempoTotalMs),
      dataInicio: input.dataInicio,
      dataFinalizacao: input.dataFinalizacao,
    }),
  });

  if (!response.ok) throw new Error("Não foi possível enviar o resultado para o ranking.");
}
