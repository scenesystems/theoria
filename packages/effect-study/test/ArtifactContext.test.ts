import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Schema, String as Str } from "effect"

import * as Artifact from "@scenesystems/effect-study/Artifact"
import * as ArtifactContext from "@scenesystems/effect-study/ArtifactContext"

describe("ArtifactContext", () => {
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
