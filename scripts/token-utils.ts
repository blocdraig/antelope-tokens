export type TokenSocial = {
  coinmarketcap?: string;
  coingecko?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  instagram?: string;
  medium?: string;
  facebook?: string;
  youtube?: string;
  wechat?: string;
  reddit?: string;
};

export type Token = {
  symbol: string;
  contract: string;
  name?: string;
  description?: string;
  website?: string;
  social?: TokenSocial;
};

const SOCIAL_FIELDS = [
  "coinmarketcap",
  "coingecko",
  "discord",
  "facebook",
  "instagram",
  "medium",
  "reddit",
  "telegram",
  "twitter",
  "wechat",
  "youtube",
] as const satisfies ReadonlyArray<keyof TokenSocial>;

export function logoFileName(contract: string, symbol: string) {
  return `${contract}_${symbol.toLowerCase()}.png`;
}

export function tokenSortKey(token: Token) {
  return token.name ?? token.symbol;
}

function normalizeSocial(social?: TokenSocial) {
  if (!social) {
    return undefined;
  }

  const normalized: TokenSocial = {};

  for (const field of SOCIAL_FIELDS) {
    const value = social[field];
    if (value) {
      normalized[field] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeToken(token: Token) {
  const normalized: Token = {
    symbol: token.symbol,
    contract: token.contract,
  };

  if (token.name) {
    normalized.name = token.name;
  }

  if (token.description) {
    normalized.description = token.description;
  }

  if (token.website) {
    normalized.website = token.website;
  }

  const social = normalizeSocial(token.social);
  if (social) {
    normalized.social = social;
  }

  return normalized;
}

export function sortTokens(tokens: Token[]) {
  return [...tokens]
    .map(normalizeToken)
    .sort((a, b) =>
      tokenSortKey(a).localeCompare(tokenSortKey(b), undefined, {
        sensitivity: "base",
      }),
    );
}

export function formatTokens(tokens: Token[]) {
  return `${JSON.stringify(sortTokens(tokens), null, 2)}\n`;
}
