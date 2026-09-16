"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BUBBLES_PRODUCTS,
  BUBBLES_RANKING_POLL_INTERVAL_MS,
  BUBBLES_ROUND_DURATION_MS,
  calculateBubblesScore,
  downloadBubblesRankingSpreadsheet,
  formatBubblesDuration,
  getAverageClickMs,
  getBubblesElapsedMs,
  isBubblesRankingConfigured,
  isValidBubblesPhone,
  loadBubblesPlayer,
  loadBubblesRanking,
  saveBubblesPlayer,
  saveBubblesResult,
  sanitizeBubblesName,
  type BubbleClickDetail,
  type BubblesRankingEntry,
  type ProductName,
} from "./bolinhas-ranking-service";

type GamePhase = "idle" | "playing" | "finished";
type Bubble = {
  id: string;
  product: ProductName;
  x: number;
  y: number;
  size: number;
  color: string;
};
type RoundResult = {
  saved: boolean;
  position: number;
  bubblesClicked: number;
  elapsedMs: number;
  averageClickMs: number;
  score: number;
};

const BUBBLE_COLORS = ["#caff35", "#8b7fe8", "#ffb84d", "#50e3c2", "#ff77b7", "#73a7ff"];

function makeBubble(): Bubble {
  return {
    id: crypto.randomUUID(),
    product: BUBBLES_PRODUCTS[Math.floor(Math.random() * BUBBLES_PRODUCTS.length)],
    x: 8 + Math.random() * 84,
    y: 10 + Math.random() * 78,
    size: 104 + Math.round(Math.random() * 64),
    color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
  };
}

function repositionBubble(bubble: Bubble): Bubble {
  return {
    ...bubble,
    id: crypto.randomUUID(),
    product: BUBBLES_PRODUCTS[Math.floor(Math.random() * BUBBLES_PRODUCTS.length)],
    x: 8 + Math.random() * 84,
    y: 10 + Math.random() * 78,
    size: 104 + Math.round(Math.random() * 64),
    color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
  };
}

function formatTimer(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function BubblesGame() {
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ranking, setRanking] = useState<BubblesRankingEntry[]>([]);
  const [rankingStatus, setRankingStatus] = useState<"loading" | "ready" | "error" | "unconfigured">(
    isBubblesRankingConfigured() ? "loading" : "unconfigured",
  );
  const [bubble, setBubble] = useState<Bubble>(() => makeBubble());
  const [remainingMs, setRemainingMs] = useState(BUBBLES_ROUND_DURATION_MS);
  const [clickDetails, setClickDetails] = useState<BubbleClickDetail[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const phaseRef = useRef<GamePhase>("idle");
  const startTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const clickDetailsRef = useRef<BubbleClickDetail[]>([]);
  const finishedRef = useRef(false);

  const clickTimes = useMemo(() => clickDetails.map((detail) => detail.clickedAtMs), [clickDetails]);
  const score = calculateBubblesScore(clickTimes);
  const elapsedMs = getBubblesElapsedMs(clickTimes);
  const refreshRanking = useCallback(async () => {
    if (!isBubblesRankingConfigured()) {
      setRankingStatus("unconfigured");
      return [];
    }

    try {
      const nextRanking = await loadBubblesRanking();
      setRanking(nextRanking);
      setRankingStatus("ready");
      return nextRanking;
    } catch {
      setRankingStatus("error");
      return [];
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void refreshRanking();
      const savedPlayer = loadBubblesPlayer();
      setName(savedPlayer.name);
      setPhone(savedPlayer.phone);
    });
    const interval = window.setInterval(() => {
      void refreshRanking();
    }, BUBBLES_RANKING_POLL_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [refreshRanking]);

  const finishRound = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    phaseRef.current = "finished";
    setPhase("finished");
    setRemainingMs(0);

    const details = clickDetailsRef.current;
    const times = details.map((detail) => detail.clickedAtMs);
    const finalResult = {
      saved: false,
      position: 0,
      bubblesClicked: details.length,
      elapsedMs: getBubblesElapsedMs(times),
      averageClickMs: getAverageClickMs(times),
      score: calculateBubblesScore(times),
    };

    if (details.length > 0) {
      try {
        const saved = await saveBubblesResult({
          id: crypto.randomUUID(),
          name,
          phone,
          clickDetails: details,
          createdAt: new Date().toISOString(),
        });
        setRanking(saved.entries);
        setRankingStatus("ready");
        finalResult.saved = saved.saved;
        finalResult.position = saved.position;
      } catch {
        setRankingStatus("error");
        setMessage("Rodada finalizada, mas não foi possível salvar no ranking geral.");
      }
    }

    setResult(finalResult);
    setMessage((currentMessage) => currentMessage || (details.length > 0 ? "Resultado salvo no ranking geral." : "Nenhuma bolinha clicada. Resultado não entrou no ranking."));
  }, [name, phone]);

  useEffect(() => {
    if (phase !== "playing") return;

    let frame = 0;
    const tick = (now: number) => {
      currentTimeRef.current = now;
      const remaining = Math.max(0, BUBBLES_ROUND_DURATION_MS - (now - startTimeRef.current));

      setRemainingMs(remaining);
      if (remaining <= 0) {
        finishRound();
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, finishRound]);

  async function startGame() {
    const cleanName = sanitizeBubblesName(name);
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError("Informe o nome do participante.");
      return;
    }
    if (!isValidBubblesPhone(cleanPhone)) {
      setError("Informe um telefone com DDD contendo apenas números, com 10 ou 11 dígitos. Ex: 34999999999.");
      return;
    }

    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }

    saveBubblesPlayer(cleanName, cleanPhone);
    setName(cleanName);
    setPhone(cleanPhone);
    setError("");
    setMessage("");
    setResult(null);
    setClickDetails([]);
    clickDetailsRef.current = [];
    finishedRef.current = false;
    startTimeRef.current = performance.now();
    currentTimeRef.current = startTimeRef.current;
    phaseRef.current = "playing";
    setRemainingMs(BUBBLES_ROUND_DURATION_MS);
    setBubble(makeBubble());
    setPhase("playing");
  }

  function prepareNewRound() {
    phaseRef.current = "idle";
    finishedRef.current = false;
    clickDetailsRef.current = [];
    setClickDetails([]);
    setResult(null);
    setMessage("");
    setError("");
    setRemainingMs(BUBBLES_ROUND_DURATION_MS);
    setBubble(makeBubble());
    setPhase("idle");
  }

  function clickBubble() {
    if (phaseRef.current !== "playing") return;

    const clickedAtMs = Math.min(BUBBLES_ROUND_DURATION_MS, Math.max(0, currentTimeRef.current - startTimeRef.current));
    if (clickedAtMs >= BUBBLES_ROUND_DURATION_MS) {
      finishRound();
      return;
    }

    const nextDetail = { product: bubble.product, clickedAtMs: Math.round(clickedAtMs) };
    const nextDetails = [...clickDetailsRef.current, nextDetail];
    clickDetailsRef.current = nextDetails;
    setClickDetails(nextDetails);
    setBubble((current) => repositionBubble(current));
  }

  function handleExportRanking() {
    if (ranking.length === 0) {
      setMessage("Não existem participantes para exportar.");
      return;
    }

    downloadBubblesRankingSpreadsheet(ranking);
    setMessage("Exportação do ranking iniciada.");
  }

  return (
    <section className="bubbles-game" aria-labelledby="bubbles-title">
      <div className="bubbles-hero">
        <div>
          <p className="bubbles-eyebrow">Grupo Page / desafio de produtos</p>
          <h1 id="bubbles-title">Bolinhas Page</h1>
          <p>Clique no maior número de bolinhas em 30 segundos. Quem fizer mais acertos em menos tempo fica no topo.</p>
        </div>
        <div className="bubbles-live-card" aria-live="polite">
          <span>Tempo</span>
          <strong>{formatTimer(remainingMs)}</strong>
          <small>{phase === "playing" ? "Rodada em andamento" : "Pronto para jogar"}</small>
        </div>
      </div>

      <div className="bubbles-stats" aria-label="Informações da rodada">
        <div><span>Participante</span><strong>{name || "Aguardando"}</strong></div>
        <div><span>Bolinhas clicadas</span><strong>{clickDetails.length}</strong></div>
        <div><span>Pontuação</span><strong>{score.toLocaleString("pt-BR")}</strong></div>
        <div><span>Tempo até último clique</span><strong>{clickDetails.length ? formatBubblesDuration(elapsedMs) : "0s"}</strong></div>
      </div>

      {phase !== "playing" && (
        <div className="bubbles-start-panel">
          <div>
            <h2>{phase === "finished" ? "Nova rodada" : "Identifique o participante"}</h2>
            <p>Nome e telefone são solicitados antes de cada rodada para registrar o ranking geral do evento.</p>
          </div>
          <label>Nome do participante<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="name" /></label>
          <label>Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="numeric" maxLength={11} autoComplete="tel" pattern="[0-9]*" placeholder="Telefone com DDD. Ex: 34999999999" /></label>
          {error && <p className="bubbles-error" role="alert">{error}</p>}
          <button className="bubbles-primary" onClick={startGame} type="button">Iniciar jogo</button>
        </div>
      )}

      <div className="bubbles-actions" aria-label="Controles do jogo">
        <button className="bubbles-secondary" onClick={prepareNewRound} type="button">Nova rodada</button>
        <Link className="bubbles-secondary" href="/minigames/bolinhas-page/ranking">Ver ranking</Link>
        <button className="bubbles-secondary" onClick={handleExportRanking} type="button">Exportar Excel</button>
      </div>

      {message && <p className="bubbles-message" role="status">{message}</p>}
      {rankingStatus === "unconfigured" && <p className="bubbles-message" role="status">Configure o Supabase para ativar o ranking geral.</p>}
      {rankingStatus === "error" && <p className="bubbles-message" role="status">Não foi possível atualizar o ranking geral agora.</p>}

      <div className="bubbles-arena" aria-label="Área do jogo com bolinhas pulando">
        <div className="bubbles-arena-grid" aria-hidden="true" />
        <button
          aria-label={`Clicar em ${bubble.product}`}
          className="bubbles-ball"
          disabled={phase !== "playing"}
          key={bubble.id}
          onClick={clickBubble}
          style={{
            "--bubble-color": bubble.color,
            "--bubble-size": `${bubble.size}px`,
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
          } as CSSProperties}
          type="button"
        >
          <span>{bubble.product}</span>
        </button>
        {phase !== "playing" && <div className="bubbles-arena-cover">Clique em <strong>Iniciar jogo</strong> para liberar as bolinhas.</div>}
      </div>

      {result && (
        <section className="bubbles-result" aria-label="Resultado da rodada">
          <p>Resultado final</p>
          <h2>{result.bubblesClicked} {result.bubblesClicked === 1 ? "bolinha" : "bolinhas"} em {formatBubblesDuration(result.elapsedMs)}</h2>
          <strong>{result.score.toLocaleString("pt-BR")} pts</strong>
          <span>Velocidade média: {formatBubblesDuration(result.averageClickMs)} por clique</span>
          {result.saved ? <small>{result.position}º lugar no ranking geral</small> : <small>Faça pelo menos um clique para registrar no ranking.</small>}
        </section>
      )}
    </section>
  );
}
