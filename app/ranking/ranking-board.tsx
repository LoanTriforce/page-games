"use client";

import { useEffect, useState } from "react";
import { fetchRanking, formatRankingResult, formatScore, isRankingConfigured, RANKING_POLL_INTERVAL_MS, type RankingEntry } from "./ranking-service";

const medals = ["🥇", "🥈", "🥉"];

function RankingPodium({ entries }: { entries: RankingEntry[] }) {
  return (
    <section className="event-ranking-podium" aria-label="Três primeiros colocados">
      {entries.map((entry, index) => (
        <article className={`event-ranking-podium-card rank-${index + 1}`} key={entry.id}>
          <span className="event-ranking-medal" aria-hidden="true">{medals[index]}</span>
          <span className="event-ranking-position">{index + 1}º lugar</span>
          <h2>{entry.nome}</h2>
          <p>{formatRankingResult(entry.palavrasEncontradas, entry.tempoResultadoMs)}</p>
          <strong>{formatScore(entry.pontuacao)} pts</strong>
        </article>
      ))}
    </section>
  );
}

function RankingRow({ entry, position }: { entry: RankingEntry; position: number }) {
  return (
    <li className="event-ranking-row">
      <span className="event-ranking-row-position">{position}º</span>
      <span className="event-ranking-row-name">{entry.nome}</span>
      <span>{formatRankingResult(entry.palavrasEncontradas, entry.tempoResultadoMs)}</span>
      <strong>{formatScore(entry.pontuacao)} pts</strong>
    </li>
  );
}

export function RankingBoard() {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unconfigured">(
    isRankingConfigured() ? "loading" : "unconfigured",
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!isRankingConfigured()) return;
    let active = true;

    async function load() {
      try {
        const nextEntries = await fetchRanking();
        if (!active) return;
        setEntries(nextEntries);
        setStatus("ready");
        setLastUpdated(new Date());
      } catch {
        if (!active) return;
        setStatus("error");
      }
    }

    load();
    const interval = window.setInterval(load, RANKING_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const podium = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return (
    <section className="event-ranking-board" aria-labelledby="ranking-title">
      <div className="event-ranking-heading">
        <p>Grupo Page</p>
        <h1 id="ranking-title">Ranking</h1>
        <span>{status === "ready" && lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Atualização automática"}</span>
      </div>

      {status === "unconfigured" && (
        <div className="event-ranking-state" role="status">
          Configure <strong>NEXT_PUBLIC_SUPABASE_URL</strong> e <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> para carregar e salvar o ranking persistente.
        </div>
      )}

      {status === "error" && <div className="event-ranking-state" role="status">Não foi possível atualizar o ranking agora. Nova tentativa em instantes.</div>}
      {status === "loading" && <div className="event-ranking-state" role="status">Carregando ranking...</div>}

      {podium.length > 0 && <RankingPodium entries={podium} />}

      <section className="event-ranking-list" aria-label="Demais participantes">
        <div className="event-ranking-list-header">
          <span>Posição</span>
          <span>Participante</span>
          <span>Resultado</span>
          <span>Pontuação</span>
        </div>
        {remaining.length > 0 ? (
          <ol>
            {remaining.map((entry, index) => <RankingRow entry={entry} key={entry.id} position={index + 4} />)}
          </ol>
        ) : (
          <p className="event-ranking-empty">Os demais participantes aparecerão aqui automaticamente.</p>
        )}
      </section>
    </section>
  );
}
