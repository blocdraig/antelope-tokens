import { readFile, writeFile } from "node:fs/promises";
import chains from "../chains.json" with { type: "json" };
import { formatTokens, type Token } from "./token-utils.js";

const CHAINS = [...new Set(Object.values(chains))].sort();
const chainArg = process.argv.find((arg) => arg.startsWith("--chain="))?.split("=")[1];
const chainsToSort = chainArg ? [chainArg] : CHAINS;

if (chainArg && !CHAINS.includes(chainArg)) {
  throw new Error(`Unknown chain "${chainArg}". Supported: ${CHAINS.join(", ")}`);
}

for (const chain of chainsToSort) {
  const tokensPath = `${chain}/tokens.json`;
  const tokens = JSON.parse(await readFile(tokensPath, "utf8")) as Token[];
  const formatted = formatTokens(tokens);
  const current = await readFile(tokensPath, "utf8");

  if (current === formatted) {
    console.log(`${chain}: already sorted`);
    continue;
  }

  await writeFile(tokensPath, formatted);
  console.log(`${chain}: sorted ${tokens.length} tokens`);
}
