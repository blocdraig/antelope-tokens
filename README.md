# Antelope Tokens

Token metadata and logos for Antelope chains.

## Structure

```
chains.json          # chain IDs mapped to chain names
index.json           # paths to token lists and logo directories
schema.json          # JSON schema for token lists
{chain}/tokens.json  # token metadata per chain
{chain}/logos/       # PNG logos per chain
```

Supported chains: `eos`, `wax`, `telos`, `xpr`

## Usage

Fetch token lists and logos directly from GitHub. No clone or submodule required.

**Base URL**

```
https://raw.githubusercontent.com/blocdraig/antelope-tokens/main
```

Start with [`index.json`](index.json) for paths to every chain and metadata file.

**Token list**

```
https://raw.githubusercontent.com/blocdraig/antelope-tokens/main/wax/tokens.json
```

**Logo for a token**

Logos follow `{contract}_{symbol}.png` (symbol is lowercase):

```
https://raw.githubusercontent.com/blocdraig/antelope-tokens/main/wax/logos/eosio.token_wax.png
```

**Example**

```ts
const tokens = await fetch(
  `https://raw.githubusercontent.com/blocdraig/antelope-tokens/main/wax/tokens.json`,
).then((response) => response.json());

function logoUrl(chain: string, contract: string, symbol: string) {
  return `https://raw.githubusercontent.com/blocdraig/antelope-tokens/main/${chain}/logos/${contract}_${symbol.toLowerCase()}.png`;
}

for (const token of tokens) {
  console.log(token.symbol, logoUrl("wax", token.contract, token.symbol));
}
```

**Other files**

| File            | URL                                      |
| --------------- | ---------------------------------------- |
| Discovery index | [`index.json`](index.json)               |
| Chain IDs       | [`chains.json`](chains.json)             |
| JSON schema     | [`schema.json`](schema.json)             |
| EOS tokens      | [`eos/tokens.json`](eos/tokens.json)     |
| WAX tokens      | [`wax/tokens.json`](wax/tokens.json)     |
| Telos tokens    | [`telos/tokens.json`](telos/tokens.json) |
| XPR tokens      | [`xpr/tokens.json`](xpr/tokens.json)     |

**Chain ID lookup**

Use `chains.json` to map a chain ID to a chain name, then fetch `{chain}/tokens.json`:

```ts
const chainIds = await fetch(`${RAW_BASE}/chains.json`).then((response) =>
  response.json(),
);

const chain =
  chainIds["1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4"];
// "wax"
```

**Pinning a version**

Replace `main` with a commit SHA or tag for reproducible builds:

```
https://raw.githubusercontent.com/blocdraig/antelope-tokens/<commit>/wax/tokens.json
```

**CDN mirror**

[jsDelivr](https://www.jsdelivr.com/) can cache GitHub files:

```
https://cdn.jsdelivr.net/gh/blocdraig/antelope-tokens@main/wax/tokens.json
```

## Token format

Each `{chain}/tokens.json` file is a sorted array of tokens:

Required fields:

```json
{
  "symbol": "SYS",
  "contract": "eosio.token"
}
```

Optional fields (`name`, `description`, `website`, `social`) may be included when present. Omit empty values.

```json
{
  "symbol": "SYS",
  "contract": "eosio.token",
  "name": "System Token",
  "website": "https://example.com",
  "social": {
    "twitter": "example",
    "discord": "discord.gg/example",
    "telegram": "example",
    "youtube": "example"
  }
}
```

### Social fields

All fields are optional inside `social`. Omit the whole `social` object when empty. Usernames and slugs only — no `@` prefix or full URLs.

| Field | Format | Example |
| --- | --- | --- |
| `coinmarketcap` | CoinMarketCap slug | `eos` |
| `coingecko` | CoinGecko coin ID | `eos` |
| `twitter` | Username | `example` |
| `discord`   | Invite link                | `discord.gg/example` or `discord.com/invite/example` |
| `telegram`  | Username                   | `example`                                            |
| `instagram` | Username                   | `example`                                            |
| `medium`    | Username                   | `example`                                            |
| `facebook`  | Page username              | `example`                                            |
| `youtube`   | Channel handle or ID       | `example` or `UCxxxxxxxx`                            |
| `wechat`    | WeChat ID                  | `example`                                            |
| `reddit`    | Username or subreddit name | `example`                                            |

See [`schema.json`](schema.json) for validation rules.

## Logos

Each token in `tokens.json` must have exactly one matching PNG logo, and every logo file must have a matching token entry:

```
{chain}/logos/{contract}_{symbol}.png
```

Example: `eos/logos/eosio.token_sys.png`

Logo requirements:

- PNG format with a valid filename (`{contract}_{symbol}.png`)
- Max 128 KB file size for listed tokens
- Max 256px width or height when image dimensions are available

## Adding a token

Anyone with a GitHub account can contribute tokens through a pull request. You do not need collaborator access to this repository.

1. Click **Fork** on [this repository](https://github.com/blocdraig/antelope-tokens) to create a copy in your own GitHub account
2. Clone your fork and create a branch for your token addition
3. Add an entry to the correct `{chain}/tokens.json`
4. Add the matching PNG logo to `{chain}/logos/`, following the requirements above
5. Run `npm ci`, then `npm run sort` to sort tokens alphabetically by name, or by symbol when name is omitted
6. Run `npm test` to validate your changes
7. Commit your changes and push the branch to your fork
8. Open a pull request from your branch to `blocdraig/antelope-tokens`, targeting `main`. Include the chain, token contract, symbol, and a link to the token's official website or block explorer page

Checks on pull requests from external contributors may wait for maintainer approval before running.

## Scripts

```bash
npm ci
npm test
npm run sort
```

- `npm test` — validate token lists, logos, sorting, and duplicates
- `npm run sort` — sort `{chain}/tokens.json` files by token name
- `npm run check:contracts` — verify token contracts exist on-chain
- `--remove` — remove tokens whose contract account does not exist
- `--dry-run` — preview changes without writing files

RPC endpoints are configured in [`rpc.json`](rpc.json).
