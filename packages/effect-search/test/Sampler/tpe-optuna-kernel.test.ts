import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import * as Digest from "@scenesystems/digest/Digest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Effect, Equal, FileSystem, Number as Num, Option, Path, Record, Schema } from "effect"
import * as Hex from "effect/encoding/Hex"
import { maximize } from "../../src/Direction.js"
import { Single } from "../../src/Objective.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import { AcquisitionGap, withGapAssertions } from "../helpers/selectionGaps.js"

const Trial = Schema.Struct({
  number: Schema.Int,
  params: Schema.Record(Schema.String, Schema.Int),
  state: Schema.Literals(["COMPLETE", "FAIL"]),
  value: Schema.OptionFromNullOr(Schema.Finite)
})
const Kernel = Schema.Struct({
  seed: Schema.Int,
  space: Schema.Record(Schema.String, Schema.Array(Schema.Int)),
  options: Schema.Struct({ n_startup_trials: Schema.Int, n_ei_candidates: Schema.Int, multivariate: Schema.Boolean }),
  sequence: Schema.Array(Trial),
  strictThroughTrial: Schema.Int,
  acquisitionGaps: Schema.Array(AcquisitionGap),
  categoricalSequences: Schema.Array(Schema.Struct({
    seed: Schema.Int,
    multivariate: Schema.Boolean,
    space: Schema.Record(Schema.String, Schema.Array(Schema.Int)),
    sequence: Schema.Array(Trial),
    nStartupTrials: Schema.Int,
    strictThroughTrial: Schema.Int,
    acquisitionGaps: Schema.Array(AcquisitionGap)
  })),
  distribution: Schema.Struct({
    draws: Schema.Int,
    maxTotalVariation: Schema.Finite,
    samples: Schema.Array(Schema.Record(Schema.String, Schema.Int)),
    acquisitionGaps: Schema.Array(AcquisitionGap),
    joint: Schema.Array(Schema.Struct({ choices: Schema.Array(Schema.Int), count: Schema.Int }))
  })
})
const load = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const url = yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url)
  const root = path.resolve(path.dirname(yield* path.fromFileUrl(url)), "../fixtures/optuna-mipro")
  const index = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
    upstream: Schema.Struct({ optuna: Schema.Literal("4.9.0"), python: Schema.String, platform: Schema.String }),
    fixtures: Schema.NonEmptyArray(Schema.Struct({
      id: Schema.Literal("optuna-mipro-categorical-001"),
      evidence: Schema.Literal("upstream-kernel"),
      sha256: Schema.String
    }))
  })))(yield* fs.readFileString(path.join(root, "manifest.json")))
  const raw = yield* fs.readFileString(path.join(root, "categorical.json"))
  expect(Hex.encode(yield* Digest.hashString("sha256", raw))).toBe(Arr.headNonEmpty(index.fixtures).sha256)
  return yield* Schema.decodeEffect(Schema.fromJsonString(Kernel))(raw)
}).pipe(Effect.provide(BunServices.layer))

const context = (trials: ReadonlyArray<typeof Trial.Type>, nextTrialNumber: number) =>
  new Sampler.Context({
    completed: Arr.getSomes(Arr.map(trials, (t) =>
      Option.map(t.value, (value) =>
        new Sampler.Observation({
          trialNumber: t.number,
          config: t.params,
          value
        })))),
    pending: [],
    objectiveSpec: Single({ direction: maximize }),
    nextTrialNumber,
    epsilon: 0
  })
const sampler = (reference: typeof Kernel.Type, seed: number) =>
  Sampler.tpe(
    new Sampler.TpeOptions({
      seed,
      nStartupTrials: reference.options.n_startup_trials,
      nEiCandidates: reference.options.n_ei_candidates,
      multivariate: reference.options.multivariate
    })
  )

it.effect("replays Optuna ask/tell history, excluding the failed observation from fitting", () =>
  Effect.gen(function*() {
    const reference = yield* load
    const space = yield* SearchSpace.make(Record.map(reference.space, SearchSpace.categorical))
    const model = sampler(reference, reference.seed)
    expect(Arr.filter(reference.sequence, (t) => Equal.equals(t.state, "FAIL"))).toHaveLength(1)
    expect(context(reference.sequence, 16).completed).toHaveLength(15)
    yield* Effect.forEach(Arr.drop(reference.sequence, 1), (trial) =>
      Effect.gen(function*() {
        const history = Arr.filter(reference.sequence, (t) => Num.isLessThan(t.number, trial.number))
        const config = yield* withGapAssertions(
          Sampler.suggest(model, space, context(history, trial.number)),
          Arr.filter(reference.acquisitionGaps, (gap) => Num.Equivalence(gap.trial, trial.number))
        ).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Int)))
        )
        expect(config, `Optuna trial ${trial.number}`).toEqual(trial.params)
        yield* Schema.decodeEffect(space.schema)(config)
        yield* Effect.forEach(Record.toEntries(reference.space), ([key, values]) =>
          Effect.sync(() => {
            expect(values).toContain(config[key])
          }))
      }))
  }))

it.effect("matches independent and multivariate categorical trajectories, skipping singleton draws", () =>
  Effect.gen(function*() {
    const reference = yield* load
    yield* Effect.forEach(reference.categoricalSequences, (entry) =>
      Effect.gen(function*() {
        const space = yield* SearchSpace.make(Record.map(entry.space, SearchSpace.categorical))
        const model = Sampler.tpe(
          new Sampler.TpeOptions({
            seed: entry.seed,
            multivariate: entry.multivariate,
            nStartupTrials: entry.nStartupTrials
          })
        )
        yield* Effect.forEach(Arr.drop(Arr.take(entry.sequence, Num.increment(entry.strictThroughTrial)), 1), (trial) =>
          Effect.gen(function*() {
            expect(
              yield* withGapAssertions(
                Sampler.suggest(model, space, context(Arr.take(entry.sequence, trial.number), trial.number)),
                Arr.filter(entry.acquisitionGaps, (gap) =>
                  Num.Equivalence(gap.trial, trial.number))
              ),
              `seed=${entry.seed} multivariate=${entry.multivariate} trial=${trial.number}`
            ).toEqual(trial.params)
          }))
      }))
  }))

it.effect("resumes both TPE and startup NumPy streams through encoded checkpoints", () =>
  Effect.gen(function*() {
    const reference = yield* load
    const space = yield* SearchSpace.make(Record.map(reference.space, SearchSpace.categorical))
    yield* Effect.forEach([2, 8], (cutoff) =>
      Effect.gen(function*() {
        const model = sampler(reference, reference.seed)
        yield* Effect.forEach(
          Arr.filter(
            reference.sequence,
            (trial) => Num.isGreaterThan(trial.number, 0) && Num.isLessThan(trial.number, cutoff)
          ),
          (trial) => Sampler.suggest(model, space, context(Arr.take(reference.sequence, trial.number), trial.number))
        )
        const codec = Schema.fromJsonString(Schema.toCodecJson(Sampler.Checkpoint))
        const wire = yield* Schema.encodeEffect(codec)(yield* Sampler.checkpoint(model))
        const restored = sampler(reference, reference.seed)
        yield* Sampler.restore(restored, yield* Schema.decodeEffect(codec)(wire))
        yield* Effect.forEach(Arr.drop(reference.sequence, cutoff), (trial) =>
          Effect.gen(function*() {
            expect(
              yield* Sampler.suggest(restored, space, context(Arr.take(reference.sequence, trial.number), trial.number))
            )
              .toEqual(trial.params)
          }))
      }))
  }))

it.effect("optuna-mipro-categorical-001: fixed-history joint distribution matches Optuna 4.9", () =>
  Effect.gen(function*() {
    const reference = yield* load
    const space = yield* SearchSpace.make(Record.map(reference.space, SearchSpace.categorical))
    const keys = Record.keys(reference.space)
    const draws = yield* withGapAssertions(
      Effect.forEach(
        Arr.makeBy(reference.distribution.draws, (i) => i),
        (seed) =>
          Sampler.suggest(sampler(reference, seed), space, context(reference.sequence, Arr.length(reference.sequence)))
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Int)))
            )
      ),
      reference.distribution.acquisitionGaps
    )
    expect(draws).toEqual(reference.distribution.samples)
    const variation = Num.divideUnsafe(
      Arr.reduce(reference.distribution.joint, 0, (sum, cell) => {
        const count = Arr.length(
          Arr.filter(
            draws,
            (draw) => Arr.every(Arr.zip(keys, cell.choices), ([key, choice]) => Equal.equals(draw[key], choice))
          )
        )
        return Num.sum(sum, Numeric.abs(Num.subtract(count, cell.count)))
      }),
      Num.multiply(2, reference.distribution.draws)
    )
    expect(variation).toBe(0)
  }))
