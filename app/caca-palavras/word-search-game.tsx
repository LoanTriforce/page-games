"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DURATION, generate, match, path, remaining, type Puzzle } from "./engine";

type Phase = "ready" | "playing" | "finished";
type PointerState = { id: number; start: number; oldAnchor: number | null; moved: boolean };

const seconds = Math.round(DURATION / 1000);

export function WordSearchGame() {
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [won, setWon] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const pointer = useRef<PointerState | null>(null);

  const running = phase === "playing";

  const finish = useCallback((success: boolean, count = found.size) => {
    setPhase("finished");
    setAnchor(null);
    setPreview([]);
    setWon(success);
    setShowResult(true);
    setFeedback(`Rodada encerrada: ${count} de 6 palavras encontradas.`);
  }, [found.size]);

  useEffect(() => {
    if (!running) return;
    const update = () => {
      const ms = remaining(deadline, Date.now());
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
    setWon(false);
    setShowResult(false);
    setReviewing(false);
  }

  function start() {
    if (phase !== "ready") return;
    setRound((value) => value + 1);
    setDeadline(Date.now() + DURATION);
    setTimeLeft(DURATION);
    setPhase("playing");
    setFeedback("Vamos lá! Selecione uma palavra na grade.");
  }

  function restart() {
    setShowConfirm(false);
    reset(generate());
    setRound((value) => value + 1);
    setDeadline(Date.now() + DURATION);
    setTimeLeft(DURATION);
    setPhase("playing");
    setFeedback("Nova grade iniciada. Encontre as seis palavras.");
  }

  function isActive() {
    if (phase !== "playing") return false;
    if (Date.now() >= deadline) {
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
    const nextFound = new Set(found).add(word.text);
    const nextCells = new Set(foundCells);
    cells.forEach((cell) => nextCells.add(cell));
    setFound(nextFound);
    setFoundCells(nextCells);
    setFeedback(`${word.label} encontrada! Uma conexão com ${word.product}.`);
    if (nextFound.size === puzzle.words.length) finish(true, nextFound.size);
  }

  function cellFromPoint(event: React.PointerEvent<HTMLElement>) {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("[data-cell]");
    return element ? Number(element.dataset.cell) : null;
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
        <a className="wordsearch-brand" href="./" aria-label="Grupo PAGE, início">
          <span className="wordsearch-brand-small">GRUPO</span>
          <span className="wordsearch-brand-name">page<span className="wordsearch-brand-dot">.</span></span>
        </a>
        <div className="wordsearch-event">
          <span className="wordsearch-event-mark" aria-hidden="true">✳</span>
          <div>CONEXÃO ARAXÁ<span>ENCONTRE. CONECTE. DESCUBRA.</span></div>
        </div>
        <span className="wordsearch-edition">DESAFIO PAGE / 01</span>
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
                  <p>Localize as 6 palavras da lista.<br />Toque na primeira e na última letra, ou arraste entre elas.</p>
                  <button className="wordsearch-primary" onClick={start} type="button">Começar desafio <span aria-hidden="true">↗</span></button>
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
            <h2 id="restart-title">Reiniciar a rodada?</h2>
            <span>A grade atual será trocada, o placar volta para zero e o tempo recomeça em {seconds} segundos.</span>
            <div>
              <button className="wordsearch-secondary" onClick={() => setShowConfirm(false)} type="button">Cancelar</button>
              <button className="wordsearch-primary" onClick={restart} type="button">Reiniciar <span aria-hidden="true">↗</span></button>
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
            <strong className="wordsearch-result-count">{found.size}<small>de {puzzle.words.length} palavras<br />encontradas</small></strong>
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
