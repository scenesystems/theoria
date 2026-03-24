# Theoria

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Effect libraries for optimization, language model programming, applied math, and cryptography.

_Theoria_ (θεωρία) — observation that produces knowledge.

[Packages](#packages) · [Development](#development) · [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md)

---

## Packages

```
effect-dsp              Language model programming (DSPy for Effect)
    ↓ uses
effect-search           Bayesian optimization (TPE, multi-objective, constrained)
    ↓ uses
effect-math             Numerics, linear algebra, statistics, probability, special functions

@scenesystems/digest    BLAKE3-256, SHA-256, JCS canonicalization
@scenesystems/seal      XChaCha20-Poly1305, AES-256-GCM-SIV, AES-256-GCM
@scenesystems/sign      Ed25519, ML-DSA, SLH-DSA, X25519, XWing
```

### [`effect-search`](./packages/effect-search) — Bayesian optimization

Black-box optimization with typed search spaces. When you can run a thing and measure how well it did but there's no gradient to follow, this replaces trial-and-error with algorithms that learn from previous results.

```ts
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    temperature: SearchSpace.float(0, 2),
    maxTokens: SearchSpace.int(50, 500),
    model: SearchSpace.categorical(["gpt-4o", "gpt-4o-mini"])
  })

  return yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: (params) => evaluate(params),
    trials: 100
  })
})
```

TPE, MOTPE, Grid, Random, HyperBand/BOHB. Constraints, pruning, warm-starting, snapshot/resume, parallel evaluation. Mathematical correctness verified against [Optuna](https://github.com/optuna/optuna) via deterministic golden fixtures. [README →](./packages/effect-search/README.md)

### [`effect-dsp`](./packages/effect-dsp) — Language model programming

Effect-native [DSPy](https://dspy.ai/). Typed signatures, learnable modules, prompt optimization — without leaving the Effect ecosystem.

```ts
import { Effect, Schema } from "effect"
import { Module, Signature } from "effect-dsp"

const program = Effect.gen(function* () {
  const qa = yield* Signature.make(
    "Answer questions with short factual answers",
    { question: Signature.describe(Schema.String, "The question to answer") },
    { answer: Signature.describe(Schema.String, "A concise factual answer") }
  )

  return yield* Module.predict("qa", qa)
})
```

LabeledFewShot, BootstrapFewShot, BootstrapRS, Ensemble, MIPROv2, GEPA. Uses `effect-search` for optimizer orchestration. [README →](./packages/effect-dsp/README.md)

### [`effect-math`](./packages/effect-math) — Applied math

Nine domains: numerics, linear algebra, geometry, probability, statistics, special functions, algebra, calculus, and optimization solvers. Pure kernels for the hot path, Effect wrappers when you need typed errors or runtime policies.

```ts
import { Chunk } from "effect"
import { dot, normL2 } from "effect-math/LinearAlgebra"
import { mean, variance } from "effect-math/Statistics"
import { gamma, erf } from "effect-math/Special"

dot(Chunk.fromIterable([1, 2, 3]), Chunk.fromIterable([4, 5, 6])) // 32
mean(Chunk.fromIterable([2, 4, 6])) // 4
gamma(5) // 24 (= 4!)
erf(1) // ≈ 0.8427
```

Schema-validated boundaries, configurable precision policies via `Layer`, SciPy fixture parity across all domains. [README →](./packages/effect-math/README.md)

### [`@scenesystems/digest`](./packages/digest) — Content hashing

```ts
import { digest } from "@scenesystems/digest"

digest("blake3-256", { user: "alice", score: 42 })
// "blake3-256:eT9Imnjd2CADODvozkIZQ3Cyt0k9yWL5A5rk3HlVTxo"
```

BLAKE3-256, SHA-256, HMAC, HKDF. RFC 8785 JCS canonicalization, base64url encoding. [README →](./packages/digest/README.md)

### [`@scenesystems/seal`](./packages/seal) — Authenticated encryption

```ts
import { generateKey, seal, unseal } from "@scenesystems/seal"

const key = generateKey(32)
const envelope = seal("xchacha20-poly1305", key, plaintext)
const recovered = unseal(key, envelope)
```

XChaCha20-Poly1305, AES-256-GCM-SIV, AES-256-GCM. Nonce generation, authentication, and self-describing envelopes handled for you. [README →](./packages/seal/README.md)

### [`@scenesystems/sign`](./packages/sign) — Digital signatures and key exchange

```ts
import { generateKeyPair, sign, verify } from "@scenesystems/sign"

const keys = generateKeyPair("ed25519")
const sig = sign("ed25519", message, keys.secretKey, keys.publicKey)
verify(sig, message)
```

Ed25519, secp256k1 (ECDSA + Schnorr), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), X25519, XWing hybrid post-quantum KEM. [README →](./packages/sign/README.md)

## Design

`effect-math` exposes three tiers per domain: pure kernels (`dot`, `mean`, `gamma`), schema-validated boundaries (`dotValidated`), and policy-aware operations (`meanWithPolicies`) that read precision and diagnostics config from `Layer`. Import what you need — `effect-math/LinearAlgebra`, `effect-math/Statistics`, etc.

`effect-search` and `effect-dsp` follow the same subpath convention. The `@scenesystems/*` crypto packages each have a single entrypoint.

## Development

Requires [bun](https://bun.sh) ≥ 1.3.

```sh
bun install
bun run check    # Type check
bun run test     # Test
bun run lint     # Lint (--max-warnings=0)
bun run build    # ESM + CJS
```

Per-package:

```sh
bun run --filter effect-search test
bun run --filter @scenesystems/digest test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Acknowledgments

### effect-search

TPE implements [Bergstra et al. (2011)](https://papers.nips.cc/paper/2011/hash/86e8f7ab32cfd12577bc2619bc635690-Abstract.html) with bandwidth selection from [Watanabe (2023)](https://arxiv.org/abs/2304.11127). MOTPE follows [Ozaki et al. (2022)](https://doi.org/10.1613/jair.1.13188) with hypervolume weighting from [Guerreiro et al. (2021)](https://doi.org/10.1145/3453474). c-TPE follows [Watanabe & Hutter (2023)](https://doi.org/10.24963/ijcai.2023/486). HyperBand follows [Li et al. (2017)](https://jmlr.org/papers/v18/16-558.html), BOHB per [Falkner et al. (2018)](https://proceedings.mlr.press/v80/falkner18a.html). Parallel evaluation uses constant liar imputation from [Ginsbourger et al. (2010)](https://doi.org/10.1007/978-3-642-10701-6_6). Verified against [Optuna](https://github.com/optuna/optuna).

### effect-dsp

Implements the [DSPy](https://github.com/stanfordnlp/dspy) paradigm [(Khattab et al., ICLR 2024)](https://arxiv.org/abs/2310.03714), building on [(Khattab et al., 2022)](https://arxiv.org/abs/2212.14024). Chain-of-thought from [Wei et al. (NeurIPS 2022)](https://arxiv.org/abs/2201.11903). Optimizers from [MIPROv2 (Opsahl-Ong et al., EMNLP 2024)](https://arxiv.org/abs/2406.11695), [GEPA (Agrawal et al., ICLR 2026)](https://arxiv.org/abs/2507.19457), and [BetterTogether (Soylu et al., EMNLP 2024)](https://arxiv.org/abs/2407.10930). Ensemble majority voting follows [Wang et al. (ICLR 2023)](https://arxiv.org/abs/2203.11171).

### effect-math

Gamma and log-gamma use the [Lanczos approximation](https://doi.org/10.1137/0701008) (g = 7, 9 coefficients from [Godfrey, 2001](http://www.numericana.com/answer/info/godfrey.htm)). Error function uses the rational polynomial from [Abramowitz & Stegun](https://personal.math.ubc.ca/~cbm/aands/) (1964), formula 7.1.26. Digamma uses asymptotic expansion per A&S §6.3.18. Compensated summation follows [Kahan (1965)](https://doi.org/10.1145/363707.363723). Golden section search follows [Kiefer (1953)](https://doi.org/10.2307/2032161). Verified against [SciPy](https://doi.org/10.1038/s41592-019-0686-2) golden-reference fixtures (214 cases across 9 domains).

### Cryptographic packages

Built on the [Noble](https://paulmillr.com/noble/) cryptographic ecosystem — [@noble/hashes](https://github.com/paulmillr/noble-hashes), [@noble/ciphers](https://github.com/paulmillr/noble-ciphers), [@noble/curves](https://github.com/paulmillr/noble-curves), [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum). Noble has been through 6 independent security audits by [Cure53](https://cure53.de/) and [Trail of Bits](https://www.trailofbits.com/). Algorithms implement [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) (Ed25519), [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) (X25519), [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) (ChaCha20-Poly1305), [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452) (AES-GCM-SIV), [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) (HKDF), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (JCS), [FIPS 204](https://doi.org/10.6028/NIST.FIPS.204) (ML-DSA), [FIPS 205](https://doi.org/10.6028/NIST.FIPS.205) (SLH-DSA), and [XWing](https://doi.org/10.62056/a3qj89n4e) hybrid KEM.

All packages are built on [Effect](https://effect.website).

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
