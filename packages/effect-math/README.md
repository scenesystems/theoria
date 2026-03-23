# effect-math

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Foundational mathematics and statistics for the [Theoria](https://github.com/scenesystems/theoria) ecosystem.

## Features

- Domain-first package topology for numerics, algebra, linear algebra, calculus, special functions, probability, statistics, optimization, and geometry
- Model-contract-schema parity per domain
- Pure kernel and Effect boundary separation
- Public subpath exports by domain
- Internal implementation boundaries blocked via exports policy

## Install

```sh
bun add effect-math
```

## Usage

```ts
import { NumericDomainContract, loadNumericDomain } from "effect-math/Numeric"
import { Effect } from "effect"

const contract = NumericDomainContract
const domain = Effect.runSync(loadNumericDomain)
```

## M1–M2 Status

1. Package bootstrap and governance baseline
2. Canonical domain file-system skeleton and boundary scaffolding

## Test Architecture

1. Target-state contract tests live alongside architecture and parity suites.
2. Merge readiness requires all suites green, including `test/target-state`.

### Commands

```sh
bun run check
bun run check:tests
bun run lint
bun run test
bun run build
```

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
