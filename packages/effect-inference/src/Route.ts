/**
 * Inference transport identity and pre-execution route provenance.
 *
 * @since 0.5.0
 * @module
 */
import * as Match from "effect/Match"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/** Schema for stable inference transport families. @since 0.5.0 @category schemas */
export const Family = Schema.Literal("OpenAiCompatible", "OpenAiResponses", "AnthropicMessages", "HuggingFace")
  .annotations({ identifier: "@scenesystems/effect-inference/Route/Family" })
/** Stable transport family inferred from its schema. @since 0.5.0 @category models */
export type Family = typeof Family.Type

/** Schema for where and how a route is served. @since 0.5.0 @category schemas */
export const ServeMode = Schema.Literal(
  "hosted-api",
  "routed-marketplace",
  "dedicated-endpoint",
  "self-hosted",
  "local-runtime"
).annotations({ identifier: "@scenesystems/effect-inference/Route/ServeMode" })
/** Route serving mode inferred from its schema. @since 0.5.0 @category models */
export type ServeMode = typeof ServeMode.Type

/** Schema for authentication methods carried by routes. @since 0.5.0 @category schemas */
export const AuthMethod = Schema.Literal(
  "none",
  "api-key",
  "bearer-token",
  "hf-token",
  "provider-key",
  "credentials-include"
).annotations({ identifier: "@scenesystems/effect-inference/Route/AuthMethod" })
/** Route authentication method inferred from its schema. @since 0.5.0 @category models */
export type AuthMethod = typeof AuthMethod.Type

/** Schema for an explicit inference-provider selection. @since 0.5.0 @category schemas */
export const ExplicitProvider = Schema.TaggedStruct("provider", { provider: Schema.String })
  .annotations({ identifier: "@scenesystems/effect-inference/Route/ExplicitProvider" })
/** Explicit provider selection inferred from its schema. @since 0.5.0 @category models */
export type ExplicitProvider = typeof ExplicitProvider.Type

/** Schema for automatic and explicit provider-selection policies. @since 0.5.0 @category schemas */
export const SelectionPolicy = Schema.Union(
  Schema.Literal("auto", "fastest", "cheapest", "preferred"),
  ExplicitProvider
).annotations({ identifier: "@scenesystems/effect-inference/Route/SelectionPolicy" })
/** Provider-selection policy inferred from its schema. @since 0.5.0 @category models */
export type SelectionPolicy = typeof SelectionPolicy.Type

/** Schema for recognized runtime implementation flavors. @since 0.5.0 @category schemas */
export const Flavor = Schema.Literal("unknown", "vllm", "tgi", "ollama", "lm-studio")
  .annotations({ identifier: "@scenesystems/effect-inference/Route/Flavor" })
/** Runtime implementation flavor inferred from its schema. @since 0.5.0 @category models */
export type Flavor = typeof Flavor.Type

/**
 * Stable execution route selected before provider execution.
 *
 * @since 0.5.0
 * @category models
 */
export const Route = Schema.Struct({
  family: Family,
  serveMode: ServeMode,
  authMethod: AuthMethod,
  baseUrl: Schema.String,
  endpointId: Schema.optional(Schema.String),
  deploymentId: Schema.optional(Schema.String),
  gatewayId: Schema.optional(Schema.String),
  selectionPolicy: Schema.optional(SelectionPolicy),
  runtimeFlavorHint: Schema.optional(Flavor)
}).annotations({ identifier: "@scenesystems/effect-inference/Route" })
/** Stable execution route inferred from its schema. @since 0.5.0 @category models */
export type Route = typeof Route.Type

/**
 * Current serialized version for resolved-route provenance.
 *
 * @since 0.5.0
 * @category constants
 */
export const provenanceVersion = "resolved-route/v1"

/**
 * Schema for the current resolved-route provenance version.
 *
 * @since 0.5.0
 * @category schemas
 */
export const ProvenanceVersion = Schema.Literal(provenanceVersion)
  .annotations({ identifier: "@scenesystems/effect-inference/Route/ProvenanceVersion" })
/** Resolved-route provenance version inferred from its schema. @since 0.5.0 @category models */
export type ProvenanceVersion = typeof ProvenanceVersion.Type

/**
 * Route decision and rationale established before execution.
 *
 * @since 0.5.0
 * @category models
 */
export const Resolved = Schema.Struct({
  route: Route,
  selectedProvider: Schema.optional(Schema.String),
  selectedDeployment: Schema.optional(Schema.String),
  providerModel: Schema.optional(Schema.String),
  runtimeFlavor: Schema.optional(Flavor),
  selectionReason: Schema.String,
  schemaVersion: ProvenanceVersion
}).annotations({ identifier: "@scenesystems/effect-inference/Route/Resolved" })
/** Pre-execution route decision inferred from its schema. @since 0.5.0 @category models */
export type Resolved = typeof Resolved.Type

/**
 * Creates a route policy selecting one provider by identifier.
 *
 * @since 0.5.0
 * @category constructors
 */
export const explicitProvider = (provider: string): SelectionPolicy => ExplicitProvider.make({ provider })

/**
 * Extracts a provider identifier only from an explicit provider policy.
 *
 * @since 0.5.0
 * @category getters
 */
export const selectedProvider = (selectionPolicy: Option.Option<SelectionPolicy>): Option.Option<string> =>
  Option.flatMap(
    selectionPolicy,
    Match.type<SelectionPolicy>().pipe(
      Match.when(Match.string, () => Option.none()),
      Match.tag("provider", ({ provider }) => Option.some(provider)),
      Match.exhaustive
    )
  )

/**
 * Default route family used by OpenAI-compatible helpers.
 *
 * @since 0.5.0
 * @category constants
 */
export const defaultFamily: Family = "OpenAiCompatible"

/**
 * Conservative runtime flavor used when no implementation is identified.
 *
 * @since 0.5.0
 * @category constants
 */
export const defaultFlavor: Flavor = "unknown"
