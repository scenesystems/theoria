import { packageNameFromString, PackageNameSchema } from "@theoria/source-proof/contracts"
import type { PackageName } from "@theoria/source-proof/contracts"
import type { Effect } from "effect"
import { Schema } from "effect"
import * as Arr from "effect/Array"
import type * as Option from "effect/Option"

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
    description: "Measure change, test hypotheses, and model numeric behavior with reproducible math and statistics.",
    useCase: "Score experiments, estimate uncertainty, and compare intervention effects.",
    summary: "Ask whether a result is real, how large it is, and how much evidence you need to trust it.",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/effect-math",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-math",
    license: "MIT"
  },
  "effect-search": {
    authorityId: "effect-search",
    title: "effect-search",
    packageName: packageNameFromString("effect-search"),
    description: "Search expensive configuration spaces when every trial costs time, tokens, or human attention.",
    useCase: "Tune prompts, policies, and experiment settings against a concrete objective.",
    summary: "Find better configurations in fewer runs and keep the study history you learned from.",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/effect-search",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-search",
    license: "MIT"
  },
  "effect-dsp": {
    authorityId: "effect-dsp",
    title: "effect-dsp",
    packageName: packageNameFromString("effect-dsp"),
    description:
      "Turn agent behavior into typed workflows you can evaluate, optimize, and replay with evidence attached.",
    useCase: "Design and improve multi-step LM systems without losing sight of how they actually behave.",
    summary: "Compare a baseline workflow, an authored improvement, and a study-selected winner.",
    version: "0.1.4",
    npmUrl: "https://www.npmjs.com/package/effect-dsp",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-dsp",
    license: "MIT"
  },
  "effect-text": {
    authorityId: "effect-text",
    title: "effect-text",
    packageName: packageNameFromString("effect-text"),
    description: "Keep meaning readable as text moves across widths, obstacles, and changing presentation surfaces.",
    useCase: "Study how layout constraints change what people can actually read and compare.",
    summary: "Preview how the same content behaves across widths, obstacles, and render targets.",
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
      "Route model requests across providers without losing the requested intent, chosen route, or runtime evidence.",
    useCase: "Compare model and runtime choices while keeping execution evidence attached to the result.",
    summary: "See which model path ran, why it was chosen, and what it produced.",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/effect-inference",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-inference",
    license: "MIT"
  },
  digest: {
    authorityId: "digest",
    title: "@scenesystems/digest",
    packageName: packageNameFromString("@scenesystems/digest"),
    description: "Give datasets, traces, and study artifacts stable identities you can compare, cache, and trust.",
    useCase: "Fingerprint evidence, prove integrity, and tell when two artifacts are truly the same.",
    summary: "Turn structured artifacts into durable IDs for replay, provenance, and audit.",
    version: "0.2.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/digest",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/digest",
    license: "MIT"
  },
  seal: {
    authorityId: "seal",
    title: "@scenesystems/seal",
    packageName: packageNameFromString("@scenesystems/seal"),
    description: "Package sensitive study artifacts into envelopes that move safely between people and systems.",
    useCase: "Share private data, prompts, or evidence bundles without losing the context needed to reopen them.",
    summary: "Seal results for transport and unseal them later with the right metadata already attached.",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/seal",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/seal",
    license: "MIT"
  },
  sign: {
    authorityId: "sign",
    title: "@scenesystems/sign",
    packageName: packageNameFromString("@scenesystems/sign"),
    description: "Sign results and provenance bundles so collaborators can verify who produced them and what changed.",
    useCase: "Publish trustworthy study outputs across classical and post-quantum verification choices.",
    summary: "Attach verifiable authorship to shared artifacts, evidence bundles, and released results.",
    version: "0.1.0",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/sign",
    repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/sign",
    license: "MIT"
  }
}

const encodeAuthorityCatalogDescriptor = Schema.encodeSync(AuthorityCatalogDescriptor)

export const authorityCatalogDescriptors: ReadonlyArray<AuthorityCatalogDescriptor> = [
  authorityCatalogById["effect-math"],
  authorityCatalogById["effect-search"],
  authorityCatalogById["effect-dsp"],
  authorityCatalogById["effect-text"],
  authorityCatalogById["effect-inference"],
  authorityCatalogById.digest,
  authorityCatalogById.seal,
  authorityCatalogById.sign
]

export const authorityCatalogPackageNames: ReadonlyArray<PackageName> = Arr.map(
  authorityCatalogDescriptors,
  (descriptor) => descriptor.packageName
)

export const authorityCatalogForId = (id: AuthorityId): AuthorityCatalogDescriptor => authorityCatalogById[id]

export const authorityCatalogForPackageName = (packageName: PackageName): Option.Option<AuthorityCatalogDescriptor> =>
  Arr.findFirst(authorityCatalogDescriptors, (descriptor) => descriptor.packageName === packageName)

export const authorityCatalogFingerprint = (
  catalog: AuthorityCatalogDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeAuthorityCatalogDescriptor(catalog))
