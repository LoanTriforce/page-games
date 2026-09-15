"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { playGameSound } from "./audio";
import { formatTime, GAME_RULES, makeScene, pointsForItem, TARGETS, type SceneObject, type TargetId } from "./engine";
import { loadRanking, saveRanking, type RankingEntry } from "./ranking";

type Phase = "idle" | "playing" | "finished";
type Result = { remaining: number; score: number; position: number; completed: boolean; itemsFound: number };
const assetPrefix = process.env.NODE_ENV === "production" ? "/page-games" : "";

function Timer({ running, remainingRef, score }: { running: boolean; remainingRef: React.RefObject<number>; score: number }) {
  const [display, setDisplay] = useState<number>(GAME_RULES.roundMilliseconds);
  useEffect(() => {
    let frame = 0;
    if (!running) {
      frame = requestAnimationFrame(() => setDisplay(remainingRef.current));
      return () => cancelAnimationFrame(frame);
    }
    let previous = -1;
    const tick = () => {
      const tenth = Math.ceil(remainingRef.current / 100);
      if (tenth !== previous) { previous = tenth; setDisplay(remainingRef.current); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, remainingRef]);
  return <div className="ticket-timer-readout"><strong className="ticket-time" aria-label={`Tempo restante ${formatTime(display)}`}>{formatTime(display)}</strong><span>{score.toLocaleString("pt-BR")} pontos</span></div>;
}

function RankingBoard({ entries }: { entries: RankingEntry[] }) {
  return <section className="bag-ranking" aria-labelledby="bag-ranking-title">
    <div className="bag-ranking-head"><h2 id="bag-ranking-title">Ranking</h2><span>NESTE DISPOSITIVO</span></div>
    {entries.length ? <ol>{entries.map((entry, index) => <li key={entry.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{entry.name}</strong><b>{entry.score.toLocaleString("pt-BR")}</b><small>{formatTime(entry.time)}</small></li>)}</ol> : <p>Encontre todos os itens para entrar no ranking.</p>}
  </section>;
}

function Board({ scene, found, feedback, onTarget, onWrong }: { scene: SceneObject[]; found: Set<TargetId>; feedback: string; onTarget: (id: TargetId) => void; onWrong: (label: string) => void }) {
  return <div className="ticket-bag" aria-label="Bolsa aberta com os itens do checklist escondidos">
    <div className="ticket-bag-interior" style={{ backgroundImage: `url(${assetPrefix}/games/find-ticket/bag-pixel-v2.png)` }}>
      <button type="button" className="bag-tap-zone" aria-label="Procurar entre os objetos da bolsa" onClick={() => onWrong("Objeto fora do checklist")} />
      {scene.map((object) => {
        const isDecoy = object.id.startsWith("decoy");
        const id = isDecoy ? null : object.id as TargetId;
        if (id && found.has(id)) return null;
        const target = id ? TARGETS.find((item) => item.id === id) : null;
        return <button key={object.id} type="button" className="bag-sprite" style={{ left: `${object.x}%`, top: `${object.y}%`, width: `${object.width}%`, transform: `translate(-50%, -50%) rotate(${object.rotation}deg)` }} aria-label={isDecoy ? "Ingresso falso" : target!.label} onClick={() => isDecoy ? onWrong("Ingresso falso") : onTarget(id!)}><Image src={`${assetPrefix}/games/find-ticket/sprite-${isDecoy ? "decoy" : id}.png`} alt="" width={96} height={96} unoptimized draggable={false} /></button>;
      })}
      {feedback && <span className="ticket-penalty" role="status">{feedback}</span>}
    </div>
  </div>;
}

export function FindObjectsGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [scene, setScene] = useState<SceneObject[]>([]);
  const [found, setFound] = useState<Set<TargetId>>(new Set());
  const [feedback, setFeedback] = useState("");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [nickname, setNickname] = useState("Jogador");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const foundRef = useRef<Set<TargetId>>(new Set());
  const startRef = useRef(0);
  const penaltyRef = useRef(0);
  const remainingRef = useRef<number>(GAME_RULES.roundMilliseconds);
  const scoreRef = useRef(0);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setEntries(loadRanking());
      try { const saved = localStorage.getItem(GAME_RULES.playerKey); if (saved) setNickname(saved); } catch { /* storage may be unavailable */ }
    });
    return () => { cancelAnimationFrame(frame); if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current); };
  }, []);

  const finishTimeout = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    phaseRef.current = "finished";
    remainingRef.current = 0;
    setResult({ remaining: 0, score: scoreRef.current, position: 0, completed: false, itemsFound: foundRef.current.size });
    setPhase("finished");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    let frame = 0;
    const tick = () => {
      remainingRef.current = Math.max(0, GAME_RULES.roundMilliseconds - (performance.now() - startRef.current + penaltyRef.current));
      if (remainingRef.current === 0) { finishTimeout(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, finishTimeout]);

  const startGame = useCallback(() => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    phaseRef.current = "playing";
    foundRef.current = new Set();
    startRef.current = performance.now();
    penaltyRef.current = 0;
    remainingRef.current = GAME_RULES.roundMilliseconds;
    scoreRef.current = 0;
    setFound(new Set()); setScene(makeScene()); setFeedback(""); setResult(null); setScore(0); setPhase("playing");
    try { localStorage.setItem(GAME_RULES.playerKey, nickname.trim().slice(0, 18) || "Jogador"); } catch { /* storage may be unavailable */ }
    playGameSound("gameStart");
  }, [nickname]);

  const wrongClick = useCallback((label: string) => {
    if (phaseRef.current !== "playing") return;
    penaltyRef.current += GAME_RULES.wrongClickMilliseconds;
    remainingRef.current = Math.max(0, GAME_RULES.roundMilliseconds - (performance.now() - startRef.current + penaltyRef.current));
    if (remainingRef.current === 0) { finishTimeout(); return; }
    setFeedback(`${label}: -2s`);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setFeedback(""), 1100);
    playGameSound("wrongClick");
  }, [finishTimeout]);

  const findTarget = useCallback((id: TargetId) => {
    if (phaseRef.current !== "playing" || foundRef.current.has(id)) return;
    const remaining = Math.max(0, GAME_RULES.roundMilliseconds - (performance.now() - startRef.current + penaltyRef.current));
    remainingRef.current = remaining;
    if (remaining === 0) { finishTimeout(); return; }
    foundRef.current.add(id);
    setFound(new Set(foundRef.current));
    const gained = pointsForItem(remaining);
    scoreRef.current += gained;
    setScore(scoreRef.current);
    const label = TARGETS.find((item) => item.id === id)!.label;
    setFeedback(`${label} encontrado! +${gained} pontos`);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setFeedback(""), 1100);
    if (foundRef.current.size !== TARGETS.length) return;
    phaseRef.current = "finished";
    const time = GAME_RULES.roundMilliseconds - remaining;
    const saved = saveRanking({ id: crypto.randomUUID(), name: nickname.trim().slice(0, 18) || "Jogador", time, score: scoreRef.current, date: new Date().toISOString() });
    setEntries(saved.entries);
    setResult({ remaining, score: scoreRef.current, position: saved.position, completed: true, itemsFound: TARGETS.length });
    setPhase("finished");
    playGameSound("ticketFound");
  }, [finishTimeout, nickname]);

  return <section className="find-ticket-game bag-hunt-game">
    <div className="ticket-heading"><div><p className="ticket-eyebrow">PAGE GAMES / CAÇA AOS OBJETOS</p><h1>Encontre <span>tudo!</span></h1><p className="ticket-lead">Você tem 30 segundos para encontrar os seis itens do checklist dentro da bolsa.</p></div><div className="ticket-score-chip"><small>ITENS PARA ENCONTRAR</small><strong>{TARGETS.length}</strong></div></div>
    {phase === "idle" ? <div className="bag-intro-layout"><div className="ticket-intro"><div className="ticket-intro-art" aria-hidden="true"><span className="intro-bag">✦</span><Image className="bag-intro-sprite" src={`${assetPrefix}/games/find-ticket/sprite-ticket.png`} alt="" width={96} height={96} unoptimized /></div><p>Encontre todos os objetos em 30 segundos. Quanto mais cedo achar cada item, mais pontos ganha. Um toque errado tira dois segundos.</p><label className="bag-player-label">Seu nome no ranking<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={18} autoComplete="nickname" /></label><button className="ticket-primary" onClick={startGame}>Jogar <span aria-hidden="true">↗</span></button><small>O ingresso falso e os objetos de decoração podem enganar você.</small></div><RankingBoard entries={entries} /></div> : <>
      <div className="ticket-toolbar"><div><small>TEMPO RESTANTE E PONTUAÇÃO</small><Timer running={phase === "playing"} remainingRef={remainingRef} score={score} /></div><p>{found.size} de {TARGETS.length} encontrados</p><span className="ticket-live">{phase === "playing" ? "● PROCURE OS ITENS" : result?.completed ? "✓ CHECKLIST COMPLETO" : "● TEMPO ESGOTADO"}</span></div>
      <div className="ticket-scene-layout"><aside className="ticket-instruction-card"><p>DESAFIO PAGE</p><h2>ENCONTRE OS {TARGETS.length} ITENS!</h2><span>Observe bem a bolsa. Os primeiros acertos valem mais pontos.</span><hr/><small>ERROS CUSTAM -2 SEGUNDOS</small></aside><Board scene={scene} found={found} feedback={feedback} onTarget={findTarget} onWrong={wrongClick} /><aside className="ticket-checklist"><h2>CHECKLIST</h2><ul>{TARGETS.map((item) => <li key={item.id} className={found.has(item.id) ? "is-done" : ""}><span aria-hidden="true">{found.has(item.id) ? "☑" : "□"}</span>{item.label}</li>)}</ul><p aria-live="polite">{TARGETS.length - found.size} itens ainda faltam.</p></aside></div>
      <p className="ticket-board-note">Encontre todos antes que o tempo acabe. Toques errados tiram dois segundos.</p>
    </>}
    {phase === "finished" && result && <div className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="bag-result-title"><div className="ticket-modal-card"><div className="ticket-result-icon" aria-hidden="true">{result.completed ? "✓" : "⌛"}</div><p className="ticket-eyebrow">{result.completed ? "CHECKLIST CONCLUÍDO" : "FIM DA PARTIDA"}</p><h2 id="bag-result-title">{result.completed ? "PARABÉNS! VOCÊ ENCONTROU TUDO." : "TEMPO ESGOTADO!"}</h2><p>{result.completed ? `Concluiu com ${formatTime(result.remaining)} restantes.` : `Você encontrou ${result.itemsFound} de ${TARGETS.length} itens.`}</p><strong className="ticket-result-score">{result.score.toLocaleString("pt-BR")} pontos</strong>{result.completed ? <><p className="bag-promo-copy">Não perca tempo procurando ingressos na bolsa. Com a Page Eventos, você tem tudo dentro do seu celular.</p><span className="ticket-record-message">{result.position ? `${result.position}º lugar no ranking deste dispositivo` : "Continue jogando para entrar no top 10"}</span></> : <p>Procure os itens mais rápido para ganhar mais pontos e concluir o checklist.</p>}<div className="ticket-result-actions"><button className="ticket-primary" onClick={startGame}>Jogar novamente</button><a className="ticket-secondary" href={GAME_RULES.eventsUrl} target="_blank" rel="noopener noreferrer">Ver eventos da Page ↗</a></div><RankingBoard entries={entries} /></div></div>}
  </section>;
}
