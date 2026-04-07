import type { Effect } from "effect"
import { Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { type DurableFingerprint, fingerprintOf } from "./fingerprint.js"
import {
  type AppConsumerId,
  AuthorityId,
  authorityIds,
  ConsumerId,
  consumerIds,
  type PublishedConsumerId,
  publishedConsumerIds,
  WorkflowComparisonConsumerId
} from "./id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const ConsumerGroup = Schema.Literal("effect", "scenesystems", "application")

export type ConsumerGroup = typeof ConsumerGroup.Type

export const PackageGroup = Schema.Literal("effect", "scenesystems")

export type PackageGroup = typeof PackageGroup.Type

export const ConsumerGroupMeta = Schema.Struct({
  label: NonEmptyString,
  description: NonEmptyString
})

export type ConsumerGroupMeta = typeof ConsumerGroupMeta.Type

export type PackageGroupMeta = ConsumerGroupMeta

export const CardReleaseState = Schema.Literal("published", "coming-soon")

export type CardReleaseState = typeof CardReleaseState.Type

export const AuthorityCatalogDescriptor = Schema.Struct({
  authorityId: AuthorityId,
  title: NonEmptyString,
  packageName: NonEmptyString,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  version: NonEmptyString,
  npmUrl: NonEmptyString,
  repoUrl: NonEmptyString,
  license: NonEmptyString
})

export type AuthorityCatalogDescriptor = typeof AuthorityCatalogDescriptor.Type

export const SingleAuthorityScope = Schema.Struct({
  _tag: Schema.Literal("single"),
  authorityId: AuthorityId
})

export type SingleAuthorityScope = typeof SingleAuthorityScope.Type

export const CompositeAuthorityScope = Schema.Struct({
  _tag: Schema.Literal("composite"),
  primaryAuthorityId: AuthorityId,
  authorityIds: Schema.NonEmptyArray(AuthorityId)
})

export type CompositeAuthorityScope = typeof CompositeAuthorityScope.Type

export const ConsumerAuthorityScope = Schema.Union(SingleAuthorityScope, CompositeAuthorityScope)

export type ConsumerAuthorityScope = typeof ConsumerAuthorityScope.Type

const ConsumerPublicationFields = {
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString,
  releaseState: CardReleaseState,
  interactiveLabel: Schema.optional(NonEmptyString)
}

export const PackageConsumerPublicationDescriptor = Schema.Struct({
  consumerId: ConsumerId,
  group: PackageGroup,
  ...ConsumerPublicationFields
})

export type PackageConsumerPublicationDescriptor = typeof PackageConsumerPublicationDescriptor.Type

export const ApplicationConsumerPublicationDescriptor = Schema.Struct({
  consumerId: WorkflowComparisonConsumerId,
  group: Schema.Literal("application"),
  ...ConsumerPublicationFields
})

export type ApplicationConsumerPublicationDescriptor = typeof ApplicationConsumerPublicationDescriptor.Type

export const ConsumerPublicationDescriptor = Schema.Union(
  PackageConsumerPublicationDescriptor,
  ApplicationConsumerPublicationDescriptor
)

export type ConsumerPublicationDescriptor = typeof ConsumerPublicationDescriptor.Type

export const PackageConsumerDescriptor = Schema.Struct({
  kind: Schema.Literal("package"),
  publication: PackageConsumerPublicationDescriptor,
  authorityScope: SingleAuthorityScope
})

export type PackageConsumerDescriptor = typeof PackageConsumerDescriptor.Type

export const ApplicationConsumerDescriptor = Schema.Struct({
  kind: Schema.Literal("application"),
  publication: ApplicationConsumerPublicationDescriptor,
  authorityScope: CompositeAuthorityScope
})

export type ApplicationConsumerDescriptor = typeof ApplicationConsumerDescriptor.Type

export const PublishedConsumerDescriptor = Schema.Union(
  PackageConsumerDescriptor,
  ApplicationConsumerDescriptor
)

export type PublishedConsumerDescriptor = typeof PublishedConsumerDescriptor.Type

export const AuthorityCatalogRegistry = Schema.Array(AuthorityCatalogDescriptor)

export type AuthorityCatalogRegistry = typeof AuthorityCatalogRegistry.Type

export const ConsumerPublicationRegistry = Schema.Array(ConsumerPublicationDescriptor)

export type ConsumerPublicationRegistry = typeof ConsumerPublicationRegistry.Type

export const PublishedConsumerRegistry = Schema.Array(PublishedConsumerDescriptor)

export type PublishedConsumerRegistry = typeof PublishedConsumerRegistry.Type

export type PublishedConsumerPresentation = {
  readonly consumerId: PublishedConsumerId
  readonly title: string
  readonly packageName: string
  readonly description: string
  readonly useCase: string
  readonly summary: string
  readonly runLabel: string
  readonly deepDivePath: string
  readonly interactiveLabel: string | null
  readonly group: ConsumerGroup
  readonly releaseState: CardReleaseState
}

type ApplicationConsumerPresentationSeed = {
  readonly title: string
  readonly packageName: string
  readonly description: string
  readonly useCase: string
  readonly summary: string
}

export const consumerGroupMeta = (group: ConsumerGroup): ConsumerGroupMeta =>
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
    Match.when("application", () => ({
      label: "Applications",
      description:
        "Cross-package proving surfaces that compose multiple published authorities into one application-level runtime story."
    })),
    Match.exhaustive
  )

export const packageGroupMeta = (group: PackageGroup): PackageGroupMeta => consumerGroupMeta(group)

const singleAuthorityScope = (authorityId: AuthorityId): SingleAuthorityScope => ({
  _tag: "single",
  authorityId
})

const compositeAuthorityScope = ({
  authorityIds,
  primaryAuthorityId
}: {
  readonly authorityIds: CompositeAuthorityScope["authorityIds"]
  readonly primaryAuthorityId: AuthorityId
}): CompositeAuthorityScope => ({
  _tag: "composite",
  primaryAuthorityId,
  authorityIds
})

const withInteractiveLabel = (
  interactiveLabel: Option.Option<string>
): { readonly interactiveLabel?: string } =>
  Option.match(interactiveLabel, {
    onNone: () => ({}),
    onSome: (value) => ({ interactiveLabel: value })
  })

const makePackageConsumerDescriptor = ({
  authorityId,
  consumerId,
  deepDivePath,
  group,
  interactiveLabel,
  releaseState,
  runLabel
}: {
  readonly authorityId: AuthorityId
  readonly consumerId: ConsumerId
  readonly deepDivePath: string
  readonly group: PackageGroup
  readonly interactiveLabel?: string
  readonly releaseState: CardReleaseState
  readonly runLabel: string
}): PackageConsumerDescriptor => ({
  kind: "package",
  publication: {
    consumerId,
    runLabel,
    deepDivePath,
    group,
    releaseState,
    ...withInteractiveLabel(Option.fromNullable(interactiveLabel))
  },
  authorityScope: singleAuthorityScope(authorityId)
})

const makeApplicationConsumerDescriptor = ({
  authorityIds,
  consumerId,
  deepDivePath,
  group,
  interactiveLabel,
  primaryAuthorityId,
  releaseState,
  runLabel
}: {
  readonly authorityIds: CompositeAuthorityScope["authorityIds"]
  readonly consumerId: AppConsumerId
  readonly deepDivePath: string
  readonly group: Extract<ConsumerGroup, "application">
  readonly interactiveLabel?: string
  readonly primaryAuthorityId: AuthorityId
  readonly releaseState: CardReleaseState
  readonly runLabel: string
}): ApplicationConsumerDescriptor => ({
  kind: "application",
  publication: {
    consumerId,
    runLabel,
    deepDivePath,
    group,
    releaseState,
    ...withInteractiveLabel(Option.fromNullable(interactiveLabel))
  },
  authorityScope: compositeAuthorityScope({ authorityIds, primaryAuthorityId })
})

const authorityCatalogById: Readonly<Record<AuthorityId, AuthorityCatalogDescriptor>> = {
  "effect-math": {
    authorityId: "effect-math",
    title: "effect-math",
    packageName: "effect-math",
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
    packageName: "effect-search",
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
    packageName: "effect-dsp",
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
    packageName: "effect-text",
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
    packageName: "effect-inference",
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
    packageName: "@scenesystems/digest",
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
    packageName: "@scenesystems/seal",
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
    packageName: "@scenesystems/sign",
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

const packageConsumerDescriptorById: Readonly<Record<ConsumerId, PackageConsumerDescriptor>> = {
  "effect-math": makePackageConsumerDescriptor({
    authorityId: "effect-math",
    consumerId: "effect-math",
    runLabel: "Run Power Analysis",
    deepDivePath: "/demos/effect-math",
    group: "effect",
    releaseState: "published",
    interactiveLabel: "Power Explorer"
  }),
  "effect-search": makePackageConsumerDescriptor({
    authorityId: "effect-search",
    consumerId: "effect-search",
    runLabel: "Run Optimizer Comparison",
    deepDivePath: "/demos/effect-search",
    group: "effect",
    releaseState: "published",
    interactiveLabel: "Live Optimization"
  }),
  "effect-dsp": makePackageConsumerDescriptor({
    authorityId: "effect-dsp",
    consumerId: "effect-dsp",
    runLabel: "Run Model Evaluation",
    deepDivePath: "/demos/effect-dsp",
    group: "effect",
    releaseState: "published",
    interactiveLabel: "Typed Evaluation"
  }),
  "effect-text": makePackageConsumerDescriptor({
    authorityId: "effect-text",
    consumerId: "effect-text",
    runLabel: "Run Benchmark",
    deepDivePath: "/demos/effect-text",
    group: "effect",
    releaseState: "published",
    interactiveLabel: "Live Reflow"
  }),
  "effect-inference": makePackageConsumerDescriptor({
    authorityId: "effect-inference",
    consumerId: "effect-inference",
    runLabel: "Run Runtime Resolution",
    deepDivePath: "/demos/effect-inference",
    group: "effect",
    releaseState: "coming-soon"
  }),
  digest: makePackageConsumerDescriptor({
    authorityId: "digest",
    consumerId: "digest",
    runLabel: "Run Digest Demo",
    deepDivePath: "/demos/digest",
    group: "scenesystems",
    releaseState: "coming-soon"
  }),
  seal: makePackageConsumerDescriptor({
    authorityId: "seal",
    consumerId: "seal",
    runLabel: "Run Encryption Demo",
    deepDivePath: "/demos/seal",
    group: "scenesystems",
    releaseState: "coming-soon"
  }),
  sign: makePackageConsumerDescriptor({
    authorityId: "sign",
    consumerId: "sign",
    runLabel: "Run Signature Demo",
    deepDivePath: "/demos/sign",
    group: "scenesystems",
    releaseState: "coming-soon"
  })
}

export const workflowComparisonConsumerDescriptor: ApplicationConsumerDescriptor = makeApplicationConsumerDescriptor({
  consumerId: "workflow-comparison",
  runLabel: "Run Workflow Comparison",
  deepDivePath: "/workflow-comparison",
  group: "application",
  releaseState: "published",
  interactiveLabel: "Graph Workflow Comparison",
  primaryAuthorityId: "effect-inference",
  authorityIds: ["effect-inference", "effect-search", "effect-dsp", "effect-text", "effect-math"]
})

const applicationConsumerPresentationSeedById: Readonly<
  Record<WorkflowComparisonConsumerId, ApplicationConsumerPresentationSeed>
> = {
  "workflow-comparison": {
    title: "Workflow Comparison",
    packageName: "@theoria/theoria-app",
    description:
      "Compare baseline and optimized graph-backed workflow manifests on the same evaluation set, render envelope, and study-backed runtime spine.",
    useCase: "Prove prompt, routing, and chat-agent improvement from one published application consumer.",
    summary:
      "Run a baseline-versus-optimized workflow comparison, inspect the winning study selection, and trace why the graph improved."
  }
}

const applicationConsumerDescriptorById: Readonly<Record<WorkflowComparisonConsumerId, ApplicationConsumerDescriptor>> =
  {
    "workflow-comparison": workflowComparisonConsumerDescriptor
  }

const publishedConsumerDescriptorById: Readonly<Record<PublishedConsumerId, PublishedConsumerDescriptor>> = {
  "effect-math": packageConsumerDescriptorById["effect-math"],
  "effect-search": packageConsumerDescriptorById["effect-search"],
  "effect-dsp": packageConsumerDescriptorById["effect-dsp"],
  "effect-text": packageConsumerDescriptorById["effect-text"],
  "effect-inference": packageConsumerDescriptorById["effect-inference"],
  digest: packageConsumerDescriptorById.digest,
  seal: packageConsumerDescriptorById.seal,
  sign: packageConsumerDescriptorById.sign,
  "workflow-comparison": workflowComparisonConsumerDescriptor
}

export const authorityCatalogForId = (id: AuthorityId): AuthorityCatalogDescriptor => authorityCatalogById[id]

export const packageConsumerDescriptorForId = (id: ConsumerId): PackageConsumerDescriptor =>
  packageConsumerDescriptorById[id]

export const applicationConsumerDescriptorForId = (id: WorkflowComparisonConsumerId): ApplicationConsumerDescriptor =>
  applicationConsumerDescriptorById[id]

export const publishedConsumerDescriptorForId = (id: PublishedConsumerId): PublishedConsumerDescriptor =>
  publishedConsumerDescriptorById[id]

const normalizedPublishedConsumerPath = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname

export const publishedConsumerVisibleInReleaseStage = (
  descriptor: PublishedConsumerDescriptor,
  stage: "preview" | "production"
): boolean => stage === "preview" || descriptor.publication.releaseState === "published"

export const publishedConsumerDescriptorForPath = (pathname: string): Option.Option<PublishedConsumerDescriptor> => {
  const normalizedPath = normalizedPublishedConsumerPath(pathname)

  return Arr.findFirst(
    publishedConsumerDescriptors,
    (descriptor) => normalizedPublishedConsumerPath(descriptor.publication.deepDivePath) === normalizedPath
  )
}

export const publishedConsumerIdForPath = (pathname: string): Option.Option<PublishedConsumerId> =>
  publishedConsumerDescriptorForPath(pathname).pipe(Option.map((descriptor) => descriptor.publication.consumerId))

export const publishedConsumerPresentationForDescriptor = (
  descriptor: PublishedConsumerDescriptor
): PublishedConsumerPresentation => {
  if (descriptor.kind === "package") {
    const publication = descriptor.publication
    const authority = primaryAuthorityCatalogForDescriptor(descriptor)

    return {
      consumerId: publication.consumerId,
      title: authority.title,
      packageName: authority.packageName,
      description: authority.description,
      useCase: authority.useCase,
      summary: authority.summary,
      runLabel: publication.runLabel,
      deepDivePath: publication.deepDivePath,
      interactiveLabel: publication.interactiveLabel ?? null,
      group: publication.group,
      releaseState: publication.releaseState
    }
  }

  return {
    consumerId: descriptor.publication.consumerId,
    ...applicationConsumerPresentationSeedById[descriptor.publication.consumerId],
    runLabel: descriptor.publication.runLabel,
    deepDivePath: descriptor.publication.deepDivePath,
    interactiveLabel: descriptor.publication.interactiveLabel ?? null,
    group: descriptor.publication.group,
    releaseState: descriptor.publication.releaseState
  }
}

export const publishedConsumerPresentationForId = (
  id: PublishedConsumerId
): PublishedConsumerPresentation => publishedConsumerPresentationForDescriptor(publishedConsumerDescriptorForId(id))

export const authorityIdsForDescriptor = (
  descriptor: PublishedConsumerDescriptor
): ReadonlyArray<AuthorityId> =>
  descriptor.authorityScope._tag === "single"
    ? [descriptor.authorityScope.authorityId]
    : descriptor.authorityScope.authorityIds

export const primaryAuthorityIdForDescriptor = (descriptor: PublishedConsumerDescriptor): AuthorityId =>
  descriptor.authorityScope._tag === "single"
    ? descriptor.authorityScope.authorityId
    : descriptor.authorityScope.primaryAuthorityId

export const authorityCatalogsForDescriptor = (
  descriptor: PublishedConsumerDescriptor
): ReadonlyArray<AuthorityCatalogDescriptor> => Arr.map(authorityIdsForDescriptor(descriptor), authorityCatalogForId)

export const primaryAuthorityCatalogForDescriptor = (
  descriptor: PublishedConsumerDescriptor
): AuthorityCatalogDescriptor => authorityCatalogForId(primaryAuthorityIdForDescriptor(descriptor))

export const consumerPublicationForId = (id: PublishedConsumerId): ConsumerPublicationDescriptor =>
  publishedConsumerDescriptorForId(id).publication

export const authorityIdsForConsumer = (id: PublishedConsumerId): ReadonlyArray<AuthorityId> =>
  authorityIdsForDescriptor(publishedConsumerDescriptorForId(id))

export const authorityCatalogsForConsumer = (
  id: PublishedConsumerId
): ReadonlyArray<AuthorityCatalogDescriptor> => authorityCatalogsForDescriptor(publishedConsumerDescriptorForId(id))

export const primaryAuthorityCatalogForConsumer = (id: PublishedConsumerId): AuthorityCatalogDescriptor =>
  primaryAuthorityCatalogForDescriptor(publishedConsumerDescriptorForId(id))

export const authorityCatalogs: ReadonlyArray<AuthorityCatalogDescriptor> = Arr.map(authorityIds, authorityCatalogForId)

export const packageConsumerDescriptors: ReadonlyArray<PackageConsumerDescriptor> = Arr.map(
  consumerIds,
  packageConsumerDescriptorForId
)

export const applicationConsumerDescriptors: ReadonlyArray<ApplicationConsumerDescriptor> = [
  workflowComparisonConsumerDescriptor
]

export const publishedConsumerDescriptors: ReadonlyArray<PublishedConsumerDescriptor> = Arr.map(
  publishedConsumerIds,
  publishedConsumerDescriptorForId
)

export const consumerPublications: ReadonlyArray<ConsumerPublicationDescriptor> = Arr.map(
  publishedConsumerIds,
  consumerPublicationForId
)

const encodeAuthorityCatalogDescriptor = Schema.encodeSync(AuthorityCatalogDescriptor)
const encodeAuthorityCatalogRegistry = Schema.encodeSync(AuthorityCatalogRegistry)
const encodeConsumerAuthorityScope = Schema.encodeSync(ConsumerAuthorityScope)
const encodeConsumerPublicationDescriptor = Schema.encodeSync(ConsumerPublicationDescriptor)
const encodeConsumerPublicationRegistry = Schema.encodeSync(ConsumerPublicationRegistry)
const encodePublishedConsumerDescriptor = Schema.encodeSync(PublishedConsumerDescriptor)
const encodePublishedConsumerRegistry = Schema.encodeSync(PublishedConsumerRegistry)

export const authorityCatalogFingerprint = (
  catalog: AuthorityCatalogDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeAuthorityCatalogDescriptor(catalog))

export const authorityCatalogRegistryFingerprint = (
  registry: AuthorityCatalogRegistry
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeAuthorityCatalogRegistry(registry))

export const consumerAuthorityScopeFingerprint = (
  authorityScope: ConsumerAuthorityScope
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeConsumerAuthorityScope(authorityScope))

export const consumerPublicationFingerprint = (
  publication: ConsumerPublicationDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeConsumerPublicationDescriptor(publication))

export const consumerPublicationRegistryFingerprint = (
  registry: ConsumerPublicationRegistry
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeConsumerPublicationRegistry(registry))

export const publishedConsumerDescriptorFingerprint = (
  descriptor: PublishedConsumerDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodePublishedConsumerDescriptor(descriptor))

export const publishedConsumerRegistryFingerprint = (
  registry: PublishedConsumerRegistry
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodePublishedConsumerRegistry(registry))
