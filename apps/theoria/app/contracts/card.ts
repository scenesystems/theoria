import { Schema } from "effect"

import { Id } from "./id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

/**
 * Package grouping for the home page catalog.
 *
 * - `effect`: scientific computing and model-program packages
 * - `scenesystems`: content and cryptography packages
 *
 * @since 0.1.0
 */
export const PackageGroup = Schema.Literal("effect", "scenesystems")

export type PackageGroup = typeof PackageGroup.Type

/**
 * Identity and publication metadata for each package the site presents. The
 * `version` field is the static fallback; the docs index shows the manifest
 * version resolved at build time.
 *
 * @since 0.1.0
 */
export const Card = Schema.Struct({
  id: Id,
  title: NonEmptyString,
  packageName: NonEmptyString,
  description: NonEmptyString,
  group: PackageGroup,
  version: NonEmptyString,
  npmUrl: NonEmptyString,
  repoUrl: NonEmptyString,
  license: NonEmptyString
})

export type Card = typeof Card.Type

export const cards: ReadonlyArray<Card> = [
  {
    id: "effect-math",
    title: "@scenesystems/effect-math",
    packageName: "@scenesystems/effect-math",
    description: "Numerical and statistical computing with typed errors and runtime policy.",
    group: "effect",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/effect-math",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-math",
    license: "MIT"
  },
  {
    id: "effect-search",
    title: "@scenesystems/effect-search",
    packageName: "@scenesystems/effect-search",
    description: "Runs reproducible optimization studies with adaptive and seeded samplers.",
    group: "effect",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/effect-search",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-search",
    license: "MIT"
  },
  {
    id: "effect-dsp",
    title: "@scenesystems/effect-dsp",
    packageName: "@scenesystems/effect-dsp",
    description: "Builds typed language-model programs for evaluation and optimization.",
    group: "effect",
    version: "0.1.4",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/effect-dsp",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-dsp",
    license: "MIT"
  },
  {
    id: "effect-inference",
    title: "@scenesystems/effect-inference",
    packageName: "@scenesystems/effect-inference",
    description: "Resolves model requests across providers and records execution evidence.",
    group: "effect",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/effect-inference",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-inference",
    license: "MIT"
  },
  {
    id: "effect-text",
    title: "@scenesystems/effect-text",
    packageName: "@scenesystems/effect-text",
    description: "Measures text once and reflows it as width or obstacle constraints change.",
    group: "effect",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/effect-text",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-text",
    license: "MIT"
  },
  {
    id: "digest",
    title: "@scenesystems/digest",
    packageName: "@scenesystems/digest",
    description: "Creates stable cryptographic identifiers for structured data.",
    group: "scenesystems",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/digest",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/digest",
    license: "MIT"
  },
  {
    id: "sign",
    title: "@scenesystems/sign",
    packageName: "@scenesystems/sign",
    description: "Signs messages and derives shared secrets with classical or post-quantum algorithms.",
    group: "scenesystems",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/sign",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/sign",
    license: "MIT"
  },
  {
    id: "seal",
    title: "@scenesystems/seal",
    packageName: "@scenesystems/seal",
    description: "Encrypts data in envelopes that carry their decryption parameters.",
    group: "scenesystems",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/seal",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/seal",
    license: "MIT"
  }
]
