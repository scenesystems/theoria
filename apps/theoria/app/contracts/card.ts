import { Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { Id } from "./id.js"
import type { ReleaseStage } from "./release-stage.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

/**
 * Package grouping for the home page catalog.
 *
 * - `effect`: Effect ecosystem packages (`effect-*`)
 * - `scenesystems`: Scene Systems org-scoped packages (`@scenesystems/*`)
 *
 * @since 0.1.0
 */
export const PackageGroup = Schema.Literal("effect", "scenesystems")

export type PackageGroup = typeof PackageGroup.Type

/**
 * Display metadata for a package group on the home page.
 *
 * @since 0.1.0
 */
export const PackageGroupMeta = Schema.Struct({
  label: NonEmptyString,
  description: NonEmptyString
})

export type PackageGroupMeta = typeof PackageGroupMeta.Type

export const CardReleaseState = Schema.Literal("published", "coming-soon")

export type CardReleaseState = typeof CardReleaseState.Type

/**
 * Resolved display metadata for each package group.
 *
 * @since 0.1.0
 */
export const packageGroupMeta = (group: PackageGroup): PackageGroupMeta =>
  Match.value(group).pipe(
    Match.when("effect", () => ({
      label: "Effect Ecosystem",
      description:
        "Typed, composable libraries extending the Effect ecosystem with scientific computing, optimization, and language model programming."
    })),
    Match.when("scenesystems", () => ({
      label: "Scene Systems",
      description:
        "Cryptographic primitives built with Effect for content addressing, digital signatures, and authenticated encryption."
    })),
    Match.exhaustive
  )

/**
 * Full card definition consumed by both the home catalog and deep-dive pages.
 *
 * The `version` field provides a static fallback. Live versions are resolved
 * at runtime from the `/api/versions/packages` endpoint which reads the
 * workspace `package.json` files on server startup.
 *
 * @since 0.1.0
 */
export const Card = Schema.Struct({
  id: Id,
  title: NonEmptyString,
  packageName: NonEmptyString,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString,
  group: PackageGroup,
  releaseState: CardReleaseState,
  version: NonEmptyString,
  npmUrl: NonEmptyString,
  repoUrl: NonEmptyString,
  license: NonEmptyString,
  interactiveLabel: Schema.optional(NonEmptyString)
})

export type Card = typeof Card.Type

export const cards: ReadonlyArray<Card> = [
  {
    id: "effect-math",
    title: "effect-math",
    packageName: "effect-math",
    description: "Foundational numerics, linear algebra, statistics, and optimization for Effect",
    useCase: "Numerically stable scientific operators with runtime-boundary contracts.",
    summary:
      "Visualize statistical power across effect sizes and sample sizes using Distribution, Calculus, and Optimization domains.",
    runLabel: "Run Power Analysis",
    deepDivePath: "/demos/effect-math",
    group: "effect",
    releaseState: "published",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/effect-math",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-math",
    license: "MIT",
    interactiveLabel: "Power Explorer"
  },
  {
    id: "effect-search",
    title: "effect-search",
    packageName: "effect-search",
    description: "Effect-native black-box optimization for TypeScript",
    useCase: "Typed optimization studies with deterministic replay and sampler comparisons.",
    summary: "Compare adaptive TPE optimization against seeded random search under a fixed budget.",
    runLabel: "Run Optimizer Comparison",
    deepDivePath: "/demos/effect-search",
    group: "effect",
    releaseState: "published",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/effect-search",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-search",
    license: "MIT",
    interactiveLabel: "Live Optimization"
  },
  {
    id: "effect-dsp",
    title: "effect-dsp",
    packageName: "effect-dsp",
    description: "Effect-native DSPy — programming, not prompting, language models",
    useCase: "Typed program synthesis/evaluation workflows across model providers.",
    summary: "Execute a provider-backed typed classifier and compare it to a heuristic baseline.",
    runLabel: "Run Model Evaluation",
    deepDivePath: "/demos/effect-dsp",
    group: "effect",
    releaseState: "published",
    version: "0.1.4",
    npmUrl: "https://www.npmjs.com/package/effect-dsp",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-dsp",
    license: "MIT",
    interactiveLabel: "Typed Evaluation"
  },
  {
    id: "effect-text",
    title: "effect-text",
    packageName: "effect-text",
    description: "Effect-native text preparation, measurement, and greedy multiline layout",
    useCase: "Instant, deterministic text layout that turns costly measurement into pure arithmetic.",
    summary:
      "Browser-backed measurement, prepared-handle reuse, obstacle-aware reflow, and optional calibration work through the shipped effect-text surfaces.",
    runLabel: "Run Benchmark",
    deepDivePath: "/demos/effect-text",
    group: "effect",
    releaseState: "published",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/effect-text",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-text",
    license: "MIT",
    interactiveLabel: "Live Reflow"
  },
  {
    id: "digest",
    title: "@scenesystems/digest",
    packageName: "@scenesystems/digest",
    description: "Cryptographic content hashing and canonicalization built with Effect",
    useCase: "Content hashing with canonicalization and tagged digest output.",
    summary: "Hash a structured value with BLAKE3-256 and SHA-256, compare digest outputs and canonicalization.",
    runLabel: "Run Digest Benchmark",
    deepDivePath: "/demos/digest",
    group: "scenesystems",
    releaseState: "coming-soon",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/digest",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/digest",
    license: "MIT"
  },
  {
    id: "seal",
    title: "@scenesystems/seal",
    packageName: "@scenesystems/seal",
    description: "Authenticated encryption built with Effect",
    useCase: "Authenticated encryption with self-describing envelopes.",
    summary: "Encrypt and decrypt with XChaCha20-Poly1305, verify round-trip integrity and envelope structure.",
    runLabel: "Run Encryption Demo",
    deepDivePath: "/demos/seal",
    group: "scenesystems",
    releaseState: "coming-soon",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/seal",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/seal",
    license: "MIT"
  },
  {
    id: "sign",
    title: "@scenesystems/sign",
    packageName: "@scenesystems/sign",
    description: "Digital signatures, key agreement, and key encapsulation built with Effect",
    useCase: "Classical and post-quantum signatures with typed verification.",
    summary: "Generate Ed25519 key pairs, sign a message, verify the signature, and inspect key sizes.",
    runLabel: "Run Signature Demo",
    deepDivePath: "/demos/sign",
    group: "scenesystems",
    releaseState: "coming-soon",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/sign",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/sign",
    license: "MIT"
  }
]

export const effectCards: ReadonlyArray<Card> = Arr.filter(cards, (c) => c.group === "effect")

export const scenesystemsCards: ReadonlyArray<Card> = Arr.filter(cards, (c) => c.group === "scenesystems")

export const cardById = (id: Card["id"]): Option.Option<Card> => Arr.findFirst(cards, (card) => card.id === id)

export const cardVisibleInReleaseStage = (card: Card, stage: ReleaseStage): boolean =>
  Match.value(stage).pipe(
    Match.when("preview", () => true),
    Match.when("production", () => card.releaseState === "published"),
    Match.exhaustive
  )

export const cardsForReleaseStage = (stage: ReleaseStage): ReadonlyArray<Card> =>
  Arr.filter(cards, (card) => cardVisibleInReleaseStage(card, stage))

export const cardByIdForReleaseStage = (id: Card["id"], stage: ReleaseStage): Option.Option<Card> =>
  cardById(id).pipe(
    Option.filter((card) => cardVisibleInReleaseStage(card, stage))
  )
