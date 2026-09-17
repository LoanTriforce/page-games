import Link from "next/link";
import { games } from "./games";
import { Logo } from "./ui/logo";

export default function Home() {
  return (
    <main className="arcade-shell home-shell">
      <header className="site-header"><Logo /></header>
      <section className="game-picker" aria-labelledby="games-title">
        <h1 id="games-title">Escolha o minigame</h1>
        <div className="games-grid">
          <Link href="/minigames/encontre-o-ingresso" className="game-card"><svg className="game-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 20h34v20H7zM11 20l5-12h16l5 12M16 29h16M20 35h8"/></svg><span className="game-name">Encontre o ingresso</span><span className="game-arrow" aria-hidden="true">↗</span></Link>
          <Link href="/minigames/bolinhas-page" className="game-card"><svg className="game-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="15" cy="18" r="7" /><circle cx="31" cy="14" r="5" /><circle cx="32" cy="31" r="8" /><path d="M13 12c2-4 7-5 11-3M26 34c-4 0-8-2-10-5M36 25c4 3 5 8 2 12" /></svg><span className="game-name">Bolinhas Page</span><span className="game-arrow" aria-hidden="true">↗</span></Link>
          {games.map((game) => (
            <Link key={game.slug} href={`/minigames/${game.slug}`} className="game-card">
              <svg className="game-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {game.slug === "memoria" ? (
                  <><rect x="7" y="8" width="23" height="30" rx="4" transform="rotate(-10 18 23)" /><rect x="20" y="11" width="23" height="30" rx="4" className="card-front" /><path d="m31.5 20 1.8 3.7 4.2.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.2-.6Z" /></>
                ) : game.slug === "quiz" ? (
                  <><rect x="7" y="6" width="34" height="36" rx="10" /><path d="M18 18a6 6 0 0 1 12 0c0 4-6 4-6 8" /><circle cx="24" cy="33" r="1" fill="currentColor" /></>
                ) : (
                  <><path d="M18 6v36M31 6v36M6 18h36M6 31h36M8 8l6 6m0-6-6 6M34 34l6 6m0-6-6 6" /><circle cx="24.5" cy="24.5" r="3.5" /><circle cx="37" cy="11" r="3.5" /></>
                )}
              </svg>
              <span className="game-name">{game.name}</span>
              <span className="game-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
          <Link href="/caca-palavras" className="game-card">
            <svg className="game-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="8" y="8" width="32" height="32" rx="7" /><path d="M16 17h16M16 24h16M16 31h16M17 16l14 14M31 16 17 30" /><circle cx="16" cy="17" r="1.4" fill="currentColor" /><circle cx="24" cy="24" r="1.4" fill="currentColor" /><circle cx="32" cy="31" r="1.4" fill="currentColor" />
            </svg>
            <span className="game-name">Caça Palavras</span>
            <span className="game-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
