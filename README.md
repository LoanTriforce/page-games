# page-games
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Rankings globais

Os rankings globais usam Supabase como backend persistente, porque o projeto é exportado como site estático para GitHub Pages. Cada mini game com ranking global possui sua própria tabela e sua própria regra de ordenação.

Mini games persistentes configurados:

- `word-search` — Caça-Palavras — tabela `word_search_rankings` — rota `/ranking`
- `memory-game` — Jogo da Memória — tabela `memory_rankings` — rota `/minigames/memoria`
- `reaction-game` — Bolinhas Page — tabela `bubbles_rankings` — rota `/minigames/bolinhas-page/ranking`
- `find-ticket` — Encontre Tudo — tabela `find_ticket_rankings` — rota `/minigames/encontre-o-ingresso`

Essa separação impede que resultados do Caça-Palavras apareçam no ranking do Bolinhas Page, e vice-versa. A configuração administrativa dos jogos fica em `config/ranking-games.json`.

1. Crie um projeto no Supabase.
2. Execute os SQLs necessários no SQL Editor do Supabase:
   - `supabase/word-search-ranking.sql`
   - `supabase/memory-ranking.sql`
   - `supabase/bubbles-ranking.sql`
   - `supabase/find-ticket-ranking.sql`
3. Configure as variáveis públicas do `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-public
NEXT_PUBLIC_WORD_SEARCH_RANKING_TABLE=word_search_rankings
NEXT_PUBLIC_MEMORY_RANKING_TABLE=memory_rankings
NEXT_PUBLIC_BUBBLES_RANKING_TABLE=bubbles_rankings
NEXT_PUBLIC_FIND_TICKET_RANKING_TABLE=find_ticket_rankings
```

Em produção, adicione as mesmas variáveis em Settings > Secrets and variables > Actions > Variables no GitHub.

O Caça-Palavras solicita nome e telefone antes de cada rodada, inicia o cronômetro apenas depois desses dados válidos e envia automaticamente o resultado ao finalizar. A tela `/ranking` consulta o Supabase a cada 3 segundos, já ordenada por mais palavras encontradas, menor tempo de resultado, maior pontuação e finalização mais antiga.

A pontuação do Caça-Palavras é calculada no código e validada no banco com a fórmula `palavras_encontradas * 100000 - tempo_total_ms`, limitada ao mínimo de zero. O campo `tempo_total_ms` representa o tempo da última palavra encontrada na rodada, e os tempos individuais ficam armazenados internamente em `palavras_detalhadas`.

O Jogo da Memória salva resultados na tabela `memory_rankings` e a tela de ranking dentro de `/minigames/memoria` consulta essa tabela a cada 3 segundos, ordenando por maior pontuação, menor tempo e data mais antiga.

O Bolinhas Page salva resultados na tabela `bubbles_rankings` e a rota `/minigames/bolinhas-page/ranking` consulta essa tabela a cada 3 segundos, ordenando por maior quantidade de bolinhas clicadas, menor tempo, maior pontuação e data mais antiga.

O Encontre Tudo salva resultados na tabela `find_ticket_rankings` e o ranking exibido em `/minigames/encontre-o-ingresso` consulta essa tabela a cada 3 segundos, ordenando por maior pontuação, menor tempo e data mais antiga.

## Limpeza administrativa de ranking

A interface pública não possui botão para limpar ranking. A limpeza deve ser feita somente pelo administrador no Git Bash com chave administrativa do Supabase carregada localmente.

A variável abaixo deve existir apenas no ambiente local do administrador ou no servidor seguro. Ela não deve ser exposta como `NEXT_PUBLIC_` e não deve ser versionada:

```bash
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

Comandos disponíveis:

```bash
npm run ranking:clear -- --game=word-search
npm run ranking:clear -- --game=memory-game
npm run ranking:clear -- --game=reaction-game
npm run ranking:clear -- --game=find-ticket
npm run ranking:clear -- --all
```

Aliases aceitos:

- `caca-palavras`, `caça-palavras`, `caca`, `wordsearch` apontam para `word-search`
- `memoria`, `memória`, `jogo-da-memoria`, `jogo-da-memória`, `memory` apontam para `memory-game`
- `bolinhas`, `bolinhas-page`, `bubbles`, `jogo-de-reflexo` apontam para `reaction-game`
- `encontre-o-ingresso`, `encontre-tudo`, `caça-aos-objetos`, `caca-aos-objetos`, `bag-hunt` apontam para `find-ticket`

Proteções contra exclusão acidental:

- `npm run ranking:clear` sem parâmetros não apaga nada e mostra instruções de uso.
- `--game` inválido não apaga nada e lista os mini games disponíveis.
- `--game` e `--all` não podem ser usados juntos.
- Antes de apagar, o script consulta e mostra o total de registros afetados.
- A exclusão só continua se o administrador digitar exatamente `CONFIRMAR`.
- `--game=word-search` apaga somente `word_search_rankings`.
- `--game=memory-game` apaga somente `memory_rankings`.
- `--game=reaction-game` apaga somente `bubbles_rankings`.
- `--game=find-ticket` apaga somente `find_ticket_rankings`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
