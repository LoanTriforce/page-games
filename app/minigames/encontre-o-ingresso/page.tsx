import Link from "next/link";
import { Logo } from "../../ui/logo";
import { FindObjectsGame } from "./countdown-game";
import "./style.css";
import "./style-v2.css";
import "./style-v3.css";

export const metadata = { title: "Encontre tudo na bolsa | Page Games", description: "Encontre todos os itens escondidos na bolsa da Page Eventos." };

export default function FindTicketPage() {
  return <main className="find-ticket-page"><header className="find-ticket-header"><Link href="/" aria-label="Voltar ao Page Games"><Logo /></Link><Link href="/" className="find-ticket-back">← Todos os minigames</Link></header><FindObjectsGame /></main>;
}
