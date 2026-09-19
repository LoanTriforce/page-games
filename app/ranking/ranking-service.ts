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

type ParticipantExportEntry = Pick<RankingEntry, "nome" | "telefone">;
type WorkbookFile = {
  name: string;
  content: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const rankingTable = process.env.NEXT_PUBLIC_WORD_SEARCH_RANKING_TABLE?.trim() || "word_search_rankings";
const MAX_ROUND_TIME_MS = 45_000;
const POINTS_PER_WORD = 100_000;
export const DUPLICATE_PARTICIPANT_MESSAGE = "Este nome ou telefone já foi registrado. Use credenciais ainda não utilizadas para participar.";
export const RANKING_POLL_INTERVAL_MS = 3_000;

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

export function isRankingConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ativar o ranking persistente.");
  }
  return { supabaseUrl, supabaseAnonKey, rankingTable };
}

function normalizeParticipantNameKey(name: string) {
  return sanitizePlayerName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export class DuplicateParticipantError extends Error {
  constructor() {
    super(DUPLICATE_PARTICIPANT_MESSAGE);
    this.name = "DuplicateParticipantError";
  }
}

export function isDuplicateParticipantError(error: unknown) {
  return error instanceof DuplicateParticipantError;
}

function getRankingEndpoint() {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id,nome,telefone,palavrasEncontradas:palavras_encontradas,totalPalavras:total_palavras,tempoResultadoMs:tempo_total_ms,pontuacao,dataInicio:data_inicio,dataFinalizacao:data_finalizacao",
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
  const safeWords = Math.max(0, Math.round(wordsFound));
  return `${formatWordCount(safeWords)} ${safeWords === 1 ? "encontrada" : "encontradas"} em ${formatRankingDuration(elapsedMs)}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function createZipArchive(files: WorkbookFile[]) {
  const localFileParts: Uint8Array[] = [];
  const centralDirectoryParts: Uint8Array[] = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const fileName = encodeUtf8(file.name);
    const data = encodeUtf8(file.content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + fileName.length);
    const localHeaderView = new DataView(localHeader.buffer);

    localHeaderView.setUint32(0, 0x04034b50, true);
    localHeaderView.setUint16(4, 20, true);
    localHeaderView.setUint16(6, 0x0800, true);
    localHeaderView.setUint16(8, 0, true);
    localHeaderView.setUint16(10, dosTime, true);
    localHeaderView.setUint16(12, dosDate, true);
    localHeaderView.setUint32(14, checksum, true);
    localHeaderView.setUint32(18, data.length, true);
    localHeaderView.setUint32(22, data.length, true);
    localHeaderView.setUint16(26, fileName.length, true);
    localHeader.set(fileName, 30);

    localFileParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralHeaderView = new DataView(centralHeader.buffer);

    centralHeaderView.setUint32(0, 0x02014b50, true);
    centralHeaderView.setUint16(4, 20, true);
    centralHeaderView.setUint16(6, 20, true);
    centralHeaderView.setUint16(8, 0x0800, true);
    centralHeaderView.setUint16(10, 0, true);
    centralHeaderView.setUint16(12, dosTime, true);
    centralHeaderView.setUint16(14, dosDate, true);
    centralHeaderView.setUint32(16, checksum, true);
    centralHeaderView.setUint32(20, data.length, true);
    centralHeaderView.setUint32(24, data.length, true);
    centralHeaderView.setUint16(28, fileName.length, true);
    centralHeaderView.setUint32(42, localOffset, true);
    centralHeader.set(fileName, 46);

    centralDirectoryParts.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const localFiles = concatUint8Arrays(localFileParts);
  const centralDirectory = concatUint8Arrays(centralDirectoryParts);
  const endOfCentralDirectory = new Uint8Array(22);
  const endOfCentralDirectoryView = new DataView(endOfCentralDirectory.buffer);

  endOfCentralDirectoryView.setUint32(0, 0x06054b50, true);
  endOfCentralDirectoryView.setUint16(8, files.length, true);
  endOfCentralDirectoryView.setUint16(10, files.length, true);
  endOfCentralDirectoryView.setUint32(12, centralDirectory.length, true);
  endOfCentralDirectoryView.setUint32(16, localFiles.length, true);

  return concatUint8Arrays([localFiles, centralDirectory, endOfCentralDirectory]);
}

function crc32(bytes: Uint8Array) {
  let checksum = 0xffffffff;

  for (const byte of bytes) {
    checksum = (checksum >>> 8) ^ CRC32_TABLE[(checksum ^ byte) & 0xff];
  }

  return (checksum ^ 0xffffffff) >>> 0;
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function spreadsheetCell(reference: string, value: string) {
  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function createParticipantsWorksheet(participants: ParticipantExportEntry[]) {
  const rows = [
    ["Nome", "Telefone"],
    ...participants.map((participant) => [participant.nome, participant.telefone ?? ""]),
  ];

  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      return `<row r="${rowNumber}">${spreadsheetCell(`A${rowNumber}`, row[0])}${spreadsheetCell(`B${rowNumber}`, row[1])}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:B${rows.length}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/></cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function createParticipantsWorkbook(participants: ParticipantExportEntry[]) {
  return createZipArchive([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Participantes" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: createParticipantsWorksheet(participants),
    },
  ]);
}

export function downloadParticipantsSpreadsheet(participants: ParticipantExportEntry[]) {
  const workbook = createParticipantsWorkbook(participants);
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([workbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `participantes-caca-palavras-${today}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
  const telefone = typeof item.telefone === "string" ? item.telefone : "";

  if (!id || !nome || !Number.isFinite(palavrasEncontradas) || !Number.isFinite(totalPalavras) || !Number.isFinite(tempoResultadoMs) || !Number.isFinite(pontuacao) || !dataInicio || !dataFinalizacao) return null;
  if (palavrasEncontradas < 0 || totalPalavras < 1 || palavrasEncontradas > totalPalavras || tempoResultadoMs < 0 || pontuacao < 0) return null;

  return { id, nome, telefone, palavrasEncontradas, totalPalavras, tempoResultadoMs, pontuacao, dataInicio, dataFinalizacao };
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

export async function hasRegisteredParticipant(name: string, phone: string) {
  const nome = sanitizePlayerName(name);
  const telefone = normalizePhone(phone);

  if (!nome || !isValidBrazilianPhone(telefone)) return false;

  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "nome,telefone",
  });
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.rankingTable}?${params}`, {
    headers: {
      ...getSupabaseHeaders(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível verificar o cadastro do participante.");

  const payload = await response.json();
  const registeredParticipants = Array.isArray(payload) ? payload : [];
  const participantKey = normalizeParticipantNameKey(nome);

  return registeredParticipants.some((entry) => {
    if (!entry || typeof entry !== "object") return false;

    const registeredParticipant = entry as { nome?: unknown; telefone?: unknown };
    const registeredName = registeredParticipant.nome;
    const registeredPhone = registeredParticipant.telefone;
    const hasSameName = typeof registeredName === "string" && normalizeParticipantNameKey(registeredName) === participantKey;
    const hasSamePhone = typeof registeredPhone === "string" && normalizePhone(registeredPhone) === telefone;

    return hasSameName || hasSamePhone;
  });
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

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: string; message?: string; details?: string } | null;
    const details = `${payload?.code ?? ""} ${payload?.message ?? ""} ${payload?.details ?? ""}`;

    if (response.status === 409 && (details.includes("word_search_rankings_participant_duplicate_guard") || details.includes("word_search_rankings_participant_name_unique_idx") || details.includes("word_search_rankings_participant_phone_unique_idx") || details.includes("word_search_rankings_participant_unique_idx"))) {
      throw new DuplicateParticipantError();
    }

    throw new Error("Não foi possível enviar o resultado para o ranking.");
  }
}
