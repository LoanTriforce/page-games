"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { fetchRanking, formatRankingResult, formatScore, isRankingConfigured, RANKING_POLL_INTERVAL_MS, type RankingEntry } from "../ranking-service";

type RankingStatus = "loading" | "ready" | "error" | "unconfigured";

type PresentationSlide = {
  id: string;
  title: string;
  src: string;
  kind: "image" | "video";
  durationMs: number;
};

const presentationSlides: PresentationSlide[] = [
  { id: "page-city", title: "Page City", src: "/ranking-slides/page-city.png", kind: "image", durationMs: 5_000 },
  { id: "page-move", title: "Page Move", src: "/ranking-slides/page-move.png", kind: "image", durationMs: 5_000 },
  { id: "page-video-1", title: "Vídeo Page Move", src: "/ranking-slides/page-video-1.mp4", kind: "video", durationMs: 10_000 },
  { id: "page-servicos", title: "Page Serviços", src: "/ranking-slides/page-servicos.png", kind: "image", durationMs: 5_000 },
  { id: "page-eventos", title: "Page Eventos", src: "/ranking-slides/page-eventos.png", kind: "image", durationMs: 5_000 },
];

const IMAGE_BLOCK_DURATION_MS = presentationSlides.reduce((total, slide) => total + slide.durationMs, 0);
const RANKING_DURATION_MS = 40_000;
const PRESENTATION_CYCLE_MS = IMAGE_BLOCK_DURATION_MS + RANKING_DURATION_MS;
const CLOCK_TICK_MS = 250;
const medals = ["🥇", "🥈", "🥉"];

function getPresentationStage(elapsedMs: number) {
  let cursor = 0;

  for (const slide of presentationSlides) {
    const endsAtMs = cursor + slide.durationMs;

    if (elapsedMs < endsAtMs) {
      return { type: "promo" as const, slide, startsAtMs: cursor, endsAtMs };
    }

    cursor = endsAtMs;
  }

  return { type: "ranking" as const, startsAtMs: IMAGE_BLOCK_DURATION_MS, endsAtMs: PRESENTATION_CYCLE_MS };
}

function getPublicAssetSrc(src: string) {
  const basePath = process.env.NODE_ENV === "production" ? "/page-games" : "";

  return `${basePath}${src}`;
}

function PromoSlide({ slide }: { slide: PresentationSlide }) {
  const [hasMediaError, setHasMediaError] = useState(false);

  return (
    <section className="ranking-presentation-slide" aria-label={slide.title}>
      {!hasMediaError && slide.kind === "image" && (
        <Image
          alt={slide.title}
          className="ranking-presentation-image"
          fill
          priority
          sizes="100vw"
          src={slide.src}
          onError={() => setHasMediaError(true)}
        />
      )}
      {!hasMediaError && slide.kind === "video" && (
        <video
          key={slide.src}
          aria-label={slide.title}
          autoPlay
          className="ranking-presentation-video"
          loop
          muted
          playsInline
          preload="auto"
          src={getPublicAssetSrc(slide.src)}
          onError={() => setHasMediaError(true)}
        />
      )}
      {hasMediaError && (
        <div className="ranking-presentation-placeholder">
          <span>{slide.id}</span>
          <strong>Mídia promocional</strong>
          <p>Adicione o arquivo em <code>public/ranking-slides</code>.</p>
        </div>
      )}
    </section>
  );
}

function PresentationRanking({ entries, lastUpdated, status }: { entries: RankingEntry[]; lastUpdated: Date | null; status: RankingStatus }) {
  const podium = entries.slice(0, 3);
  const remaining = entries.slice(3, 12);
  const updatedLabel = lastUpdated
    ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "Atualização automática";

  return (
    <section className="ranking-presentation-ranking" aria-labelledby="presentation-ranking-title">
      <div className="ranking-presentation-ranking-head">
        <div>
          <p>Conexão Araxá × Grupo Page</p>
          <h1 id="presentation-ranking-title">Ranking Caça Palavras</h1>
        </div>
        <span>{status === "loading" ? "Carregando ranking real" : `${entries.length} ${entries.length === 1 ? "resultado" : "resultados"} • ${updatedLabel}`}</span>
      </div>

      {status === "unconfigured" && (
        <div className="ranking-presentation-state" role="status">
          Configure <strong>NEXT_PUBLIC_SUPABASE_URL</strong> e <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> para carregar o ranking persistente.
        </div>
      )}
      {status === "error" && entries.length === 0 && <div className="ranking-presentation-state" role="status">Não foi possível carregar o ranking agora.</div>}
      {status === "error" && entries.length > 0 && <div className="ranking-presentation-state" role="status">Tentando atualizar novamente em instantes.</div>}
      {status === "loading" && entries.length === 0 && <div className="ranking-presentation-state" role="status">Carregando ranking...</div>}

      {podium.length > 0 && (
        <div className="ranking-presentation-podium" aria-label="Três primeiros colocados">
          {podium.map((entry, index) => (
            <article className={`ranking-presentation-podium-card rank-${index + 1}`} key={entry.id}>
              <span className="ranking-presentation-medal" aria-hidden="true">{medals[index]}</span>
              <span>{index + 1}º lugar</span>
              <h2>{entry.nome}</h2>
              <p>{formatRankingResult(entry.palavrasEncontradas, entry.tempoResultadoMs)}</p>
              <strong>{formatScore(entry.pontuacao)} pts</strong>
            </article>
          ))}
        </div>
      )}

      <section className="ranking-presentation-list" aria-label="Classificação geral">
        <div className="ranking-presentation-list-head">
          <span>Posição</span>
          <span>Participante</span>
          <span>Resultado</span>
          <span>Pontuação</span>
        </div>
        {remaining.length > 0 ? (
          <ol>
            {remaining.map((entry, index) => (
              <li className="ranking-presentation-row" key={entry.id}>
                <span>{index + 4}º</span>
                <strong>{entry.nome}</strong>
                <span>{formatRankingResult(entry.palavrasEncontradas, entry.tempoResultadoMs)}</span>
                <b>{formatScore(entry.pontuacao)} pts</b>
              </li>
            ))}
          </ol>
        ) : status === "ready" ? (
          <p className="ranking-presentation-empty">Os próximos participantes aparecerão automaticamente.</p>
        ) : null}
      </section>
    </section>
  );
}

export function RankingPresentation() {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [status, setStatus] = useState<RankingStatus>(isRankingConfigured() ? "loading" : "unconfigured");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cycleStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isRankingConfigured()) return;

    let active = true;
    let loading = false;

    async function load() {
      if (loading) return;
      loading = true;

      try {
        const nextEntries = await fetchRanking();
        if (!active) return;
        setEntries(nextEntries);
        setStatus("ready");
        setLastUpdated(new Date());
      } catch {
        if (!active) return;
        setStatus("error");
      } finally {
        loading = false;
      }
    }

    void load();
    const interval = window.setInterval(() => { void load(); }, RANKING_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const elapsedMs = useMemo(() => ((now - cycleStartedAt) % PRESENTATION_CYCLE_MS + PRESENTATION_CYCLE_MS) % PRESENTATION_CYCLE_MS, [cycleStartedAt, now]);
  const stage = getPresentationStage(elapsedMs);
  const remainingSeconds = Math.max(0, Math.ceil((stage.endsAtMs - elapsedMs) / 1000));
  const cycleProgress = Math.min(100, Math.max(0, (elapsedMs / PRESENTATION_CYCLE_MS) * 100));

  return (
    <main className="ranking-presentation-page">
      <div className="ranking-presentation-stage" key={stage.type === "promo" ? stage.slide.id : "ranking"}>
        {stage.type === "promo" ? <PromoSlide slide={stage.slide} /> : <PresentationRanking entries={entries} lastUpdated={lastUpdated} status={status} />}
      </div>

      <div className="ranking-presentation-progress" aria-hidden="true">
        <span style={{ width: `${cycleProgress}%` }} />
      </div>
      <div className="ranking-presentation-timer" aria-live="polite">
        {stage.type === "promo" ? stage.slide.title : "Ranking"} • {remainingSeconds}s
      </div>
    </main>
  );
}



