import Link from "next/link";
import { Logo } from "../../ui/logo";
import { BubblesGame } from "./bolinhas-game";
import "./bolinhas-style.css";

export const metadata = {
  title: "Bolinhas Page | Page Games",
  description: "Clique nas bolinhas com os produtos Page e dispute o ranking do evento.",
};

export default function BubblesPage() {
  return (
    <main className="bubbles-page">
      <header className="bubbles-header">
        <Link href="/" aria-label="Voltar ao Page Games"><Logo /></Link>
        <Link href="/" className="bubbles-back">← Todos os minigames</Link>
      </header>
      <BubblesGame />
    </main>
  );
}
