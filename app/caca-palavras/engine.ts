export const SIZE = 10;
export const DURATION = 45_000;

export type Word = { text: string; label: string; product: string };
export type Direction = readonly [number, number];
export type Placement = Word & { cells: number[]; direction: Direction };
export type Puzzle = { grid: string[]; words: Word[]; placements: Placement[] };

export const wordPool: Word[] = [
  { text: "CITY", label: "City", product: "PAGE City" },
  { text: "EVENTOS", label: "Eventos", product: "PAGE Eventos" },
  { text: "MOVE", label: "Move", product: "PAGE Move" },
  { text: "ENTREGA", label: "Entrega", product: "PAGE Move" },
  { text: "SERVICOS", label: "Serviços", product: "PAGE Serviços" },
  { text: "CIDADE", label: "Cidade", product: "PAGE City" },
  { text: "INGRESSO", label: "Ingresso", product: "PAGE Eventos" },
  { text: "CHECKIN", label: "Check-in", product: "PAGE Eventos" },
  { text: "AGENDA", label: "Agenda", product: "PAGE Serviços" },
  { text: "CONSULTA", label: "Consulta", product: "PAGE Serviços" },
  { text: "CORRIDA", label: "Corrida", product: "PAGE Move" },
  { text: "PAGAMENTO", label: "Pagamento", product: "PAGE Serviços" },
  { text: "PULSEIRA", label: "Pulseira", product: "PAGE Eventos" },
  { text: "CONECTA", label: "Conecta", product: "Grupo PAGE" },
];

export const directions: Direction[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
];

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const isReverse = ([dr, dc]: Direction) => dr < 0 || dc < 0;
const isDiagonal = ([dr, dc]: Direction) => Math.abs(dr) === 1 && Math.abs(dc) === 1;
const isHorizontal = ([dr]: Direction) => dr === 0;
const isVertical = ([dr, dc]: Direction) => dc === 0 && dr !== 0;

export function shuffle<T>(items: readonly T[], random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generate(random = Math.random): Puzzle {
  const words = shuffle(wordPool, random).slice(0, 6);
  for (let attempt = 0; attempt < 400; attempt++) {
    const grid = Array<string>(SIZE * SIZE).fill("");
    const placements: Placement[] = [];

    for (const word of [...words].sort((a, b) => b.text.length - a.text.length)) {
      const candidates: Array<{ cells: number[]; direction: Direction }> = [];
      for (const [dr, dc] of shuffle(directions, random)) {
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const endR = r + dr * (word.text.length - 1);
            const endC = c + dc * (word.text.length - 1);
            if (endR < 0 || endR >= SIZE || endC < 0 || endC >= SIZE) continue;
            const cells = Array.from(word.text, (_, i) => (r + dr * i) * SIZE + c + dc * i);
            if (cells.every((idx, i) => !grid[idx] || grid[idx] === word.text[i])) {
              candidates.push({ cells, direction: [dr, dc] });
            }
          }
        }
      }
      if (!candidates.length) break;
      const picked = candidates[Math.floor(random() * candidates.length)];
      picked.cells.forEach((idx, i) => {
        grid[idx] = word.text[i];
      });
      placements.push({ ...word, cells: picked.cells, direction: picked.direction });
    }

    if (placements.length !== words.length) continue;
    const placedDirections = placements.map((word) => word.direction);
    if (
      !placedDirections.some(isReverse) ||
      !placedDirections.some(isDiagonal) ||
      !placedDirections.some(isHorizontal) ||
      !placedDirections.some(isVertical)
    ) continue;

    return {
      grid: grid.map((letter) => letter || alphabet[Math.floor(random() * alphabet.length)]),
      words,
      placements,
    };
  }
  throw new Error("Não foi possível criar a grade. Tente novamente.");
}

export function path(first: number | null, last: number | null) {
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(last) ||
    first === null ||
    last === null ||
    first < 0 ||
    last < 0 ||
    first >= 100 ||
    last >= 100
  ) return [];
  const ar = Math.floor(first / SIZE);
  const ac = first % SIZE;
  const br = Math.floor(last / SIZE);
  const bc = last % SIZE;
  const dr = br - ar;
  const dc = bc - ac;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return [];
  const total = Math.max(Math.abs(dr), Math.abs(dc));
  return Array.from({ length: total + 1 }, (_, i) => (ar + Math.sign(dr) * i) * SIZE + ac + Math.sign(dc) * i);
}

export function match(grid: string[], cells: number[], words: Word[], found: ReadonlySet<string>) {
  const text = cells.map((idx) => grid[idx]).join("");
  const reversed = [...text].reverse().join("");
  return words.find((word) => !found.has(word.text) && (word.text === text || word.text === reversed));
}

export function remaining(deadline: number, now: number) {
  return Math.max(0, Math.min(DURATION, deadline - now));
}
