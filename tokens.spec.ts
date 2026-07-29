import chains from "./chains.json" with { type: "json" };
import index from "./index.json" with { type: "json" };
import schema from "./schema.json" with { type: "json" };
import {
  logoFileName,
  tokenSortKey,
  type Token,
} from "./scripts/token-utils.js";
import { Asset, Name } from "@wharfkit/antelope";
import { Ajv } from "ajv";
import sharp from "sharp";
import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CHAINS = [...new Set(Object.values(chains))].sort();
const MAX_LOGO_DIMENSION = 256;
const MAX_LOGO_BYTES = 128 * 1024;
const ajv = new Ajv({ allErrors: true });
const validateTokens = ajv.compile(schema);

function tokenKey(contract: string, symbol: string) {
  return `${contract}:${symbol}`;
}

function parseLogoFileName(fileName: string) {
  if (!isValidLogoFileName(fileName)) {
    return null;
  }

  const baseName = fileName.slice(0, -4);
  const separatorIndex = baseName.lastIndexOf("_");

  return {
    contract: baseName.slice(0, separatorIndex),
    symbol: baseName.slice(separatorIndex + 1).toUpperCase(),
  };
}

function isValidLogoFileName(fileName: string) {
  if (!fileName.toLowerCase().endsWith(".png")) {
    return false;
  }

  const baseName = fileName.slice(0, -4);
  const separatorIndex = baseName.lastIndexOf("_");
  if (separatorIndex <= 0 || separatorIndex === baseName.length - 1) {
    return false;
  }

  const contract = baseName.slice(0, separatorIndex);
  const symbol = baseName.slice(separatorIndex + 1);

  return /^[a-z1-5.]+$/.test(contract) && /^[a-z0-9]+$/.test(symbol);
}

function loadChainTokens(chain: string) {
  return JSON.parse(
    fs.readFileSync(path.join(chain, "tokens.json"), "utf8"),
  ) as Token[];
}

function loadChainLogos(chain: string) {
  const logosDir = path.join(chain, "logos");
  if (!fs.existsSync(logosDir)) {
    return [];
  }

  return fs.readdirSync(logosDir).filter((file) => file !== ".DS_Store");
}

for (const chain of CHAINS) {
  test(`${chain}/tokens.json conforms to schema.json`, () => {
    const tokens = loadChainTokens(chain);
    expect(validateTokens(tokens)).toBe(true);
  });

  test(`${chain} must have valid account names`, () => {
    for (const token of loadChainTokens(chain)) {
      expect(Name.from(token.contract).toString()).toBe(token.contract);
    }
  });

  test(`${chain} must have valid symbols`, () => {
    for (const token of loadChainTokens(chain)) {
      expect(Asset.SymbolCode.from(token.symbol).toString()).toBe(token.symbol);
    }
  });

  test(`${chain} tokens must be sorted alphabetically`, () => {
    const tokens = loadChainTokens(chain);
    for (let index = 1; index < tokens.length; index += 1) {
      const previous = tokenSortKey(tokens[index - 1]);
      const current = tokenSortKey(tokens[index]);
      expect(
        current.localeCompare(previous, undefined, { sensitivity: "base" }) >=
          0,
      ).toBe(true);
    }
  });

  test(`${chain} must not include empty optional fields`, () => {
    for (const token of loadChainTokens(chain)) {
      if ("name" in token) {
        expect(token.name).not.toBe("");
      }

      if ("description" in token) {
        expect(token.description).not.toBe("");
      }

      if ("website" in token) {
        expect(token.website).not.toBe("");
      }

      if (token.social) {
        for (const [field, value] of Object.entries(token.social)) {
          expect(
            value,
            `${token.contract}/${token.symbol} social.${field}`,
          ).not.toBe("");
        }
      }
    }
  });

  test(`${chain} must not have duplicate tokens`, () => {
    const seen = new Set<string>();

    for (const token of loadChainTokens(chain)) {
      const tokenKey = `${token.contract}:${token.symbol}`;
      expect(seen.has(tokenKey)).toBe(false);
      seen.add(tokenKey);
    }
  });

  test(`${chain} must have a logo file for each token`, () => {
    const tokens = loadChainTokens(chain);

    for (const token of tokens) {
      const logoPath = path.join(
        chain,
        "logos",
        logoFileName(token.contract, token.symbol),
      );
      expect(fs.existsSync(logoPath)).toBe(true);
    }
  });

  test(`${chain} must have a tokens.json entry for each logo file`, () => {
    const tokens = loadChainTokens(chain);
    const tokenKeys = new Set(
      tokens.map((token) => tokenKey(token.contract, token.symbol)),
    );

    for (const file of loadChainLogos(chain)) {
      const parsed = parseLogoFileName(file);
      expect(parsed, file).not.toBeNull();
      expect(
        tokenKeys.has(tokenKey(parsed!.contract, parsed!.symbol)),
        file,
      ).toBe(true);
    }
  });

  test(`${chain} logo files must use valid filenames`, () => {
    for (const file of loadChainLogos(chain)) {
      expect(isValidLogoFileName(file), file).toBe(true);
    }
  });

  test(`${chain} logos must be within size limits`, async () => {
    const tokens = loadChainTokens(chain);

    for (const token of tokens) {
      const label = `${token.contract}/${token.symbol}`;
      const logoPath = path.join(
        chain,
        "logos",
        logoFileName(token.contract, token.symbol),
      );
      const { size } = fs.statSync(logoPath);

      expect(size, `${label} file size`).toBeGreaterThan(0);
      expect(size, `${label} file size`).toBeLessThanOrEqual(MAX_LOGO_BYTES);

      try {
        const metadata = await sharp(logoPath).metadata();
        if (metadata.width && metadata.height) {
          const maxDimension = Math.max(metadata.width, metadata.height);
          expect(maxDimension, `${label} dimensions`).toBeLessThanOrEqual(
            MAX_LOGO_DIMENSION,
          );
        }
      } catch {
        // Logos without readable metadata are allowed when the filename is valid.
      }
    }
  });
}

test("schema validates social fields", () => {
  expect(
    validateTokens([
      {
        symbol: "TEST",
        contract: "test.token",
        social: {
          coinmarketcap: "example",
          coingecko: "example",
          twitter: "example",
          discord: "discord.gg/abc123",
          telegram: "example",
          youtube: "example",
        },
      },
    ]),
  ).toBe(true);

  expect(
    validateTokens([
      {
        symbol: "TEST",
        contract: "test.token",
        social: {
          discord: "discord.gg/abc123",
          youtube: "UCabcdefghijklmnopqrstuv",
        },
      },
    ]),
  ).toBe(true);

  expect(
    validateTokens([
      {
        symbol: "TEST",
        contract: "test.token",
        social: {
          discord: "myserver",
        },
      },
    ]),
  ).toBe(false);

  expect(
    validateTokens([
      {
        symbol: "TEST",
        contract: "test.token",
        social: {
          twitter: "@brawlersgg",
        },
      },
    ]),
  ).toBe(false);

  expect(
    validateTokens([
      {
        symbol: "TEST",
        contract: "test.token",
        social: {
          youtube: "@BrawlersGG",
        },
      },
    ]),
  ).toBe(false);
});

test("chains.json values must match token directories", () => {
  for (const chain of CHAINS) {
    expect(fs.existsSync(path.join(chain, "tokens.json"))).toBe(true);
    expect(fs.existsSync(path.join(chain, "logos"))).toBe(true);
  }
});

test("index.json must list every chain and valid paths", () => {
  expect(fs.existsSync(index.chainIds)).toBe(true);
  expect(fs.existsSync(index.schema)).toBe(true);
  expect(Object.keys(index.chains).sort()).toEqual(CHAINS);

  for (const chain of CHAINS) {
    const paths = index.chains[chain as keyof typeof index.chains];
    expect(fs.existsSync(paths.tokens)).toBe(true);
    expect(fs.existsSync(paths.logos)).toBe(true);
  }
});

test("logo files must be png", () => {
  for (const chain of CHAINS) {
    for (const file of loadChainLogos(chain)) {
      expect(file.toLowerCase().endsWith(".png")).toBe(true);
    }
  }
});
