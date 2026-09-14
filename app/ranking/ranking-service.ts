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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const rankingTable = process.env.NEXT_PUBLIC_WORD_SEARCH_RANKING_TABLE?.trim() || "word_search_rankings";
export const RANKING_POLL_INTERVAL_MS = 3_000;

export function isRankingConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ativar o ranking persistente.");
  }
  return { supabaseUrl, supabaseAnonKey, rankingTable };
}

function getRankingEndpoint() {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id,nome,palavrasEncontradas:palavras_encontradas,tempoTotalMs:tempo_total_ms,dataInicio:data_inicio,dataFinalizacao:data_finalizacao",
    order: "palavras_encontradas.desc,tempo_total_ms.asc,data_finalizacao.asc",
  });

  return `${config.supabaseUrl}/rest/v1/${config.rankingTable}?${params}`;
}

function getSupabaseHeaders() {
  const config = getSupabaseConfig();

  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };
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

function normalizeEntry(value: unknown): RankingEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RankingEntry> & {
    palavras_encontradas?: unknown;
    tempo_total_ms?: unknown;
    data_inicio?: unknown;
    data_finalizacao?: unknown;
  };
  const nome = typeof item.nome === "string" ? sanitizePlayerName(item.nome) : "";
  const palavrasEncontradas = Number(item.palavrasEncontradas ?? item.palavras_encontradas);
  const tempoTotalMs = Number(item.tempoTotalMs ?? item.tempo_total_ms);
  const dataInicio = typeof item.dataInicio === "string" ? item.dataInicio : typeof item.data_inicio === "string" ? item.data_inicio : "";
  const dataFinalizacao = typeof item.dataFinalizacao === "string" ? item.dataFinalizacao : typeof item.data_finalizacao === "string" ? item.data_finalizacao : "";
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

  return list.map(normalizeEntry).filter((entry): entry is RankingEntry => entry !== null);
}

export async function fetchRanking() {
  const response = await fetch(getRankingEndpoint(), {
    headers: {
      ...getSupabaseHeaders(),
      Accept: "application/json",
    },
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

  const config = getSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.rankingTable}`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(),
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      nome,
      palavras_encontradas: palavrasEncontradas,
      tempo_total_ms: Math.round(tempoTotalMs),
      data_inicio: input.dataInicio,
      data_finalizacao: input.dataFinalizacao,
    }),
  });

  if (!response.ok) throw new Error("Não foi possível enviar o resultado para o ranking.");
}
