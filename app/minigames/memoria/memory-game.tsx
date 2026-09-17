"use client";

import { useEffect, useRef, useState } from "react";
import { createRound, DURATION, flip, symbols, tick, type Round } from "./engine";
import {
  isMemoryRankingConfigured,
  loadMemoryRanking,
  MEMORY_RANKING_POLL_INTERVAL_MS,
  saveMemoryRanking,
  sanitizeMemoryName,
  type MemoryRankingEntry,
} from "./memory-ranking-service";

const seconds = (value: number) => (value / 1000).toFixed(1).replace(".", ",");

export function MemoryGame() {
  const [screen, setScreen] = useState<"menu" | "game" | "ranking">("menu");
  const [round, setRound] = useState<Round | null>(null);
  const [name, setName] = useState("");
  const [ranking, setRanking] = useState<MemoryRankingEntry[]>([]);
  const [notice, setNotice] = useState("");
  const [rankingStatus, setRankingStatus] = useState<"loading" | "ready" | "error" | "unconfigured">(
    isMemoryRankingConfigured() ? "loading" : "unconfigured",
  );
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const running = screen === "game" && round !== null && !round.ended;
  useEffect(() => {
    if (!running) return;
    const update = () => setRound((current) => current ? tick(current, performance.now()) : current);
    const interval = window.setInterval(update, 100);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [running]);

  useEffect(() => {
    if (round?.ended) resultHeading.current?.focus();
  }, [round?.ended]);

  useEffect(() => {
    if (screen !== "ranking" || !isMemoryRankingConfigured()) return;
    let active = true;

    async function load() {
      try {
        const nextRanking = await loadMemoryRanking();
        if (!active) return;
        setRanking(nextRanking);
        setRankingStatus("ready");
      } catch {
        if (!active) return;
        setRankingStatus("error");
      }
    }

    void load();
    const interval = window.setInterval(() => { void load(); }, MEMORY_RANKING_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [screen]);

  function start() {
    setRound(createRound(performance.now()));
    setSaved(false);
    savedRef.current = false;
    setNotice("");
    setScreen("game");
  }

  async function showRanking() {
    setNotice("");
    if (!isMemoryRankingConfigured()) {
      setRanking([]);
      setRankingStatus("unconfigured");
      setScreen("ranking");
      return;
    }

    setRankingStatus("loading");
    setScreen("ranking");
    try {
      const nextRanking = await loadMemoryRanking();
      setRanking(nextRanking);
      setRankingStatus("ready");
    } catch {
      setRanking([]);
      setRankingStatus("error");
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!round?.ended || !name.trim() || savedRef.current) return;

    const entry = {
      id: crypto.randomUUID(),
      name: sanitizeMemoryName(name),
      score: round.score,
      pairs: round.matched.length / 2,
      elapsed: round.now - round.startedAt,
    };

    if (!isMemoryRankingConfigured()) {
      setNotice("Ranking geral não configurado.");
      return;
    }

    try {
      setNotice("Salvando no ranking geral...");
      const entries = await saveMemoryRanking(entry);
      savedRef.current = true;
      setSaved(true);
      setRanking(entries);
      setRankingStatus("ready");
      setNotice("Pontuação salva no ranking geral!");
    } catch {
      setNotice("Não foi possível salvar no ranking geral. Tente novamente.");
    }
  }

  const remaining = round ? Math.max(0, Math.ceil((DURATION - (round.now - round.startedAt)) / 1000)) : 60;
  const board = round ? [...round.cards.slice(0, 12), null, ...round.cards.slice(12)] : [];

  return <section className="memory" aria-labelledby="memory-title">
    <h1 id="memory-title">Jogo da Memória</h1>
    {screen === "menu" && <div className="memory-panel memory-menu">
      <div className="memory-preview" aria-hidden="true">🎟️ 🎤 🪩</div>
      <h2>Encontre os pares da festa</h2>
      <p>12 pares · 1 minuto · painel 5 × 5</p>
      <p className="memory-hint">A casa central é livre. Cada par vale 100 pontos + 1 ponto por segundo restante ao acertar.</p>
      <div className="memory-actions"><button className="primary-button" onClick={start}>Iniciar</button><button className="secondary-button" onClick={showRanking}>Ranking</button></div>
    </div>}

    {screen === "game" && round && <>
      <div className="memory-stats" aria-label="Placar">
        <div className={remaining <= 10 ? "timer-urgent" : ""}><span>Tempo</span><strong role="timer" aria-label={`${remaining} segundos restantes`}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong></div>
        <div><span>Pares</span><strong>{round.matched.length / 2}<small> / 12</small></strong></div>
        <div><span>Pontos</span><strong>{round.score}</strong></div>
      </div>
      {!round.ended ? <>
        <div className="memory-board" aria-label="Painel de memória com 5 linhas e 5 colunas">
          {board.map((card, index) => {
            if (!card) return <div key="free" className="memory-free" aria-label="Casa central livre"><span aria-hidden="true">✦</span><small>Livre</small></div>;
            const matched = round.matched.includes(card.id);
            const visible = matched || round.selected.includes(card.id);
            return <button key={card.id} className={`memory-card${visible ? " is-visible" : ""}${matched ? " is-matched" : ""}`} disabled={matched} aria-disabled={round.selected.length === 2 || visible} aria-label={`Carta ${index + 1}: ${visible ? symbols[card.symbol].label : "virada"}${matched ? ", par encontrado" : ""}`} onClick={() => setRound((current) => current ? flip(current, card.id, performance.now()) : current)}>
              <span aria-hidden="true">{visible ? symbols[card.symbol].emoji : "?"}</span>
            </button>;
          })}
        </div>
        <p className="memory-hint">Encontre os pares antes que o tempo acabe.</p>
      </> : <div className="memory-panel memory-result">
        <h2 ref={resultHeading} tabIndex={-1}>{round.matched.length === 24 ? "Você encontrou todos os pares!" : "Tempo esgotado!"}</h2>
        <p>{round.score} pontos · {round.matched.length / 2} pares · {seconds(round.now - round.startedAt)} s</p>
        {!saved && <form onSubmit={save} className="score-form"><label htmlFor="player-name">Seu nome no ranking geral</label><input id="player-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={30} required autoComplete="nickname" placeholder="Digite seu nome" /><button className="primary-button" disabled={!name.trim()} type="submit">Salvar pontuação</button></form>}
        <p role="status">{notice}</p>
        <div className="memory-actions"><button className="primary-button" onClick={start}>Jogar novamente</button><button className="secondary-button" onClick={showRanking}>Ranking</button></div>
      </div>}
    </>}

    {screen === "ranking" && <div className="memory-panel">
      <h2>Ranking</h2><p className="memory-hint">Top 50 geral · maior pontuação primeiro.</p>
      {rankingStatus === "unconfigured" && <p role="status">Configure o Supabase para ativar o ranking geral.</p>}
      {rankingStatus === "loading" && <p role="status">Carregando ranking geral...</p>}
      {rankingStatus === "error" && <p role="status">Não foi possível carregar o ranking geral agora.</p>}
      {notice && <p role="status">{notice}</p>}
      {ranking.length ? <div className="ranking-scroll"><table className="ranking-table"><caption className="sr-only">Jogadores, pontuação, pares encontrados e tempo gasto</caption><thead><tr><th scope="col">#</th><th scope="col">Jogador</th><th scope="col">Pontos</th><th scope="col">Pares</th><th scope="col">Tempo</th></tr></thead><tbody>{ranking.map((entry, index) => <tr key={entry.id}><td>{index + 1}</td><th scope="row">{entry.name}</th><td>{entry.score}</td><td>{entry.pairs}/12</td><td>{seconds(entry.elapsed)} s</td></tr>)}</tbody></table></div> : <p className="ranking-empty">Ainda não há pontuações. Que tal ser o primeiro?</p>}
      <div className="memory-actions"><button className="primary-button" onClick={start}>Iniciar</button><button className="secondary-button" onClick={() => setScreen("menu")}>Voltar</button></div>
    </div>}
  </section>;
}
