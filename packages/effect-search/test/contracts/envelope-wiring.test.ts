import { describe, expect, it } from "@effect/vitest"
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import { Array as Arr, Effect, Layer, Number as Num, Schema } from "effect"

import * as ArtifactContext from "../../src/ArtifactContext.js"

const contextLayer = Effect.gen(function*() {
  const runId = yield* Schema.decode(StudyArtifact.RunId)("01HZ0000000000000000000000")
  const packageVersion = yield* Schema.decode(StudyArtifact.PackageVersion)("0.7.0")
  return ArtifactContext.layer(new ArtifactContext.Options({ runId, packageVersion, studyId: "atomic" }))
}).pipe(Layer.unwrapEffect)

describe("ArtifactContext", () => {
  it.effect("allocates unique monotonic identities under concurrent demand", () =>
    Effect.gen(function*() {
      const context = yield* ArtifactContext.ArtifactContext
      const ids = yield* Effect.all(Arr.replicate(context.nextId, 64), { concurrency: "unbounded" })

      expect(Arr.sort(Arr.map(ids, (id) => id.sequence), Num.Order)).toEqual(Arr.range(0, 63))
      expect(Arr.every(ids, (id) => id.runId === context.runId)).toBe(true)
    }).pipe(Effect.provide(contextLayer)))
})
