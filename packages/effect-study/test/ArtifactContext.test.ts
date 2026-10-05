import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Context, Effect, Number as Num, Ref, Result, Schema, String as Str } from "effect"

import * as Artifact from "@scenesystems/effect-study/Artifact"
import * as ArtifactContext from "@scenesystems/effect-study/ArtifactContext"
import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"

class Sequence extends Context.Service<Sequence, Ref.Ref<number>>()("effect-study/test/ArtifactContext/Sequence") {}

describe("ArtifactContext", () => {
  it.effect("starts at the restored next sequence without reusing committed identities", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decodeEffect(Artifact.RunId)("01HZ0000000000000000000000")
      const packageVersion = yield* Schema.decodeEffect(Artifact.PackageVersion)("0.1.0")
      const context = yield* ArtifactContext.make(
        new ArtifactContext.Options({ packageVersion, runId, nextSequence: 17 })
      )
      expect((yield* context.nextId).sequence).toBe(17)
      expect((yield* context.nextId).sequence).toBe(18)
      const resumed = yield* ArtifactContext.make(
        new ArtifactContext.Options({ packageVersion, runId, nextSequence: 21 })
      )
      expect((yield* resumed.nextId).sequence).toBe(21)
      const invalid = yield* ArtifactContext.make(
        new ArtifactContext.Options({ packageVersion, runId, nextSequence: -1 })
      ).pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(invalid))).reason).toBe("Codec")
      const belowFloor = yield* ArtifactContext.make(
        new ArtifactContext.Options({
          packageVersion,
          runId,
          nextSequence: 21,
          allocate: Effect.succeed(20)
        })
      )
      const rejected = yield* belowFloor.nextId.pipe(Effect.result)
      expect((yield* Effect.fromResult(Result.flip(rejected))).reason).toBe("Codec")
    }))

  it.effect("captures allocator services and propagates reservation failure without retrying or reclaiming gaps", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decodeEffect(Artifact.RunId)("01HZ0000000000000000000000")
      const packageVersion = yield* Schema.decodeEffect(Artifact.PackageVersion)("0.1.0")
      const sequence = yield* Ref.make(41)
      const failure = new PersistenceError.Failure({
        reason: "Backend",
        operation: "write",
        detail: "reservation unavailable"
      })
      const options = new ArtifactContext.Options({
        runId,
        packageVersion,
        allocate: Sequence.pipe(
          Effect.flatMap((ref) => Ref.getAndUpdate(ref, Num.increment)),
          Effect.filterOrFail((value) => !Num.Equivalence(value, 42), () => failure)
        )
      })
      const context = yield* ArtifactContext.make(options).pipe(Effect.provideService(Sequence, sequence))
      expect(yield* Ref.get(sequence)).toBe(41)
      expect((yield* context.nextId).sequence).toBe(41)
      expect(yield* context.nextId.pipe(Effect.result)).toEqual(Result.fail(failure))
      expect(yield* Ref.get(sequence)).toBe(43)
      const resumed = yield* ArtifactContext.make(options).pipe(Effect.provideService(Sequence, sequence))
      expect((yield* resumed.nextId).sequence).toBe(43)
    }))

  it.effect("allocates unique monotonic identities under concurrent demand", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decodeEffect(Artifact.RunId)("01HZ0000000000000000000000")
      const packageVersion = yield* Schema.decodeEffect(Artifact.PackageVersion)("0.1.0")
      const context = yield* ArtifactContext.make(new ArtifactContext.Options({ packageVersion, runId }))
      const ids = yield* Effect.all(Arr.replicate(context.nextId, 64), { concurrency: "unbounded" })

      expect(Arr.sort(Arr.map(ids, (id) => id.sequence), Num.Order)).toEqual(Arr.range(0, 63))
      expect(Arr.every(ids, (id) => Str.Equivalence(id.runId, runId))).toBe(true)
      expect(context.packageVersion).toBe(packageVersion)
    }))

  it.effect("builds independent mutable contexts when the same layer is provided twice", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decodeEffect(Artifact.RunId)("01HZ0000000000000000000000")
      const packageVersion = yield* Schema.decodeEffect(Artifact.PackageVersion)("0.1.0")
      const layer = ArtifactContext.layer(new ArtifactContext.Options({ packageVersion, runId }))
      const nextSequence = ArtifactContext.ArtifactContext.pipe(
        Effect.flatMap((context) => context.nextId),
        Effect.map((id) => id.sequence)
      )

      const first = yield* nextSequence.pipe(Effect.provide(layer))
      const second = yield* nextSequence.pipe(Effect.provide(layer))

      expect(first).toBe(0)
      expect(second).toBe(0)
    }))
})
