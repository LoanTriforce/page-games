#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const CONFIRMATION_WORD = "CONFIRMAR";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadRankingGames() {
  const configPath = path.join(process.cwd(), "config", "ranking-games.json");
  const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

  return rawConfig.map((game) => ({
    ...game,
    table: process.env[game.tableEnv] || game.defaultTable,
  }));
}

function parseArgs(argv) {
  const args = { game: "", all: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--game") args.game = argv[index + 1] || "";
    else if (arg.startsWith("--game=")) args.game = arg.slice("--game=".length);
  }

  return args;
}

function printUsage(games) {
  console.log("Informe qual ranking deseja limpar.");
  console.log("");
  console.log("Uso:");
  console.log("  npm run ranking:clear -- --game=word-search");
  console.log("  npm run ranking:clear -- --game=reaction-game");
  console.log("  npm run ranking:clear -- --all");
  console.log("");
  console.log("Mini games disponíveis:");
  for (const game of games) console.log(`- ${game.game} (${game.label})`);
}

function resolveGame(games, gameSlug) {
  const normalized = gameSlug.trim().toLowerCase();
  return games.find((game) => game.game === normalized || game.aliases.includes(normalized)) || null;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function getSupabaseAdminConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL não foi encontrado no ambiente ou no .env.local.");
  if (!serviceKey) throw new Error("Defina SUPABASE_SERVICE_ROLE_KEY no Git Bash antes de limpar rankings.");

  return { supabaseUrl, serviceKey };
}

function getSupabaseHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: "application/json",
  };
}

async function countRankingRows(config, game) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${game.table}?select=id`, {
    headers: {
      ...getSupabaseHeaders(config.serviceKey),
      Prefer: "count=exact",
      Range: "0-0",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${game.label} (${response.status}): ${await response.text()}`);
  }

  const contentRange = response.headers.get("content-range") || "";
  const total = Number(contentRange.split("/").at(-1));
  return Number.isFinite(total) ? total : 0;
}

async function deleteRankingRows(config, game) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${game.table}?id=not.is.null`, {
    method: "DELETE",
    headers: {
      ...getSupabaseHeaders(config.serviceKey),
      Prefer: "return=representation",
    },
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Falha ao limpar ${game.label} (${response.status}): ${body}`);

  return body ? JSON.parse(body).length : 0;
}

async function confirmSingleGame(game, totalRows) {
  console.log(`Você está prestes a apagar o ranking: ${game.game} (${game.label})`);
  console.log(`Tabela alvo: public.${game.table}`);
  console.log(`Total de registros: ${totalRows}`);
  console.log("Os demais rankings não serão alterados.");
  console.log("");

  const answer = await ask(`Digite ${CONFIRMATION_WORD} para prosseguir: `);
  return answer === CONFIRMATION_WORD;
}

async function confirmAllGames(gamesWithCounts) {
  console.log("ATENÇÃO: isso apagará TODOS os rankings globais do Page Games.");
  for (const { game, totalRows } of gamesWithCounts) {
    console.log(`- ${game.game} (${game.label}): ${totalRows} registros em public.${game.table}`);
  }
  console.log("");

  const answer = await ask(`Digite ${CONFIRMATION_WORD} para prosseguir: `);
  return answer === CONFIRMATION_WORD;
}

async function main() {
  loadDotEnv(path.join(process.cwd(), ".env.local"));

  const games = loadRankingGames();
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (!args.game && !args.all)) {
    printUsage(games);
    return;
  }

  if (args.game && args.all) {
    throw new Error("Use apenas --game=<mini-game> ou --all, nunca os dois juntos.");
  }

  if (args.game) {
    const game = resolveGame(games, args.game);
    if (!game) {
      console.log("Mini game não encontrado.");
      console.log("");
      printUsage(games);
      return;
    }

    const config = getSupabaseAdminConfig();
    const totalRows = await countRankingRows(config, game);
    const confirmed = await confirmSingleGame(game, totalRows);

    if (!confirmed) {
      console.log("Operação cancelada. Nenhum dado foi apagado.");
      return;
    }

    const removed = await deleteRankingRows(config, game);
    console.log(`Ranking \"${game.game}\" limpo com sucesso. Registros removidos: ${removed}.`);
    return;
  }

  const config = getSupabaseAdminConfig();
  const gamesWithCounts = [];
  for (const game of games) gamesWithCounts.push({ game, totalRows: await countRankingRows(config, game) });

  const confirmed = await confirmAllGames(gamesWithCounts);
  if (!confirmed) {
    console.log("Operação cancelada. Nenhum dado foi apagado.");
    return;
  }

  for (const { game } of gamesWithCounts) {
    const removed = await deleteRankingRows(config, game);
    console.log(`Ranking \"${game.game}\" limpo com sucesso. Registros removidos: ${removed}.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
