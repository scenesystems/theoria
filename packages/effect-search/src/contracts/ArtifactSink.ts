/**
 * Effect service for delivering artifact envelopes to caller-selected storage or observers.
 *
 * @since 0.1.0
 */
import { Effect, Layer } from "effect"
import type * as Context from "effect/Context"

import type { ArtifactStorageError } from "../Errors/Artifact.js"
import type { ArtifactEnvelope } from "./ArtifactEnvelope.js"

/**
 * Requires an implementation that consumes each envelope and reports an envelope it
 * could not deliver as an {@link ArtifactStorageError}. In-memory and observer sinks
 * never fail; persistent sinks fail when the medium does.
 *
 * @since 0.1.0
 * @category services
 */
export class ArtifactSink extends Effect.Tag("effect-search/ArtifactSink")<
  ArtifactSink,
  {
    /** Delivers one envelope according to the implementation's ordering and durability contract. */
    readonly emit: (envelope: ArtifactEnvelope) => Effect.Effect<void, ArtifactStorageError>
  }
>() {}

/**
 * Contract for custom sinks and sink composition.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ArtifactSinkApi = Context.Tag.Service<typeof ArtifactSink>

/**
 * Delivers each envelope to the left sink and then the right sink.
 *
 * @remarks
 * The right sink starts only after the left sink succeeds, so a left failure leaves the
 * right sink without the envelope. Calls for separate envelopes share no ordering or
 * serialization beyond what the caller establishes.
 *
 * @since 0.1.0
 * @category combinators
 */
export const fanout = (left: ArtifactSinkApi, right: ArtifactSinkApi): ArtifactSinkApi => ({
  emit: (envelope) => left.emit(envelope).pipe(Effect.zipRight(right.emit(envelope)))
})

/**
 * Delivers an envelope through the required {@link ArtifactSink} service.
 * Completion means the selected sink accepted the envelope; durability beyond that
 * belongs to the implementation.
 *
 * @since 0.1.0
 * @category combinators
 */
export const emit = (envelope: ArtifactEnvelope): Effect.Effect<void, ArtifactStorageError, ArtifactSink> =>
  ArtifactSink.pipe(Effect.flatMap((sink) => sink.emit(envelope)))

/**
 * Installs an existing sink implementation without acquisition, release, or requirements.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = (api: ArtifactSinkApi): Layer.Layer<ArtifactSink> => Layer.succeed(ArtifactSink, api)
