export type ProductName = "Page Eventos" | "Page Serviços" | "Page Move" | "Page City";

export type BubbleClickDetail = {
  product: ProductName;
  clickedAtMs: number;
};

export type BubblesRankingEntry = {
  id: string;
  name: string;
  phone: string;
  bubblesClicked: number;
  elapsedMs: number;
  averageClickMs: number;
  score: number;
  clickDetails: BubbleClickDetail[];
  createdAt: string;
};

type WorkbookFile = {
  name: string;
  content: string;
};

type SaveBubblesResultResponse = {
  entries: BubblesRankingEntry[];
  position: number;
  saved: boolean;
};

export const BUBBLES_PRODUCTS: ProductName[] = ["Page Eventos", "Page Serviços", "Page Move", "Page City"];
export const BUBBLES_ROUND_DURATION_MS = 60_000;
export const BUBBLES_PLAYER_STORAGE_KEY = "page_bolinhas_player";
export const BUBBLES_RANKING_POLL_INTERVAL_MS = 3_000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const bubblesRankingTable = process.env.NEXT_PUBLIC_BUBBLES_RANKING_TABLE?.trim() || "bubbles_rankings";
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

export function isBubblesRankingConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para ativar o ranking geral.");
  }

  return { supabaseUrl, supabaseAnonKey, bubblesRankingTable };
}

function getBubblesRankingEndpoint() {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id,name:nome,phone:telefone,bubblesClicked:bolinhas_clicadas,elapsedMs:tempo_total_ms,averageClickMs:tempo_medio_ms,score:pontuacao,clickDetails:detalhes_cliques,createdAt:criado_em",
    order: "bolinhas_clicadas.desc,tempo_total_ms.asc,pontuacao.desc,criado_em.asc",
  });

  return `${config.supabaseUrl}/rest/v1/${config.bubblesRankingTable}?${params}`;
}

function getSupabaseHeaders() {
  const config = getSupabaseConfig();

  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };
}

export function sanitizeBubblesName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function normalizeBubblesPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutCountryCode = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return withoutCountryCode.slice(0, 11);
}

export function isValidBubblesPhone(phone: string) {
  return /^\d{10,11}$/.test(phone) && /^[1-9]{2}/.test(phone);
}

export function formatBubblesDuration(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const seconds = safeMs / 1000;
  const hasTenths = safeMs % 1000 !== 0;

  return `${seconds.toLocaleString("pt-BR", {
    minimumFractionDigits: hasTenths ? 1 : 0,
    maximumFractionDigits: hasTenths ? 1 : 0,
  })}s`;
}

export function formatBubblesDate(isoDate: string) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calculateBubblesScore(clickTimes: number[]) {
  const clicks = clickTimes.length;
  const elapsedMs = getBubblesElapsedMs(clickTimes);
  const timeBonus = clicks > 0 ? Math.max(0, BUBBLES_ROUND_DURATION_MS - elapsedMs) : 0;
  const speedBonus = clicks > 0 ? Math.round((clicks * BUBBLES_ROUND_DURATION_MS) / Math.max(1000, elapsedMs)) : 0;

  return Math.max(0, clicks * 100_000 + timeBonus + speedBonus * 250);
}

export function getBubblesElapsedMs(clickTimes: number[]) {
  if (clickTimes.length === 0) return BUBBLES_ROUND_DURATION_MS;
  return Math.max(0, Math.min(BUBBLES_ROUND_DURATION_MS, Math.round(clickTimes[clickTimes.length - 1])));
}

export function getAverageClickMs(clickTimes: number[]) {
  if (clickTimes.length === 0) return BUBBLES_ROUND_DURATION_MS;
  return Math.max(0, Math.round(getBubblesElapsedMs(clickTimes) / clickTimes.length));
}

export function formatBubblesResult(entry: Pick<BubblesRankingEntry, "name" | "bubblesClicked" | "elapsedMs">) {
  const label = entry.bubblesClicked === 1 ? "bolinha" : "bolinhas";
  return `${entry.name} - ${entry.bubblesClicked} ${label} em ${formatBubblesDuration(entry.elapsedMs)}`;
}

export function sortBubblesRanking(entries: BubblesRankingEntry[]) {
  return [...entries].sort((a, b) => {
    if (b.bubblesClicked !== a.bubblesClicked) return b.bubblesClicked - a.bubblesClicked;
    if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function loadBubblesRanking() {
  const response = await fetch(getBubblesRankingEndpoint(), {
    headers: {
      ...getSupabaseHeaders(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível carregar o ranking geral de Bolinhas Page.");
  return normalizeBubblesPayload(await response.json());
}

export async function saveBubblesResult(input: {
  id: string;
  name: string;
  phone: string;
  clickDetails: BubbleClickDetail[];
  createdAt: string;
}): Promise<SaveBubblesResultResponse> {
  const id = input.id.trim() || crypto.randomUUID();
  const name = sanitizeBubblesName(input.name);
  const phone = normalizeBubblesPhone(input.phone);
  const clickDetails = normalizeClickDetails(input.clickDetails);
  const clickTimes = clickDetails.map((detail) => detail.clickedAtMs);
  const bubblesClicked = clickDetails.length;
  const elapsedMs = getBubblesElapsedMs(clickTimes);
  const averageClickMs = getAverageClickMs(clickTimes);
  const score = calculateBubblesScore(clickTimes);

  if (!name) throw new Error("Informe o nome do participante antes de iniciar.");
  if (!isValidBubblesPhone(phone)) throw new Error("Informe um telefone brasileiro válido.");
  if (bubblesClicked === 0) return { entries: await loadBubblesRanking(), position: 0, saved: false };

  const config = getSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.bubblesRankingTable}`, {
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
      telefone: phone,
      bolinhas_clicadas: bubblesClicked,
      tempo_total_ms: elapsedMs,
      tempo_medio_ms: averageClickMs,
      pontuacao: score,
      detalhes_cliques: clickDetails,
      criado_em: input.createdAt,
    }),
  });

  if (!response.ok && response.status !== 409) throw new Error("Não foi possível salvar o resultado no ranking geral.");

  const entries = await loadBubblesRanking();
  return { entries, position: entries.findIndex((entry) => entry.id === id) + 1, saved: response.ok };
}

export function saveBubblesPlayer(name: string, phone: string) {
  window.localStorage.setItem(BUBBLES_PLAYER_STORAGE_KEY, JSON.stringify({
    name: sanitizeBubblesName(name),
    phone: normalizeBubblesPhone(phone),
  }));
}

export function loadBubblesPlayer() {
  if (typeof window === "undefined") return { name: "", phone: "" };

  try {
    const rawPlayer = window.localStorage.getItem(BUBBLES_PLAYER_STORAGE_KEY);
    const parsed = rawPlayer ? JSON.parse(rawPlayer) : null;

    return {
      name: typeof parsed?.name === "string" ? parsed.name : "",
      phone: typeof parsed?.phone === "string" ? parsed.phone : "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

export function downloadBubblesRankingSpreadsheet(entries: BubblesRankingEntry[]) {
  const ranking = sortBubblesRanking(entries);
  const workbook = createBubblesWorkbook(ranking);
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([workbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ranking-bolinhas-page-${today}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function normalizeBubblesPayload(payload: unknown) {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return sortBubblesRanking(list.map(normalizeBubblesEntry).filter((entry): entry is BubblesRankingEntry => entry !== null));
}

function normalizeBubblesEntry(value: unknown): BubblesRankingEntry | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Partial<BubblesRankingEntry> & {
    nome?: unknown;
    telefone?: unknown;
    bolinhas_clicadas?: unknown;
    tempo_total_ms?: unknown;
    tempo_medio_ms?: unknown;
    pontuacao?: unknown;
    detalhes_cliques?: unknown;
    criado_em?: unknown;
  };
  const name = typeof item.name === "string" ? sanitizeBubblesName(item.name) : typeof item.nome === "string" ? sanitizeBubblesName(item.nome) : "";
  const phone = typeof item.phone === "string" ? item.phone : typeof item.telefone === "string" ? item.telefone : "";
  const bubblesClicked = Number(item.bubblesClicked ?? item.bolinhas_clicadas);
  const elapsedMs = Number(item.elapsedMs ?? item.tempo_total_ms);
  const averageClickMs = Number(item.averageClickMs ?? item.tempo_medio_ms);
  const score = Number(item.score ?? item.pontuacao);
  const rawDetails = Array.isArray(item.clickDetails) ? item.clickDetails : Array.isArray(item.detalhes_cliques) ? item.detalhes_cliques : [];
  const clickDetails = normalizeClickDetails(rawDetails);
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : typeof item.criado_em === "string" ? item.criado_em : "";
  const id = typeof item.id === "string" && item.id.trim() ? item.id : `${name}-${createdAt}-${bubblesClicked}`;

  if (!id || !name || !Number.isFinite(bubblesClicked) || !Number.isFinite(elapsedMs) || !Number.isFinite(averageClickMs) || !Number.isFinite(score) || !createdAt) return null;
  if (bubblesClicked < 1 || elapsedMs < 0 || elapsedMs > BUBBLES_ROUND_DURATION_MS || score < 0) return null;

  return {
    id,
    name,
    phone,
    bubblesClicked: Math.round(bubblesClicked),
    elapsedMs: Math.round(elapsedMs),
    averageClickMs: Math.round(averageClickMs),
    score: Math.round(score),
    clickDetails,
    createdAt,
  };
}

function normalizeClickDetails(details: unknown[]) {
  return details
    .map((detail) => {
      const item = detail as Partial<BubbleClickDetail> & { product?: unknown; clickedAtMs?: unknown; produto?: unknown; clicked_at_ms?: unknown };
      const rawProduct = item.product ?? item.produto;
      const product = BUBBLES_PRODUCTS.includes(rawProduct as ProductName) ? rawProduct as ProductName : null;
      const clickedAtMs = Math.max(0, Math.min(BUBBLES_ROUND_DURATION_MS, Math.round(Number(item.clickedAtMs ?? item.clicked_at_ms))));

      return product && Number.isFinite(clickedAtMs) ? { product, clickedAtMs } : null;
    })
    .filter((detail): detail is BubbleClickDetail => detail !== null)
    .sort((a, b) => a.clickedAtMs - b.clickedAtMs);
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

function createBubblesWorksheet(entries: BubblesRankingEntry[]) {
  const rows = [
    ["Posição", "Nome", "Telefone", "Bolinhas clicadas", "Tempo total", "Pontuação", "Data/hora"],
    ...entries.map((entry, index) => [
      String(index + 1),
      entry.name,
      entry.phone,
      String(entry.bubblesClicked),
      formatBubblesDuration(entry.elapsedMs),
      String(entry.score),
      formatBubblesDate(entry.createdAt),
    ]),
  ];

  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      return `<row r="${rowNumber}">${row.map((cell, cellIndex) => spreadsheetCell(`${String.fromCharCode(65 + cellIndex)}${rowNumber}`, cell)).join("")}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:G${rows.length}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols><col min="1" max="1" width="10" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="18" customWidth="1"/><col min="5" max="5" width="14" customWidth="1"/><col min="6" max="6" width="16" customWidth="1"/><col min="7" max="7" width="22" customWidth="1"/></cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function createBubblesWorkbook(entries: BubblesRankingEntry[]) {
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
  <sheets><sheet name="Ranking Bolinhas" sheetId="1" r:id="rId1"/></sheets>
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
      content: createBubblesWorksheet(entries),
    },
  ]);
}
