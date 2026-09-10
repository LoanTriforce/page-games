import Link from "next/link";
import { notFound } from "next/navigation";
import { games } from "../../games";
import { Logo } from "../../ui/logo";

export function generateStaticParams() {
  return games.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = games.find((item) => item.slug === slug);
  return { title: game ? `${game.name} | Page Games` : "Minigame não encontrado | Page Games" };
}

export default async function MinigamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = games.find((item) => item.slug === slug);
  if (!game) notFound();
  return (
    <main className="arcade-shell">
      <header className="site-header"><Link href="/" aria-label="Page Games — início"><Logo /></Link><Link className="back-link" href="/">← Todos os minigames</Link></header>
      <section className={`coming-soon ${game.theme}`}>
        <span className="eyebrow">{game.category}</span><h1>{game.name}</h1><p>{game.description}</p>
        <span className="coming-badge">Em breve</span><p>Estamos preparando este desafio. Volte em breve para jogar!</p>
        <Link className="return-button" href="/">Voltar para o início <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
  );
}
