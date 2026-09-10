import Link from "next/link";
import { Logo } from "../../ui/logo";
import { MemoryGame } from "./memory-game";

export const metadata = { title: "Jogo da Memória | Page Games" };

export default function MemoryPage() {
  return <main className="arcade-shell">
    <header className="site-header"><Link href="/" aria-label="Page Games — início"><Logo /></Link><Link className="back-link" href="/">← Todos os minigames</Link></header>
    <MemoryGame />
  </main>;
}
