import type { Metadata } from "next";
import Link from "next/link";
import { RankingBoard } from "./ranking-board";
import { Logo } from "../ui/logo";

export const metadata: Metadata = {
  title: "Ranking | Page Games",
  description: "Ranking em tempo real do Caça Palavras do Grupo Page.",
};

export default function RankingPage() {
  return (
    <main className="event-ranking-page">
      <header className="event-ranking-header">
        <Link href="/" aria-label="Page Games — início"><Logo /></Link>
        <Link className="event-ranking-game-link" href="/caca-palavras">Abrir Caça Palavras <span aria-hidden="true">↗</span></Link>
      </header>
      <RankingBoard />
    </main>
  );
}
