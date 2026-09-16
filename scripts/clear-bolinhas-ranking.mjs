#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
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

async function main() {
  loadDotEnv(path.join(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não foi encontrado no ambiente ou no .env.local.");
  }
  if (!serviceKey) {
    throw new Error("Defina SUPABASE_SERVICE_ROLE_KEY no Git Bash antes de limpar o ranking de bolinhas.");
  }

  console.log("Este comando limpa somente o ranking global do jogo Bolinhas Page.");
  console.log("Tabela alvo: public.bubbles_rankings");
  console.log("O ranking do caça-palavras não será alterado.\n");

  const confirmation = await ask("Digite LIMPAR para confirmar: ");
  if (confirmation !== "LIMPAR") {
    console.log("Operação cancelada. Nenhum dado foi apagado.");
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/bubbles_rankings?id=not.is.null`, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
      Accept: "application/json",
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Falha ao limpar o ranking (${response.status}): ${body}`);
  }

  const removed = body ? JSON.parse(body).length : 0;
  console.log(`Ranking de bolinhas limpo com sucesso. Registros removidos: ${removed}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
