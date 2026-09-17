"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BUBBLES_RANKING_POLL_INTERVAL_MS,
  downloadBubblesRankingSpreadsheet,
  formatBubblesDate,
  formatBubblesDuration,
  isBubblesRankingConfigured,
  loadBubblesRanking,
  type BubblesRankingEntry,
} from "../bolinhas-ranking-service";

export function BubblesRankingBoard() {
  const [entries, setEntries] = useState<BubblesRankingEntry[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unconfigured">(
    isBubblesRankingConfigured() ? "loading" : "unconfigured",
  );

  useEffect(() => {
    if (!isBubblesRankingConfigured()) return;
    let active = true;

    async function load() {
      try {
        const nextEntries = await loadBubblesRanking();
        if (!active) return;
        setEntries(nextEntries);
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
      }
    }

    const frame = requestAnimationFrame(() => {
      void load();
    });
    const interval = window.setInterval(() => {
      void load();
    }, BUBBLES_RANKING_POLL_INTERVAL_MS);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, []);

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
        <span>{status === "loading" ? "Carregando ranking geral" : `${entries.length} ${entries.length === 1 ? "resultado" : "resultados"} no ranking geral`}</span>
      </div>

      <div className="bubbles-ranking-actions" aria-label="Ações do ranking">
        <Link className="bubbles-secondary" href="/minigames/bolinhas-page">Voltar para o jogo</Link>
        <button className="bubbles-secondary" onClick={handleExportRanking} type="button">Exportar Excel</button>
      </div>

      {message && <p className="bubbles-message" role="status">{message}</p>}
      {status === "unconfigured" && <p className="bubbles-message" role="status">Configure o Supabase para ativar o ranking geral.</p>}
      {status === "error" && <p className="bubbles-message" role="status">Não foi possível atualizar o ranking geral agora.</p>}

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
