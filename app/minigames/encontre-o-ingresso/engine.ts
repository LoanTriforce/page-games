export const GAME_RULES = {
  roundMilliseconds: 30000,
  pointsPerItem: 200,
  pointsPerSecondRemaining: 30,
  wrongClickMilliseconds: 2000,
  rankingKey: "page-games-bag-ranking-v2",
  playerKey: "page-games-bag-player",
  eventsUrl: "https://pageeventos.com.br/",
} as const;

export const TARGETS = [
  { id: "phone", label: "Celular", width: 14 },
  { id: "wallet", label: "Carteira", width: 12 },
  { id: "keys", label: "Chaves", width: 11 },
  { id: "camera", label: "Câmera", width: 14 },
  { id: "earbuds", label: "Fones", width: 11 },
  { id: "ticket", label: "Ingresso Page", width: 12 },
] as const;

export type TargetId = (typeof TARGETS)[number]["id"];
export type SceneObject = {
  id: TargetId | "decoy-1" | "decoy-2";
  x: number;
  y: number;
  rotation: number;
  width: number;
};

const LAYOUTS = [
  [
    [18, 27],
    [40, 20],
    [68, 24],
    [29, 53],
    [70, 53],
    [46, 75],
  ],
  [
    [73, 28],
    [24, 22],
    [48, 35],
    [78, 67],
    [29, 65],
    [53, 72],
  ],
  [
    [25, 43],
    [72, 20],
    [52, 64],
    [39, 21],
    [78, 48],
    [27, 76],
  ],
] as const;

export function makeScene(random = Math.random): SceneObject[] {
  const layout = LAYOUTS[Math.floor(random() * LAYOUTS.length)];
  const targets: SceneObject[] = TARGETS.map((target, index) => {
    const [baseX, baseY] = layout[index];
    return {
      id: target.id,
      x: Math.max(10, Math.min(90, baseX + (random() - 0.5) * 5)),
      y: Math.max(16, Math.min(83, baseY + (random() - 0.5) * 5)),
      rotation: Math.round((random() - 0.5) * 34),
      width: target.width,
    };
  });
  const decoys: SceneObject[] = [
    { id: "decoy-1", x: 86, y: 39, rotation: -16, width: 10 },
    { id: "decoy-2", x: 14, y: 70, rotation: 15, width: 10 },
  ];
  return [...targets, ...decoys];
}

export function pointsForItem(millisecondsRemaining: number) {
  return (
    GAME_RULES.pointsPerItem +
    Math.round(
      (Math.max(0, millisecondsRemaining) / 1000) *
        GAME_RULES.pointsPerSecondRemaining,
    )
  );
}

export function formatTime(milliseconds: number) {
  const tenths = Math.floor(milliseconds / 100);
  return `${String(Math.floor(tenths / 600)).padStart(2, "0")}:${String(Math.floor(tenths / 10) % 60).padStart(2, "0")}.${tenths % 10}`;
}
