import { GAME_RULES, TARGETS } from "./engine";

export type RankingEntry = { id: string; name: string; score: number; time: number; date: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const findTicketRankingTable = process.env.NEXT_PUBLIC_FIND_TICKET_RANKING_TABLE?.trim() || "find_ticket_rankings";
export const FIND_TICKET_RANKING_POLL_INTERVAL_MS = 3_000;

export function isFindTicketRankingConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ativar o ranking geral.");
  }

  return { supabaseUrl, supabaseAnonKey, findTicketRankingTable };
}

function getSupabaseHeaders() {
  const config = getSupabaseConfig();

  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };
}

function getFindTicketRankingEndpoint() {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id,name:nome,score:pontuacao,time:tempo_ms,date:criado_em",
    order: "pontuacao.desc,tempo_ms.asc,criado_em.asc",
    limit: "10",
  });

  return `${config.supabaseUrl}/rest/v1/${config.findTicketRankingTable}?${params}`;
}

export function sanitizeFindTicketName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 18) || "Jogador";
}

export function sortRanking(entries: RankingEntry[]) {
  return [...entries].sort((a, b) => b.score - a.score || a.time - b.time || a.date.localeCompare(b.date)).slice(0, 10);
}

function normalizeRankingPayload(payload: unknown) {
  const list = Array.isArray(payload) ? payload : [];
  return sortRanking(list.map(normalizeRankingEntry).filter((entry): entry is RankingEntry => entry !== null));
}

function normalizeRankingEntry(value: unknown): RankingEntry | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Partial<RankingEntry> & { nome?: unknown; pontuacao?: unknown; tempo_ms?: unknown; criado_em?: unknown };
  const id = typeof item.id === "string" && item.id.trim() ? item.id : "";
  const name = typeof item.name === "string" ? sanitizeFindTicketName(item.name) : typeof item.nome === "string" ? sanitizeFindTicketName(item.nome) : "";
  const score = Number(item.score ?? item.pontuacao);
  const time = Number(item.time ?? item.tempo_ms);
  const date = typeof item.date === "string" ? item.date : typeof item.criado_em === "string" ? item.criado_em : "";

  if (!id || !name || !Number.isFinite(score) || !Number.isFinite(time) || !date) return null;
  if (score < 0 || score > 6600 || time < 0 || time > GAME_RULES.roundMilliseconds) return null;

  return { id, name, score: Math.round(score), time: Math.round(time), date };
}

export async function loadRanking(): Promise<RankingEntry[]> {
  const response = await fetch(getFindTicketRankingEndpoint(), {
    headers: {
      ...getSupabaseHeaders(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível carregar o ranking geral do Encontre Tudo.");
  return normalizeRankingPayload(await response.json());
}

export async function saveRanking(entry: RankingEntry) {
  const id = entry.id.trim() || crypto.randomUUID();
  const name = sanitizeFindTicketName(entry.name);
  const score = Math.max(0, Math.round(entry.score));
  const time = Math.max(0, Math.min(GAME_RULES.roundMilliseconds, Math.round(entry.time)));

  const config = getSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.findTicketRankingTable}`, {
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
      itens_encontrados: TARGETS.length,
      tempo_ms: time,
      criado_em: entry.date,
    }),
  });

  if (!response.ok && response.status !== 409) throw new Error("Não foi possível salvar no ranking geral.");

  const entries = await loadRanking();
  return { entries, position: entries.findIndex((item) => item.id === id) + 1 };
}
