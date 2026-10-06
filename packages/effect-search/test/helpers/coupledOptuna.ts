import { BunServices } from "@effect/platform-bun"
import { expect } from "@effect/vitest"
import * as Digest from "@scenesystems/digest/Digest"
import { Array as Arr, Effect, FileSystem, Match, Number as Num, Path, Schema } from "effect"
import * as Hex from "effect/encoding/Hex"
import type * as Optimization from "../../src/Optimization.js"
import { AcquisitionGap } from "./selectionGaps.js"

const Trial = Schema.Struct({
  number: Schema.Int,
  params: Schema.Struct({ instruction: Schema.String, demo: Schema.String, temperature: Schema.String }),
  value: Schema.Finite
})
const Sequence = Schema.Struct({
  sampler: Schema.Literals(["tpe", "random"]),
  multivariate: Schema.Boolean,
  sequence: Schema.Array(Trial),
  strictThroughTrial: Schema.Int,
  acquisitionGaps: Schema.Array(AcquisitionGap),
  best: Trial
})

export const loadCoupledOptuna = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const url = yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url)
  const root = path.resolve(path.dirname(yield* path.fromFileUrl(url)), "../fixtures/optuna-mipro")
  const manifest = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
    upstream: Schema.Struct({ optuna: Schema.Literal("4.9.0") }),
    fixtures: Schema.NonEmptyArray(Schema.Struct({ sha256: Schema.String }))
  })))(yield* fs.readFileString(path.join(root, "manifest.json")))
  const raw = yield* fs.readFileString(path.join(root, "categorical.json"))
  expect(Hex.encode(yield* Digest.hashString("sha256", raw))).toBe(Arr.headNonEmpty(manifest.fixtures).sha256)
  return (yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
    coupledSequences: Schema.Array(Sequence)
  })))(raw)).coupledSequences
}).pipe(Effect.provide(BunServices.layer))

export const expectCoupledTrace = (
  result: Optimization.SingleObjectiveResult,
  reference: typeof Sequence.Type
) => {
  const count = Num.increment(reference.strictThroughTrial)
  if (Num.Equivalence(count, reference.sequence.length)) {
    expect({
      number: result.bestTrial.trialNumber,
      params: result.bestTrial.config,
      value: result.bestTrial.state.value
    })
      .toEqual(reference.best)
  }
  expect(Arr.map(Arr.take(Arr.fromIterable(result.trials), count), (trial) => ({
    number: trial.trialNumber,
    params: trial.config,
    value: Match.value(trial.state).pipe(
      Match.tag("Completed", ({ value }) => value),
      Match.orElse(() => "not completed")
    )
  }))).toEqual(Arr.take(reference.sequence, count))
}
