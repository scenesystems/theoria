/**
 * Run-scoped artifact provenance and atomic identity allocation.
 *
 * @since 0.1.0
 * @module
 */
import { Context, Data, Effect, Layer, Number as Num, Option, Ref, Schema } from "effect"

import * as Artifact from "./Artifact.js"
import * as PersistenceError from "./PersistenceError.js"

/**
 * Run provenance and sequence reservation used by an artifact producer.
 * nextSequence is the first available sequence (zero when omitted). Restore it
 * from the reservation high-water mark, not merely successfully delivered payloads.
 * A supplied allocator owns atomic, unique reservations across restarts and writers;
 * its results must be at least nextSequence. Map backend errors to PersistenceError.
 *
 * @since 0.1.0
 * @category models
 */
export class Options<R = never> extends Data.Class<{
  readonly packageVersion: Artifact.PackageVersion
  readonly runId: Artifact.RunId
  readonly nextSequence?: number
  readonly allocate?: Effect.Effect<number, PersistenceError.Failure, R>
}> {}

/**
 * Allocates monotonic artifact identities for one run.
 *
 * @since 0.1.0
 * @category services
 */
export class ArtifactContext extends Context.Service<
  ArtifactContext,
  {
    readonly packageVersion: Artifact.PackageVersion
    readonly runId: Artifact.RunId
    readonly nextId: Effect.Effect<Artifact.Id, PersistenceError.Failure>
  }
>()("@scenesystems/effect-study/ArtifactContext") {}

/**
 * Builds a context using the restored sequence or caller-owned allocator. Allocator
 * services are captured at construction; allocation occurs only when nextId runs.
 * Allocation does not store a payload. Failed or interrupted delivery may leave gaps;
 * retry delivery with the allocated artifact, not another call to nextId.
 * Memory allocation is atomic within this context, not durable across process loss.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <R>(options: Options<R>): Effect.Effect<ArtifactContext["Service"], PersistenceError.Failure, R> =>
  Effect.gen(function*() {
    const next = yield* Schema.decodeEffect(Artifact.Id.fields.sequence)(
      Option.getOrElse(Option.fromNullishOr(options.nextSequence), () => 0)
    ).pipe(Effect.mapError(PersistenceError.codec("write")))
    const services = yield* Effect.context<R>()
    const sequence = yield* Ref.make(next)
    const allocate = Option.getOrElse(
      Option.fromNullishOr(options.allocate),
      () => Ref.getAndUpdate(sequence, Num.increment)
    )
    return {
      packageVersion: options.packageVersion,
      runId: options.runId,
      nextId: allocate.pipe(
        Effect.provide(services),
        Effect.flatMap(Schema.decodeEffect(Artifact.Id.fields.sequence.check(Schema.isGreaterThanOrEqualTo(next)))),
        Effect.mapError((error) => Schema.isSchemaError(error) ? PersistenceError.codec("write")(error) : error),
        Effect.map((value) => new Artifact.Id({ runId: options.runId, sequence: value }))
      )
    }
  })

/**
 * Provides a fresh artifact context for one run.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = <R>(options: Options<R>): Layer.Layer<ArtifactContext, PersistenceError.Failure, R> =>
  Layer.fresh(Layer.effect(ArtifactContext, make(options)))
