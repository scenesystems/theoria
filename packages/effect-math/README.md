# effect-math

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Foundational mathematics and statistics for the [Theoria](https://github.com/scenesystems/theoria) ecosystem.

## Features

- Domain-first package topology for numerics, algebra, linear algebra, calculus, special functions, probability, statistics, optimization, and geometry
- Model-contract-schema parity per domain
- Pure kernel and Effect boundary separation
- Public subpath exports by domain
- Dedicated `effect-math/experimental` consumer-facing unstable lane with explicit boundary semantics
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

### Experimental Lane

```ts
import { ExperimentalSeams } from "effect-math/experimental"

const unstableSurfaces = ExperimentalSeams
```

The experimental lane is intentionally unstable and consumer-facing; it is preserved as a separate subpath and does not leak through the stable root entrypoint.

## Test Architecture

1. Target-state contract tests live alongside architecture and parity suites.
2. Merge readiness requires all suites green, including `test/target-state`.
3. Property, fixture, benchmark-guard, and stability-surface governance suites run in normal verification.

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
