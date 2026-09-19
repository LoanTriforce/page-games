import type { Metadata } from "next";
import { RankingPresentation } from "./ranking-presentation";

export const metadata: Metadata = {
  title: "Apresentação do Ranking | Page Games",
  description: "Tela automática com imagens promocionais e ranking global do Caça Palavras.",
};

export default function RankingPresentationPage() {
  return <RankingPresentation />;
}
