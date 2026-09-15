export type FoundWordDetail = {
  word: string;
  foundAtMs: number;
};

export type GameResultInput = {
  id: string;
  nome: string;
  telefone: string;
  palavrasEncontradas: number;
  totalPalavras: number;
  tempoResultadoMs: number;
  pontuacao: number;
  palavrasDetalhadas: FoundWordDetail[];
  dataInicio: string;
  dataFinalizacao: string;
};

export type RankingEntry = Omit<GameResultInput, "telefone" | "palavrasDetalhadas"> & {
  telefone?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const rankingTable = process.env.NEXT_PUBLIC_WORD_SEARCH_RANKING_TABLE?.trim() || "word_search_rankings";
const MAX_ROUND_TIME_MS = 45_000;
const POINTS_PER_WORD = 100_000;
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
    select: "id,nome,palavrasEncontradas:palavras_encontradas,totalPalavras:total_palavras,tempoResultadoMs:tempo_total_ms,pontuacao,dataInicio:data_inicio,dataFinalizacao:data_finalizacao",
    order: "palavras_encontradas.desc,tempo_total_ms.asc,pontuacao.desc,data_finalizacao.asc",
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
  const digits = phone.replace(/\D/g, "");
  const withoutCountryCode = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return withoutCountryCode.slice(0, 11);
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

export function formatRankingDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const seconds = safeMs / 1000;
  const hasTenths = safeMs % 1000 !== 0;
  return `${seconds.toLocaleString("pt-BR", {
    minimumFractionDigits: hasTenths ? 1 : 0,
    maximumFractionDigits: hasTenths ? 1 : 0,
  })}s`;
}

export function formatWordCount(wordsFound: number) {
  const safeWords = Math.max(0, Math.round(wordsFound));
  return `${safeWords} ${safeWords === 1 ? "palavra" : "palavras"}`;
}

export function formatRankingResult(wordsFound: number, elapsedMs: number) {
  return `${formatWordCount(wordsFound)} em ${formatRankingDuration(elapsedMs)}`;
}

export function calculateScore(wordsFound: number, elapsedMs: number) {
  // Cada palavra vale 100.000 pontos, e o tempo da última palavra encontrada é subtraído em milissegundos.
  // Como a rodada tem 45.000 ms, uma palavra extra sempre vale mais que qualquer bônus de velocidade.
  const safeWords = Math.max(0, Math.round(wordsFound));
  const safeTime = Math.max(0, Math.round(elapsedMs));
  return Math.max(0, safeWords * POINTS_PER_WORD - safeTime);
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
  const palavrasEncontradas = Number(item.palavrasEncontradas ?? item.palavras_encontradas);
  const totalPalavras = Number(item.totalPalavras ?? item.total_palavras);
  const tempoResultadoMs = Number(item.tempoResultadoMs ?? item.tempo_total_ms);
  const pontuacao = Number(item.pontuacao);
  const dataInicio = typeof item.dataInicio === "string" ? item.dataInicio : typeof item.data_inicio === "string" ? item.data_inicio : "";
  const dataFinalizacao = typeof item.dataFinalizacao === "string" ? item.dataFinalizacao : typeof item.data_finalizacao === "string" ? item.data_finalizacao : "";
  const id = typeof item.id === "string" && item.id.trim() ? item.id : `${nome}-${dataFinalizacao}-${tempoResultadoMs}`;

  if (!id || !nome || !Number.isFinite(palavrasEncontradas) || !Number.isFinite(totalPalavras) || !Number.isFinite(tempoResultadoMs) || !Number.isFinite(pontuacao) || !dataInicio || !dataFinalizacao) return null;
  if (palavrasEncontradas < 0 || totalPalavras < 1 || palavrasEncontradas > totalPalavras || tempoResultadoMs < 0 || pontuacao < 0) return null;

  return { id, nome, palavrasEncontradas, totalPalavras, tempoResultadoMs, pontuacao, dataInicio, dataFinalizacao };
}

function normalizeRankingPayload(payload: unknown) {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return list.map(normalizeEntry).filter((entry): entry is RankingEntry => entry !== null);
}

function normalizeFoundWordDetails(details: FoundWordDetail[]) {
  return details
    .map((detail) => ({
      word: typeof detail.word === "string" ? detail.word.trim().slice(0, 40) : "",
      foundAtMs: Math.max(0, Math.round(Number(detail.foundAtMs))),
    }))
    .filter((detail) => detail.word && Number.isFinite(detail.foundAtMs) && detail.foundAtMs <= MAX_ROUND_TIME_MS);
}

function validateFoundWordDetails(details: FoundWordDetail[], wordsFound: number, elapsedMs: number) {
  if (details.length !== wordsFound) return false;
  const uniqueWords = new Set(details.map((detail) => detail.word));
  if (uniqueWords.size !== details.length) return false;
  if (wordsFound === 0) return true;

  let previous = -1;
  for (const detail of details) {
    if (detail.foundAtMs < previous) return false;
    previous = detail.foundAtMs;
  }

  return details[details.length - 1]?.foundAtMs === elapsedMs;
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
  const tempoResultadoMs = Math.round(Number(input.tempoResultadoMs));
  const pontuacao = Number(input.pontuacao);
  const palavrasDetalhadas = normalizeFoundWordDetails(input.palavrasDetalhadas);
  const expectedScore = calculateScore(palavrasEncontradas, tempoResultadoMs);

  if (!id) throw new Error("Rodada sem identificador.");
  if (!nome) throw new Error("Informe o nome do participante antes de iniciar.");
  if (!isValidBrazilianPhone(telefone)) throw new Error("Informe um telefone brasileiro válido.");
  if (!Number.isInteger(totalPalavras) || totalPalavras < 1 || totalPalavras !== totalWords) throw new Error("Total de palavras inválido.");
  if (!Number.isInteger(palavrasEncontradas) || palavrasEncontradas < 0 || palavrasEncontradas > totalPalavras) {
    throw new Error("Quantidade de palavras inválida.");
  }
  if (!Number.isInteger(tempoResultadoMs) || tempoResultadoMs < 0 || tempoResultadoMs > MAX_ROUND_TIME_MS) throw new Error("Tempo de resultado inválido.");
  if (!Number.isInteger(pontuacao) || pontuacao !== expectedScore) throw new Error("Pontuação inválida.");
  if (!validateFoundWordDetails(palavrasDetalhadas, palavrasEncontradas, tempoResultadoMs)) throw new Error("Detalhamento de palavras inválido.");

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
      tempo_total_ms: tempoResultadoMs,
      pontuacao,
      palavras_detalhadas: palavrasDetalhadas,
      data_inicio: input.dataInicio,
      data_finalizacao: input.dataFinalizacao,
    }),
  });

  if (!response.ok && response.status !== 409) throw new Error("Não foi possível enviar o resultado para o ranking.");
}
