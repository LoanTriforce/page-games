import type { Metadata } from "next";
import { Kumbh_Sans, Nunito_Sans } from "next/font/google";
import "./globals.css";

const displayFont = Kumbh_Sans({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Page Games | Sua pausa para jogar",
  description: "Escolha seu minigame no Page Games: memória, quiz e jogo da velha.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
