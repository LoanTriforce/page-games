import type { Metadata } from "next";
import { WordSearchGame } from "./word-search-game";

export const metadata: Metadata = {
  title: "Caça Palavras | Page Games",
  description: "Encontre as palavras do universo PAGE em 45 segundos.",
};

export default function WordSearchPage() {
  return <WordSearchGame />;
}
