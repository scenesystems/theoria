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
    description: "Combines numerical and statistical computing with typed errors and policy-aware operations.",
    useCase: "Numerical analysis and statistical modeling inside application code.",
    summary: "Explore how sample size, effect size, and target power trade off.",
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
    description:
      "Runs optimization studies with adaptive samplers when each evaluation is too expensive for trial and error.",
    useCase: "Hyperparameter tuning, experiment design, and other expensive search problems.",
    summary: "Compare TPE against seeded random search on the same trial budget.",
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
    description: "Turns language-model workflows into typed programs you can trace, evaluate, and optimize.",
    useCase: "Build, evaluate, and optimize LLM workflows without hand-managing prompts.",
    summary: "Run a typed classifier and compare it with a heuristic baseline.",
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
    description: "Prepares text once, then measures and reflows it as width and obstacle constraints change.",
    useCase: "Prepare text once, then reflow it across widths and obstacles.",
    summary: "Measure in the browser and reflow the same text as the container changes.",
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
    id: "effect-inference",
    title: "effect-inference",
    packageName: "effect-inference",
    description:
      "Resolves model requests for text and embeddings across providers while keeping request intent, routing, and execution evidence separate.",
    useCase: "Keep requested model intent, resolved route, and execution evidence separate.",
    summary: "Resolve a descriptor, inspect the route, and collect runtime evidence.",
    runLabel: "Run Runtime Resolution",
    deepDivePath: "/demos/effect-inference",
    group: "effect",
    releaseState: "coming-soon",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/effect-inference",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-inference",
    license: "MIT"
  },
  {
    id: "digest",
    title: "@scenesystems/digest",
    packageName: "@scenesystems/digest",
    description: "Turns structured data into stable cryptographic digests you can use as identifiers.",
    useCase: "Stable fingerprints, integrity checks, and content addressing.",
    summary: "Hash a structured value with BLAKE3-256 and SHA-256.",
    runLabel: "Run Digest Demo",
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
    description: "Encrypts data into self-describing envelopes that carry what is needed to decrypt it.",
    useCase: "Encrypt data without tracking algorithm and nonce separately.",
    summary: "Seal and unseal data with XChaCha20-Poly1305.",
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
    description:
      "Signs messages, derives shared secrets, and encapsulates keys with classical and post-quantum algorithms.",
    useCase: "Switch between classical and post-quantum algorithms without changing the workflow.",
    summary: "Generate Ed25519 keys, sign a message, and verify it.",
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
