"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearBubblesRanking,
  downloadBubblesRankingSpreadsheet,
  formatBubblesDate,
  formatBubblesDuration,
  loadBubblesRanking,
  type BubblesRankingEntry,
} from "../bolinhas-ranking-service";

export function BubblesRankingBoard() {
  const [entries, setEntries] = useState<BubblesRankingEntry[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntries(loadBubblesRanking()));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClearRanking() {
    const confirmed = window.confirm("Tem certeza que deseja apagar todo o ranking de Bolinhas Page? Esta ação não poderá ser desfeita.");
    if (!confirmed) return;

    clearBubblesRanking();
    setEntries([]);
    setMessage("Ranking limpo com sucesso.");
  }

  function handleExportRanking() {
    if (entries.length === 0) {
      setMessage("Não existem participantes para exportar.");
      return;
    }

    downloadBubblesRankingSpreadsheet(entries);
    setMessage("Exportação do ranking iniciada.");
  }

  return (
    <section className="bubbles-ranking-page-board" aria-labelledby="bubbles-ranking-title">
      <div className="bubbles-ranking-heading">
        <p>Grupo Page</p>
        <h1 id="bubbles-ranking-title">Ranking Bolinhas</h1>
        <span>{entries.length} {entries.length === 1 ? "resultado" : "resultados"} neste dispositivo</span>
      </div>

      <div className="bubbles-ranking-actions" aria-label="Ações do ranking">
        <Link className="bubbles-secondary" href="/minigames/bolinhas-page">Voltar para o jogo</Link>
        <button className="bubbles-secondary" onClick={handleExportRanking} type="button">Exportar Excel</button>
        <button className="bubbles-danger" onClick={handleClearRanking} type="button">Limpar ranking</button>
      </div>

      {message && <p className="bubbles-message" role="status">{message}</p>}

      <div className="bubbles-ranking-table-wrap">
        <div className="bubbles-ranking-table-head">
          <span>Posição</span>
          <span>Participante</span>
          <span>Telefone</span>
          <span>Resultado</span>
          <span>Pontuação</span>
          <span>Data/hora</span>
        </div>
        {entries.length ? (
          <ol className="bubbles-ranking-list">
            {entries.map((entry, index) => (
              <li className="bubbles-ranking-row" key={entry.id}>
                <span>{index + 1}º</span>
                <strong>{entry.name}</strong>
                <span>{entry.phone}</span>
                <span>{entry.bubblesClicked} {entry.bubblesClicked === 1 ? "bolinha" : "bolinhas"} em {formatBubblesDuration(entry.elapsedMs)}</span>
                <strong>{entry.score.toLocaleString("pt-BR")} pts</strong>
                <span>{formatBubblesDate(entry.createdAt)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="bubbles-ranking-empty">Ainda não existem participantes neste ranking.</p>
        )}
      </div>
    </section>
  );
}
