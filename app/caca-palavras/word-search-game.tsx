"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DURATION, generate, match, path, remaining, type Puzzle } from "./engine";
import { calculateScore, formatPhone, formatRankingDuration, isRankingConfigured, isValidBrazilianPhone, normalizePhone, sanitizePlayerName, submitGameResult, type FoundWordDetail } from "../ranking/ranking-service";

type Phase = "ready" | "playing" | "finished";
type PointerState = { id: number; start: number; oldAnchor: number | null; moved: boolean };

export function WordSearchGame() {
  const router = useRouter();
  const [puzzle, setPuzzle] = useState<Puzzle>(() => generate());
  const [phase, setPhase] = useState<Phase>("ready");
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [foundCells, setFoundCells] = useState<Set<number>>(() => new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [preview, setPreview] = useState<number[]>([]);
  const [deadline, setDeadline] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState("Cada palavra revela uma conexão do ecossistema PAGE.");
  const [rankingStatus, setRankingStatus] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRankingConfirm, setShowRankingConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [won, setWon] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [finalFoundCount, setFinalFoundCount] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const pointer = useRef<PointerState | null>(null);
  const gameStartTime = useRef<number | null>(null);
  const gameStartDate = useRef<number | null>(null);
  const foundWords = useRef<FoundWordDetail[]>([]);
  const resultSent = useRef(false);
  const gameSessionId = useRef<string | null>(null);
  const currentPlayer = useRef<{ nome: string; telefone: string } | null>(null);

  const running = phase === "playing";

  const finish = useCallback((success: boolean, count = found.size) => {
    const finishedAtDate = Date.now();
    const elapsedMs = gameStartTime.current === null ? 0 : Math.min(DURATION, Math.max(0, performance.now() - gameStartTime.current));
    const detailedWords = foundWords.current.slice(0, count);
    const tempoResultadoMs = Math.round(detailedWords.length > 0 ? detailedWords[detailedWords.length - 1].foundAtMs : elapsedMs);
    const startedDate = gameStartDate.current ?? finishedAtDate;
    const score = calculateScore(count, tempoResultadoMs);
    const player = currentPlayer.current;

    setPhase("finished");
    setAnchor(null);
    setPreview([]);
    setWon(success);
    setShowResult(true);
    setFinalFoundCount(count);
    setFinalScore(score);
    setFeedback(`Rodada encerrada: ${count} de ${puzzle.words.length} palavras encontradas.`);

    if (resultSent.current) return;
    resultSent.current = true;

    if (!player) {
      setRankingStatus("Não foi possível identificar o participante da rodada.");
      return;
    }

    if (!isRankingConfigured()) {
      setRankingStatus("Ranking persistente não configurado.");
      return;
    }

    setRankingStatus("Enviando resultado para o ranking...");
    void submitGameResult({
      id: gameSessionId.current ?? crypto.randomUUID(),
      nome: player.nome,
      telefone: player.telefone,
      palavrasEncontradas: count,
      totalPalavras: puzzle.words.length,
      tempoResultadoMs,
      pontuacao: score,
      palavrasDetalhadas: detailedWords,
      dataInicio: new Date(startedDate).toISOString(),
      dataFinalizacao: new Date(finishedAtDate).toISOString(),
    }, puzzle.words.length)
      .then(() => setRankingStatus(`Resultado enviado: ${count} ${count === 1 ? "palavra" : "palavras"} em ${formatRankingDuration(tempoResultadoMs)} · ${score.toLocaleString("pt-BR")} pts.`))
      .catch(() => setRankingStatus("Não foi possível enviar o resultado para o ranking."));
  }, [found.size, puzzle.words.length]);

  useEffect(() => {
    if (!running) return;
    const update = () => {
      const ms = remaining(deadline, performance.now());
      setTimeLeft(ms);
      if (ms <= 0) finish(false);
    };
    update();
    const interval = window.setInterval(update, 100);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline, finish, running]);

  function reset(nextPuzzle = generate()) {
    setPuzzle(nextPuzzle);
    setPhase("ready");
    setFound(new Set());
    setFoundCells(new Set());
    setAnchor(null);
    setPreview([]);
    setTimeLeft(DURATION);
    setFeedback("Cada palavra revela uma conexão do ecossistema PAGE.");
    setRankingStatus("");
    setWon(false);
    setShowResult(false);
    setShowRankingConfirm(false);
    setReviewing(false);
    setPlayerName("");
    setPlayerPhone("");
    setFinalFoundCount(0);
    setFinalScore(0);
    gameStartTime.current = null;
    gameStartDate.current = null;
    foundWords.current = [];
    resultSent.current = false;
    gameSessionId.current = null;
    currentPlayer.current = null;
  }

  function start() {
    if (phase !== "ready") return;
    const nome = sanitizePlayerName(playerName);
    const telefone = normalizePhone(playerPhone);

    if (!nome) {
      setFeedback("Informe o nome do participante antes de começar.");
      return;
    }

    if (!isValidBrazilianPhone(telefone)) {
      setFeedback("Informe um telefone brasileiro válido antes de começar.");
      return;
    }

    const now = performance.now();
    const startedDate = Date.now();
    const sessionId = crypto.randomUUID();
    setPlayerName(nome);
    setPlayerPhone(formatPhone(telefone));
    currentPlayer.current = { nome, telefone };
    gameSessionId.current = sessionId;
    gameStartTime.current = now;
    gameStartDate.current = startedDate;
    foundWords.current = [];
    resultSent.current = false;
    setRound((value) => value + 1);
    setDeadline(now + DURATION);
    setTimeLeft(DURATION);
    setRankingStatus("");
    setPhase("playing");
    setFeedback("Vamos lá! Selecione uma palavra na grade.");
  }

  function restart() {
    setShowConfirm(false);
    reset(generate());
    setFeedback("Nova grade preparada. Informe nome e telefone para iniciar a próxima rodada.");
  }

  function isActive() {
    if (phase !== "playing") return false;
    if (performance.now() >= deadline) {
      finish(false);
      return false;
    }
    return true;
  }

  function submit(first: number | null, last: number) {
    if (!isActive()) return;
    const cells = path(first, last);
    const word = match(puzzle.grid, cells, puzzle.words, found);
    setAnchor(null);
    setPreview([]);
    if (!word) {
      setFeedback("Ainda não! Procure uma palavra da lista.");
      return;
    }
    if (found.has(word.text) || foundWords.current.some((detail) => detail.word === word.text)) {
      setFeedback(`${word.label} já foi registrada nesta rodada.`);
      return;
    }
    const elapsedMs = Math.round(Math.min(DURATION, Math.max(0, performance.now() - (gameStartTime.current ?? performance.now()))));
    const nextFound = new Set(found).add(word.text);
    const nextCells = new Set(foundCells);
    cells.forEach((cell) => nextCells.add(cell));
    foundWords.current = [...foundWords.current, { word: word.text, foundAtMs: elapsedMs }];
    setFound(nextFound);
    setFoundCells(nextCells);
    setFeedback(`${word.label} encontrada! Uma conexão com ${word.product}.`);
    if (nextFound.size === puzzle.words.length) finish(true, nextFound.size);
  }

  function cellFromPoint(event: React.PointerEvent<HTMLElement>) {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("[data-cell]");
    return element ? Number(element.dataset.cell) : null;
  }

  function openRanking() {
    if (running) {
      setShowRankingConfirm(true);
      return;
    }
    router.push("/ranking");
  }

  function revealAnswers() {
    setShowResult(false);
    setReviewing(true);
    setFeedback("Respostas reveladas. Você pode preparar uma nova grade.");
  }

  const visibleFoundCells = new Set(foundCells);
  if (reviewing) {
    puzzle.placements
      .filter((word) => !found.has(word.text))
      .forEach((word) => word.cells.forEach((cell) => visibleFoundCells.add(cell)));
  }

  return (
    <main className="wordsearch-page-shell">
      <header className="wordsearch-header">
        <div className="wordsearch-header-start">
          <Link className="wordsearch-back-hub" href="/">← Voltar ao Hub</Link>
          <span className="wordsearch-brand" aria-label="Grupo PAGE">
            <span className="wordsearch-brand-small">GRUPO</span>
            <span className="wordsearch-brand-name">page<span className="wordsearch-brand-dot">.</span></span>
          </span>
        </div>
        <div className="wordsearch-event">
          <span className="wordsearch-event-mark" aria-hidden="true">✳</span>
          <div>CONEXÃO ARAXÁ<span>ENCONTRE. CONECTE. DESCUBRA.</span></div>
        </div>
        <div className="wordsearch-header-actions">
          <button className="wordsearch-ranking-link" onClick={openRanking} type="button">Ranking <span aria-hidden="true">↗</span></button>
          <span className="wordsearch-edition">DESAFIO PAGE / 01</span>
        </div>
      </header>

      <section className="wordsearch-shell">
        <section className="wordsearch-intro">
          <div>
            <p className="wordsearch-eyebrow">O UNIVERSO PAGE EM UM JOGO</p>
            <h1>Conexões que você<br /><span>encontra aqui.</span></h1>
          </div>
          <div className="wordsearch-round-actions" aria-label="Ações da rodada">
            <p>Seis palavras. Quarenta e cinco segundos.<br />Descubra as conexões do ecossistema PAGE.</p>
            <button className="wordsearch-new-grid" onClick={() => setShowConfirm(true)} type="button">
              <span aria-hidden="true">↻</span>
              <strong>NOVA GRADE</strong>
              <small>confirma antes de reiniciar</small>
            </button>
          </div>
        </section>

        <section className="wordsearch-game-layout" aria-label="Caça-palavras">
          <div className="wordsearch-board-card">
            <div className="wordsearch-board-top">
              <span><span className="wordsearch-tiny-cross" aria-hidden="true">✳</span> CAÇA-PALAVRAS</span>
              <span>{phase === "ready" ? "PRONTO PARA JOGAR?" : `RODADA ${String(round).padStart(2, "0")}`}</span>
            </div>
            <div
              className="wordsearch-board-wrap"
              onPointerDown={(event) => {
                if (!isActive() || event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
                const idx = cellFromPoint(event);
                if (idx === null) return;
                event.preventDefault();
                const oldAnchor = anchor;
                const first = oldAnchor ?? idx;
                pointer.current = { id: event.pointerId, start: idx, oldAnchor, moved: false };
                setAnchor(first);
                setPreview(path(first, idx));
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const current = pointer.current;
                if (!current || current.id !== event.pointerId || !isActive()) return;
                const idx = cellFromPoint(event);
                if (idx === null) return;
                if (idx !== current.start) current.moved = true;
                setPreview(path(current.oldAnchor ?? current.start, idx));
              }}
              onPointerUp={(event) => {
                const current = pointer.current;
                if (!current || current.id !== event.pointerId) return;
                pointer.current = null;
                const idx = cellFromPoint(event);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                if (!isActive()) return;
                if (idx === null) {
                  setAnchor(null);
                  setPreview([]);
                  return;
                }
                if (current.moved || current.oldAnchor !== null) submit(current.oldAnchor ?? current.start, idx);
                else setPreview([idx]);
              }}
              onPointerCancel={() => {
                pointer.current = null;
                setAnchor(null);
                setPreview([]);
              }}
            >
              <div className="wordsearch-grid" aria-label="Grade de letras" role="group">
                {puzzle.grid.map((letter, index) => (
                  <button
                    key={index}
                    data-cell={index}
                    className={`wordsearch-cell${visibleFoundCells.has(index) ? " found" : ""}${preview.includes(index) ? " selected" : ""}${anchor === index ? " anchor" : ""}${reviewing && !foundCells.has(index) && visibleFoundCells.has(index) ? " revealed" : ""}`}
                    disabled={phase !== "playing"}
                    type="button"
                    aria-label={`${letter}, linha ${Math.floor(index / 10) + 1}, coluna ${index % 10 + 1}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              {phase === "ready" && (
                <div className="wordsearch-start-cover">
                  <div className="wordsearch-cover-icon" aria-hidden="true">P<span>↗</span></div>
                  <h2>Encontre sua<br />próxima conexão.</h2>
                  <p>Localize as 6 palavras da lista.<br />Informe seus dados para iniciar o cronômetro.</p>
                  <div className="wordsearch-player-fields">
                    <label className="wordsearch-player-name">
                      <span>Nome do participante</span>
                      <input
                        autoComplete="name"
                        maxLength={40}
                        onChange={(event) => setPlayerName(event.target.value)}
                        placeholder="Digite seu nome"
                        value={playerName}
                      />
                    </label>
                    <label className="wordsearch-player-name">
                      <span>Telefone do participante</span>
                      <input
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={15}
                        onChange={(event) => setPlayerPhone(formatPhone(event.target.value))}
                        placeholder="(74) 99999-9999"
                        value={playerPhone}
                      />
                    </label>
                  </div>
                  <button className="wordsearch-primary" disabled={!sanitizePlayerName(playerName) || !isValidBrazilianPhone(playerPhone)} onClick={start} type="button">Começar desafio <span aria-hidden="true">↗</span></button>
                  <span className="wordsearch-cover-foot">45 segundos para encontrar as conexões do universo PAGE.</span>
                </div>
              )}
            </div>
            <div className="wordsearch-board-bottom">
              <span aria-hidden="true">✦</span>
              <p>Toque ou arraste da primeira até a última letra. As palavras podem estar na horizontal, vertical, diagonal ou ao contrário.</p>
            </div>
          </div>

          <aside className="wordsearch-sidebar">
            <section className={`wordsearch-timer-card${timeLeft <= 10_000 && phase === "playing" ? " urgent" : ""}`} aria-label="Tempo restante">
              <div className="wordsearch-section-label"><span>SEU TEMPO</span><span aria-hidden="true">◷</span></div>
              <div className="wordsearch-timer-digits"><span>{String(Math.ceil(timeLeft / 1000)).padStart(2, "0")}</span><span>segundos</span></div>
              <div className="wordsearch-time-track"><div style={{ width: `${(timeLeft / DURATION) * 100}%` }} /></div>
              <p>{phase === "playing" ? "Encontre as seis palavras antes do tempo acabar." : "O tempo começa quando você estiver pronto."}</p>
            </section>

            <section className="wordsearch-words-card">
              <div className="wordsearch-section-label"><h2>Encontre as palavras</h2><span>{found.size} / {puzzle.words.length}</span></div>
              <ul>
                {puzzle.words.map((word) => (
                  <li key={word.text} className={found.has(word.text) ? "done" : ""}>
                    <span>{word.label.toLocaleUpperCase("pt-BR")}<small>{word.product}</small></span>
                    <b aria-hidden="true">✓</b>
                  </li>
                ))}
              </ul>
              <p>Na grade, as palavras aparecem sem acentos e sem hífen.</p>
            </section>

            <div className="wordsearch-feedback" role="status" aria-live="polite">{feedback}</div>
          </aside>
        </section>
      </section>

      {showConfirm && (
        <div className="wordsearch-modal" role="dialog" aria-modal="true" aria-labelledby="restart-title">
          <div className="wordsearch-modal-card">
            <p>NOVA GRADE</p>
            <h2 id="restart-title">Preparar nova rodada?</h2>
            <span>A grade atual será trocada, o placar volta para zero e será necessário informar nome e telefone novamente.</span>
            <div>
              <button className="wordsearch-secondary" onClick={() => setShowConfirm(false)} type="button">Cancelar</button>
              <button className="wordsearch-primary" onClick={restart} type="button">Nova rodada <span aria-hidden="true">↗</span></button>
            </div>
          </div>
        </div>
      )}

      {showRankingConfirm && (
        <div className="wordsearch-modal" role="dialog" aria-modal="true" aria-labelledby="ranking-exit-title">
          <div className="wordsearch-modal-card">
            <p>RANKING</p>
            <h2 id="ranking-exit-title">Sair da rodada?</h2>
            <span>Uma partida está em andamento. Deseja sair e acessar o ranking?</span>
            <div>
              <button className="wordsearch-secondary" onClick={() => setShowRankingConfirm(false)} type="button">Cancelar</button>
              <button className="wordsearch-primary" onClick={() => router.push("/ranking")} type="button">Ir para Ranking <span aria-hidden="true">↗</span></button>
            </div>
          </div>
        </div>
      )}

      {showResult && (
        <div className="wordsearch-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="wordsearch-modal-card">
            <p>CONEXÃO ARAXÁ × GRUPO PAGE</p>
            <h2 id="result-title">{won ? "Conexão completa!" : "Tempo encerrado!"}</h2>
            <span>{won ? "Você encontrou todo o universo PAGE." : "Cada descoberta conta. Que tal mais uma rodada?"}</span>
            <strong className="wordsearch-result-count">{finalFoundCount}<small>de {puzzle.words.length} palavras<br />encontradas</small></strong>
            <span className="wordsearch-result-score">{finalScore.toLocaleString("pt-BR")} pts</span>
            {rankingStatus && <span className="wordsearch-ranking-status">{rankingStatus}</span>}
            <div>
              <button className="wordsearch-primary" onClick={() => { setShowResult(false); setShowConfirm(true); }} type="button">Nova grade <span aria-hidden="true">↗</span></button>
              <button className="wordsearch-secondary" onClick={revealAnswers} type="button">Ver respostas na grade</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
