export type GameSound = "gameStart" | "wrongClick" | "ticketFound";

// Add final sound files under public/games/find-ticket/ when the artwork is ready.
const SOUND_ASSETS: Partial<Record<GameSound, string>> = {};

export function playGameSound(event: GameSound) {
  const source = SOUND_ASSETS[event];
  if (!source || typeof window === "undefined") return;
  const sound = new Audio(source);
  void sound.play().catch(() => { /* playback may be blocked by the browser */ });
}
