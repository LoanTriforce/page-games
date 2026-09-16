import Link from "next/link";
import { Logo } from "../../../ui/logo";
import { BubblesRankingBoard } from "./bolinhas-ranking-board";
import "../bolinhas-style.css";

export const metadata = {
  title: "Ranking Bolinhas Page | Page Games",
  description: "Ranking local do jogo Bolinhas Page para eventos do Grupo Page.",
};

export default function BubblesRankingPage() {
  return (
    <main className="bubbles-page bubbles-ranking-shell">
      <header className="bubbles-header">
        <Link href="/" aria-label="Voltar ao Page Games"><Logo /></Link>
        <Link href="/minigames/bolinhas-page" className="bubbles-back">← Voltar para o jogo</Link>
      </header>
      <BubblesRankingBoard />
    </main>
  );
}
