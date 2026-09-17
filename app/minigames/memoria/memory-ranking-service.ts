export type MemoryRankingEntry = {
  id: string;
  name: string;
  score: number;
  pairs: number;
  elapsed: number;
  createdAt: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const memoryRankingTable = process.env.NEXT_PUBLIC_MEMORY_RANKING_TABLE?.trim() || "memory_rankings";
export const MEMORY_RANKING_POLL_INTERVAL_MS = 3_000;

export function isMemoryRankingConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ativar o ranking geral.");
  }

  return { supabaseUrl, supabaseAnonKey, memoryRankingTable };
}

function getSupabaseHeaders() {
  const config = getSupabaseConfig();

  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };
}

function getMemoryRankingEndpoint() {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id,name:nome,score:pontuacao,pairs:pares,elapsed:tempo_ms,createdAt:criado_em",
    order: "pontuacao.desc,tempo_ms.asc,criado_em.asc",
    limit: "50",
  });

  return `${config.supabaseUrl}/rest/v1/${config.memoryRankingTable}?${params}`;
}

export function sanitizeMemoryName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 30);
}

export function sortMemoryRanking(entries: MemoryRankingEntry[]) {
  return [...entries].sort((a, b) => b.score - a.score || a.elapsed - b.elapsed || a.createdAt.localeCompare(b.createdAt)).slice(0, 50);
}

function normalizeMemoryPayload(payload: unknown) {
  const list = Array.isArray(payload) ? payload : [];
  return sortMemoryRanking(list.map(normalizeMemoryEntry).filter((entry): entry is MemoryRankingEntry => entry !== null));
}

function normalizeMemoryEntry(value: unknown): MemoryRankingEntry | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Partial<MemoryRankingEntry> & {
    nome?: unknown;
    pontuacao?: unknown;
    pares?: unknown;
    tempo_ms?: unknown;
    criado_em?: unknown;
  };
  const id = typeof item.id === "string" && item.id.trim() ? item.id : "";
  const name = typeof item.name === "string" ? sanitizeMemoryName(item.name) : typeof item.nome === "string" ? sanitizeMemoryName(item.nome) : "";
  const score = Number(item.score ?? item.pontuacao);
  const pairs = Number(item.pairs ?? item.pares);
  const elapsed = Number(item.elapsed ?? item.tempo_ms);
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : typeof item.criado_em === "string" ? item.criado_em : "";

  if (!id || !name || !Number.isFinite(score) || !Number.isInteger(pairs) || !Number.isFinite(elapsed) || !createdAt) return null;
  if (score < 0 || score > 1920 || pairs < 0 || pairs > 12 || elapsed < 0 || elapsed > 60_000) return null;

  return { id, name, score: Math.round(score), pairs, elapsed: Math.round(elapsed), createdAt };
}

export async function loadMemoryRanking() {
  const response = await fetch(getMemoryRankingEndpoint(), {
    headers: {
      ...getSupabaseHeaders(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível carregar o ranking geral do Jogo da Memória.");
  return normalizeMemoryPayload(await response.json());
}

export async function saveMemoryRanking(entry: Omit<MemoryRankingEntry, "createdAt">) {
  const id = entry.id.trim() || crypto.randomUUID();
  const name = sanitizeMemoryName(entry.name);
  const score = Math.max(0, Math.round(entry.score));
  const pairs = Math.max(0, Math.min(12, Math.round(entry.pairs)));
  const elapsed = Math.max(0, Math.min(60_000, Math.round(entry.elapsed)));

  if (!name) throw new Error("Informe o nome do participante.");

  const config = getSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.memoryRankingTable}`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(),
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id,
      nome: name,
      pontuacao: score,
      pares: pairs,
      tempo_ms: elapsed,
      criado_em: new Date().toISOString(),
    }),
  });

  if (!response.ok && response.status !== 409) throw new Error("Não foi possível salvar no ranking geral.");
  return loadMemoryRanking();
}
