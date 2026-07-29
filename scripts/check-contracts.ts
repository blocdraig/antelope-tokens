import { access, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import chains from "../chains.json" with { type: "json" };
import rpc from "../rpc.json" with { type: "json" };
import { APIClient, APIError } from "@wharfkit/antelope";
import { formatTokens, type Token } from "./token-utils.js";

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const dryRun = args.includes("--dry-run");
const CHAINS = [...new Set(Object.values(chains))].sort();
const chainArg = args.find((arg) => arg.startsWith("--chain="))?.split("=")[1];
const chainsToCheck = chainArg ? [chainArg] : CHAINS;

if (chainArg && !CHAINS.includes(chainArg)) {
  throw new Error(`Unknown chain "${chainArg}". Supported: ${CHAINS.join(", ")}`);
}

function logoFileName(contract: string, symbol: string) {
  return `${contract}_${symbol.toLowerCase()}.png`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = index++;
      await worker(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, next),
  );
}

function isMissingAccount(error: unknown) {
  if (!(error instanceof APIError)) {
    return false;
  }

  if (error.message.includes("Account Query Exception")) {
    return true;
  }

  if (error.message.includes("Account not found")) {
    return true;
  }

  return error.details.some((detail) => detail.message.includes("unknown key"));
}

async function accountExists(client: APIClient, contract: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await client.v1.chain.get_account(contract);
      return true;
    } catch (error) {
      if (isMissingAccount(error)) {
        return false;
      }

      const status =
        error instanceof APIError ? error.response.status : undefined;
      const retryable = status === 420 || status === 429 || status === 503;

      if (retryable && attempt < 4) {
        await sleep(500 * 2 ** attempt);
        continue;
      }

      throw error;
    }
  }

  return false;
}

async function checkChain(chain: string) {
  const endpoint = rpc[chain as keyof typeof rpc];
  if (!endpoint) {
    throw new Error(`No RPC endpoint configured for chain "${chain}"`);
  }

  const tokensPath = `${chain}/tokens.json`;
  const tokens = JSON.parse(await readFile(tokensPath, "utf8")) as Token[];
  const contracts = [...new Set(tokens.map((token) => token.contract))].sort();
  const client = new APIClient({ url: endpoint });
  const missing = new Set<string>();
  let checked = 0;

  await runWithConcurrency(contracts, 4, async (contract) => {
    const exists = await accountExists(client, contract);
    checked += 1;

    if (checked % 25 === 0) {
      process.stdout.write(`  checked ${checked}/${contracts.length}\r`);
    }

    if (!exists) {
      missing.add(contract);
    }
  });

  const missingContracts = [...missing].sort();
  const invalidTokens = tokens.filter((token) => missing.has(token.contract));

  console.log(`\n${chain}: checked ${contracts.length} contract(s) via ${endpoint}`);

  if (invalidTokens.length === 0) {
    console.log("  all contracts exist");
    return 0;
  }

  for (const contract of missingContracts) {
    const symbols = invalidTokens
      .filter((token) => token.contract === contract)
      .map((token) => token.symbol)
      .join(", ");

    console.log(`  missing ${contract} (${symbols})`);
  }

  if (!remove) {
    return invalidTokens.length;
  }

  const prefix = dryRun ? "would remove" : "removed";
  let removedLogos = 0;

  for (const token of invalidTokens) {
    const logoPath = path.join(
      chain,
      "logos",
      logoFileName(token.contract, token.symbol),
    );

    console.log(`  ${prefix} token ${token.contract}/${token.symbol}`);

    if (await fileExists(logoPath)) {
      console.log(`  ${prefix} logo ${logoPath}`);

      if (!dryRun) {
        await unlink(logoPath);
      }

      removedLogos += 1;
    }
  }

  const validTokens = tokens.filter((token) => !missing.has(token.contract));

  if (!dryRun) {
    await writeFile(tokensPath, formatTokens(validTokens));
  }

  console.log(
    `  ${prefix} ${invalidTokens.length} token(s) and ${removedLogos} logo(s)`,
  );

  return invalidTokens.length;
}

let failures = 0;

for (const chain of chainsToCheck) {
  failures += await checkChain(chain);
}

if (failures > 0) {
  const action = remove
    ? dryRun
      ? "would be removed"
      : "removed"
    : "found";

  console.log(`\n${failures} invalid token(s) ${action}.`);

  if (!remove || dryRun) {
    process.exit(1);
  }
}

console.log("\nDone.");
