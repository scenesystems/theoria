/**
 * Pluggable output boundary for artifact envelopes.
 *
 * ArtifactSink is the primary persistence path — developers provide a sink
 * Layer. The `fileSystem` convenience creates an envelope-JSONL writer.
 *
 * @since 0.1.0
 */
import { Effect, Layer } from "effect"
import type * as Context from "effect/Context"

import type { ArtifactEnvelope } from "./ArtifactEnvelope.js"

/**
 * Tagged service for receiving artifact envelopes.
 *
 * Required — consumers must provide an `ArtifactSink` layer. For
 * file-based JSONL persistence, use the `fileSystemSink` convenience
 * layer instead of implementing the emit callback manually.
 *
 * @see {@link ArtifactEnvelope} — the envelope type this sink receives
 * @see {@link layer} — construct a layer from a custom implementation
 *
 * @since 0.1.0
 * @category services
 */
export class ArtifactSink extends Effect.Tag("effect-search/ArtifactSink")<
  ArtifactSink,
  {
    readonly emit: (envelope: ArtifactEnvelope) => Effect.Effect<void>
  }
>() {}

/**
 * The implementation interface that `ArtifactSink` layers must satisfy.
 * Extract this type when writing a custom sink or composing sinks
 * with {@link fanout}.
 *
 * @see {@link ArtifactSink} — the tagged service this type backs
 * @see {@link fanout} — combine two implementations into one
 *
 * @since 0.1.0
 * @category type-level
 */
export type ArtifactSinkApi = Context.Tag.Service<typeof ArtifactSink>

/**
 * Combine two sinks — both receive every envelope.
 * The left sink runs first, then the right; failures in either propagate.
 *
 * @see {@link ArtifactSinkApi} — the interface both sinks must satisfy
 * @see {@link layer} — wrap the combined sink into a Layer
 *
 * @since 0.1.0
 * @category combinators
 */
export const fanout = (left: ArtifactSinkApi, right: ArtifactSinkApi): ArtifactSinkApi => ({
  emit: (envelope) => left.emit(envelope).pipe(Effect.zipRight(right.emit(envelope)))
})

/**
 * Emit an envelope through the required ArtifactSink. Adds `ArtifactSink`
 * to the effect's requirements — the caller must provide a sink layer.
 *
 * @see {@link ArtifactSink} — the service this effect requires
 * @see {@link ArtifactEnvelope} — the envelope type being emitted
 *
 * @since 0.1.0
 * @category combinators
 */
export const emit = (envelope: ArtifactEnvelope): Effect.Effect<void, never, ArtifactSink> =>
  ArtifactSink.pipe(Effect.flatMap((sink) => sink.emit(envelope)))

/**
 * Create an ArtifactSink layer from an {@link ArtifactSinkApi} implementation.
 * Wraps the implementation with `Layer.succeed` — no acquisition effects.
 *
 * @see {@link ArtifactSinkApi} — the interface the implementation must satisfy
 * @see {@link fanout} — combine two implementations before wrapping in a layer
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = (api: ArtifactSinkApi): Layer.Layer<ArtifactSink> => Layer.succeed(ArtifactSink, api)
