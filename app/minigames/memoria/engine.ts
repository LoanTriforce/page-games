export const DURATION = 60_000;
export const symbols = [
  { emoji: "🎟️", label: "Ingresso" }, { emoji: "🧍", label: "Fila" },
  { emoji: "👮", label: "Segurança" }, { emoji: "🎤", label: "Microfone" },
  { emoji: "🎧", label: "DJ" }, { emoji: "🎉", label: "Confete" },
  { emoji: "🎈", label: "Balão" }, { emoji: "🪩", label: "Globo de festa" },
  { emoji: "🎸", label: "Guitarra" }, { emoji: "🎂", label: "Bolo" },
  { emoji: "📸", label: "Fotografia" }, { emoji: "🎭", label: "Espetáculo" },
];
export type Card = { id: number; symbol: number };
export type Round = {
  cards: Card[]; selected: number[]; matched: number[];
  startedAt: number; now: number; hideAt: number | null;
  score: number; ended: boolean;
};
export function createRound(now: number, random = Math.random): Round {
  const cards = symbols.flatMap((_, symbol) => [{ id: symbol * 2, symbol }, { id: symbol * 2 + 1, symbol }]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, selected: [], matched: [], startedAt: now, now, hideAt: null, score: 0, ended: false };
}
// Every match awards 100 points plus up to 60 points for speed.
export function pairScore(elapsed: number) {
  return 100 + Math.max(0, Math.ceil((DURATION - Math.max(0, elapsed)) / 1000));
}
export function tick(round: Round, now: number): Round {
  if (round.ended) return round;
  const ended = now - round.startedAt >= DURATION;
  const hide = ended || (round.hideAt !== null && now >= round.hideAt);
  return { ...round, now: Math.min(now, round.startedAt + DURATION), ended,
    selected: hide ? [] : round.selected, hideAt: hide ? null : round.hideAt };
}
export function flip(round: Round, id: number, now: number): Round {
  const current = tick(round, now);
  if (current.ended || current.selected.length === 2 || current.selected.includes(id) || current.matched.includes(id)) return current;
  const card = current.cards.find((item) => item.id === id);
  if (!card) return current;
  const selected = [...current.selected, id];
  if (selected.length === 1) return { ...current, selected };
  const first = current.cards.find((item) => item.id === selected[0]);
  if (first?.symbol !== card.symbol) return { ...current, selected, hideAt: now + 800 };
  const matched = [...current.matched, ...selected];
  return { ...current, matched, selected: [], hideAt: null,
    score: current.score + pairScore(now - current.startedAt), ended: matched.length === 24 };
}
