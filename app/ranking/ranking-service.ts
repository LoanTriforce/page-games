export type GameResultInput = {
  id: string;
  nome: string;
  telefone: string;
  palavrasEncontradas: number;
  totalPalavras: number;
  tempoTotalMs: number;
  pontuacao: number;
  dataInicio: string;
  dataFinalizacao: string;
};

export type RankingEntry = GameResultInput;

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
    select: "id,nome,telefone,palavrasEncontradas:palavras_encontradas,totalPalavras:total_palavras,tempoTotalMs:tempo_total_ms,pontuacao,dataInicio:data_inicio,dataFinalizacao:data_finalizacao",
    order: "pontuacao.desc,palavras_encontradas.desc,tempo_total_ms.asc,data_finalizacao.asc",
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

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(0, 11);
}

export function isValidBrazilianPhone(phone: string) {
  const normalized = normalizePhone(phone);
  return /^[1-9]{2}(?:9\d{8}|[2-9]\d{7})$/.test(normalized);
}

export function formatPhone(phone: string) {
  const normalized = normalizePhone(phone);

  if (!normalized) return "";
  if (normalized.length <= 2) return normalized;
  if (normalized.length <= 6) return `(${normalized.slice(0, 2)}) ${normalized.slice(2)}`;
  if (normalized.length <= 10) return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 7)}-${normalized.slice(7)}`;
}

export function formatScore(score: number) {
  return Math.max(0, Math.round(score)).toLocaleString("pt-BR");
}

export function formatDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function calculateScore(wordsFound: number, timeMs: number) {
  // Cada palavra vale 100.000 pontos, e o tempo gasto é subtraído em milissegundos.
  // Como a rodada tem 45.000 ms, uma palavra extra sempre vale mais que qualquer bônus de velocidade.
  const safeWords = Math.max(0, Math.round(wordsFound));
  const safeTime = Math.max(0, Math.round(timeMs));
  return Math.max(0, safeWords * 100_000 - safeTime);
}

function normalizeEntry(value: unknown): RankingEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RankingEntry> & {
    palavras_encontradas?: unknown;
    total_palavras?: unknown;
    tempo_total_ms?: unknown;
    data_inicio?: unknown;
    data_finalizacao?: unknown;
  };
  const nome = typeof item.nome === "string" ? sanitizePlayerName(item.nome) : "";
  const telefone = typeof item.telefone === "string" ? normalizePhone(item.telefone) : "";
  const palavrasEncontradas = Number(item.palavrasEncontradas ?? item.palavras_encontradas);
  const totalPalavras = Number(item.totalPalavras ?? item.total_palavras);
  const tempoTotalMs = Number(item.tempoTotalMs ?? item.tempo_total_ms);
  const pontuacao = Number(item.pontuacao);
  const dataInicio = typeof item.dataInicio === "string" ? item.dataInicio : typeof item.data_inicio === "string" ? item.data_inicio : "";
  const dataFinalizacao = typeof item.dataFinalizacao === "string" ? item.dataFinalizacao : typeof item.data_finalizacao === "string" ? item.data_finalizacao : "";
  const id = typeof item.id === "string" && item.id.trim() ? item.id : `${nome}-${dataFinalizacao}-${tempoTotalMs}`;

  if (!id || !nome || !Number.isFinite(palavrasEncontradas) || !Number.isFinite(totalPalavras) || !Number.isFinite(tempoTotalMs) || !Number.isFinite(pontuacao) || !dataInicio || !dataFinalizacao) return null;
  if (palavrasEncontradas < 0 || totalPalavras < 1 || palavrasEncontradas > totalPalavras || tempoTotalMs < 0 || pontuacao < 0) return null;

  return { id, nome, telefone, palavrasEncontradas, totalPalavras, tempoTotalMs, pontuacao, dataInicio, dataFinalizacao };
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
  const id = input.id.trim();
  const nome = sanitizePlayerName(input.nome);
  const telefone = normalizePhone(input.telefone);
  const palavrasEncontradas = Number(input.palavrasEncontradas);
  const totalPalavras = Number(input.totalPalavras);
  const tempoTotalMs = Number(input.tempoTotalMs);
  const pontuacao = Number(input.pontuacao);
  const expectedScore = calculateScore(palavrasEncontradas, tempoTotalMs);

  if (!id) throw new Error("Rodada sem identificador.");
  if (!nome) throw new Error("Informe o nome do participante antes de iniciar.");
  if (!isValidBrazilianPhone(telefone)) throw new Error("Informe um telefone brasileiro válido.");
  if (!Number.isInteger(totalPalavras) || totalPalavras < 1 || totalPalavras !== totalWords) throw new Error("Total de palavras inválido.");
  if (!Number.isInteger(palavrasEncontradas) || palavrasEncontradas < 0 || palavrasEncontradas > totalPalavras) {
    throw new Error("Quantidade de palavras inválida.");
  }
  if (!Number.isFinite(tempoTotalMs) || tempoTotalMs < 0) throw new Error("Tempo total inválido.");
  if (!Number.isInteger(pontuacao) || pontuacao !== expectedScore) throw new Error("Pontuação inválida.");

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
      id,
      nome,
      telefone,
      palavras_encontradas: palavrasEncontradas,
      total_palavras: totalPalavras,
      tempo_total_ms: Math.round(tempoTotalMs),
      pontuacao,
      data_inicio: input.dataInicio,
      data_finalizacao: input.dataFinalizacao,
    }),
  });

  if (!response.ok && response.status !== 409) throw new Error("Não foi possível enviar o resultado para o ranking.");
}
