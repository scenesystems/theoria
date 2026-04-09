import { packageNameFromString, PackageNameSchema } from "@theoria/source-proof/contracts"
import type { Effect } from "effect"
import { Schema } from "effect"

import { type DurableFingerprint, fingerprintOf } from "../entry/fingerprint.js"
import { AuthorityId } from "../entry/id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const AuthorityCatalogDescriptor = Schema.Struct({
  authorityId: AuthorityId,
  title: NonEmptyString,
  packageName: PackageNameSchema,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  version: NonEmptyString,
  npmUrl: NonEmptyString,
  repoUrl: NonEmptyString,
  license: NonEmptyString
})

export type AuthorityCatalogDescriptor = typeof AuthorityCatalogDescriptor.Type

const authorityCatalogById: Readonly<Record<AuthorityId, AuthorityCatalogDescriptor>> = {
  "effect-math": {
    authorityId: "effect-math",
    title: "effect-math",
    packageName: packageNameFromString("effect-math"),
    description: "Combines numerical and statistical computing with typed errors and policy-aware operations.",
    useCase: "Numerical analysis and statistical modeling inside application code.",
    summary: "Explore how sample size, effect size, and target power trade off.",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/effect-math",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-math",
    license: "MIT"
  },
  "effect-search": {
    authorityId: "effect-search",
    title: "effect-search",
    packageName: packageNameFromString("effect-search"),
    description:
      "Runs optimization studies with adaptive samplers when each evaluation is too expensive for trial and error.",
    useCase: "Hyperparameter tuning, experiment design, and other expensive search problems.",
    summary: "Compare TPE against seeded random search on the same trial budget.",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/effect-search",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-search",
    license: "MIT"
  },
  "effect-dsp": {
    authorityId: "effect-dsp",
    title: "effect-dsp",
    packageName: packageNameFromString("effect-dsp"),
    description: "Turns language-model workflows into typed programs you can trace, evaluate, and optimize.",
    useCase: "Build, evaluate, and optimize LLM workflows without hand-managing prompts.",
    summary: "Run a typed classifier and compare it with a heuristic baseline.",
    version: "0.1.4",
    npmUrl: "https://www.npmjs.com/package/effect-dsp",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-dsp",
    license: "MIT"
  },
  "effect-text": {
    authorityId: "effect-text",
    title: "effect-text",
    packageName: packageNameFromString("effect-text"),
    description: "Prepares text once, then measures and reflows it as width and obstacle constraints change.",
    useCase: "Prepare text once, then reflow it across widths and obstacles.",
    summary: "Measure in the browser and reflow the same text as the container changes.",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/effect-text",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-text",
    license: "MIT"
  },
  "effect-inference": {
    authorityId: "effect-inference",
    title: "effect-inference",
    packageName: packageNameFromString("effect-inference"),
    description:
      "Resolves model requests for text and embeddings across providers while keeping request intent, routing, and execution evidence separate.",
    useCase: "Keep requested model intent, resolved route, and execution evidence separate.",
    summary: "Resolve a descriptor, inspect the route, and collect runtime evidence.",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/effect-inference",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-inference",
    license: "MIT"
  },
  digest: {
    authorityId: "digest",
    title: "@scenesystems/digest",
    packageName: packageNameFromString("@scenesystems/digest"),
    description: "Turns structured data into stable cryptographic digests you can use as identifiers.",
    useCase: "Stable fingerprints, integrity checks, and content addressing.",
    summary: "Hash a structured value with BLAKE3-256 and SHA-256.",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/digest",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/digest",
    license: "MIT"
  },
  seal: {
    authorityId: "seal",
    title: "@scenesystems/seal",
    packageName: packageNameFromString("@scenesystems/seal"),
    description: "Encrypts data into self-describing envelopes that carry what is needed to decrypt it.",
    useCase: "Encrypt data without tracking algorithm and nonce separately.",
    summary: "Seal and unseal data with XChaCha20-Poly1305.",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/seal",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/seal",
    license: "MIT"
  },
  sign: {
    authorityId: "sign",
    title: "@scenesystems/sign",
    packageName: packageNameFromString("@scenesystems/sign"),
    description:
      "Signs messages, derives shared secrets, and encapsulates keys with classical and post-quantum algorithms.",
    useCase: "Switch between classical and post-quantum algorithms without changing the workflow.",
    summary: "Generate Ed25519 keys, sign a message, and verify it.",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/sign",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/sign",
    license: "MIT"
  }
}

const encodeAuthorityCatalogDescriptor = Schema.encodeSync(AuthorityCatalogDescriptor)

export const authorityCatalogForId = (id: AuthorityId): AuthorityCatalogDescriptor => authorityCatalogById[id]

export const authorityCatalogFingerprint = (
  catalog: AuthorityCatalogDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeAuthorityCatalogDescriptor(catalog))
