/**
 * Authority schemas and digest helpers for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { ContentDigest, Digest256 } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const OpenAgentTraceTaggedDigestString = Schema.NonEmptyString.pipe(
  Schema.pattern(/^(blake3-256|sha256):[A-Za-z0-9_-]{43}$/u)
)

/**
 * Canonical trace-session identifier.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceSessionId = Schema.NonEmptyString

/**
 * Canonical event identifier for normalized trace entries.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceEventId = Schema.NonEmptyString

/**
 * Canonical record identifier for one normalized trace row.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceRecordId = Schema.NonEmptyString.pipe(Schema.brand("OpenAgentTraceRecordId"))

/**
 * Canonical content-block identifier.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceBlockId = Schema.NonEmptyString

/**
 * Canonical redaction-finding identifier.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceFindingId = Schema.NonEmptyString

/**
 * Canonical deterministic-redaction key reference.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceRedactionKey = Schema.NonEmptyString.pipe(Schema.brand("OpenAgentTraceRedactionKey"))

/**
 * Canonical tagged content digest used across normalized trace surfaces.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceContentDigest = ContentDigest

const digestValueFrom = (value: string) => value.slice(value.indexOf(":") + 1)

const digestAlgorithmFrom = (value: string): "blake3-256" | "sha256" =>
  value.startsWith("blake3-256:") ? "blake3-256" : "sha256"

/**
 * Decodes one tagged digest string into the schema-owned digest authority.
 *
 * @since 0.2.0
 * @category combinators
 */
export const decodeOpenAgentTraceContentDigest = (value: string) =>
  Effect.gen(function*() {
    const tagged = yield* Schema.decode(OpenAgentTraceTaggedDigestString)(value)
    const digest = yield* Schema.decode(Digest256)(digestValueFrom(tagged))

    return ContentDigest.make({ algorithm: digestAlgorithmFrom(tagged), digest })
  })

/**
 * Formats one schema-owned digest authority into the tagged string carried by public source manifests.
 *
 * @since 0.2.0
 * @category combinators
 */
export const formatOpenAgentTraceContentDigest = (value: ContentDigest): string => `${value.algorithm}:${value.digest}`

/**
 * Manifest-tagged digest strings consumed from raw `pi-share-hf` publication metadata.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceManifestDigest = OpenAgentTraceTaggedDigestString
