import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Match,
  Number as Num,
  Option,
  Predicate,
  Record,
  Schema,
  String as Str
} from "effect"

import { minimize } from "../../../src/Direction.js"
import { Choice } from "../../../src/Distribution.js"
import * as Objective from "../../../src/Objective.js"
import * as Sampler from "../../../src/Sampler.js"
import * as SearchSpace from "../../../src/SearchSpace.js"
import {
  FixtureRegistryLive,
  loadFixture,
  TpeNumericMixedDefaultFixture,
  TpeNumericSteppedFloatFixture
} from "../../helpers/fixtures/index.js"

const loadStepped = loadFixture("tpe-numeric.stepped-float").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Schema.toType(TpeNumericSteppedFloatFixture))),
  Effect.provide(FixtureRegistryLive)
)

const loadMixed = loadFixture("tpe-numeric.mixed-default").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Schema.toType(TpeNumericMixedDefaultFixture))),
  Effect.provide(FixtureRegistryLive)
)

const isNearTie = (nearTie: number) => (gap: Option.Option<number>): boolean =>
  Option.match(gap, {
    onNone: () => false,
    onSome: (value) => Bool.and(Num.isGreaterThan(value, 0), Num.isLessThanOrEqualTo(value, nearTie))
  })

const minimizeContext = (
  completed: ReadonlyArray<Sampler.Observation>,
  nextTrialNumber: number
) =>
  new Sampler.Context({
    completed,
    pending: [],
    objectiveSpec: Objective.single(minimize),
    nextTrialNumber,
    epsilon: 0
  })

// Unstepped continuous samples pass through truncated-normal ppf, whose libm last bits differ from
// NumPy; as in truncatedNormalFixture.test.ts they match within 1e-10. Ints, stepped floats and
// categoricals are discrete and must match exactly.
const SAMPLE_ABSOLUTE_TOLERANCE = 1e-10

const continuousParameters = (space: "float-int" | "step-log-categorical"): ReadonlyArray<string> =>
  Match.value(space).pipe(
    Match.when("float-int", () => ["x"]),
    Match.when("step-log-categorical", () => ["y"]),
    Match.exhaustive
  )

const decodeConfig = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Choice))

const mixedSpace = (space: "float-int" | "step-log-categorical") =>
  Match.value(space).pipe(
    Match.when("float-int", () => SearchSpace.make({ x: SearchSpace.float(0, 1), y: SearchSpace.int(1, 8) })),
    Match.when("step-log-categorical", () =>
      SearchSpace.make({
        x: SearchSpace.float(0, 1, { step: 0.1 }),
        y: SearchSpace.float(0.001, 1, { scale: "log" }),
        z: SearchSpace.categorical(["a", "b", "c"])
      })),
    Match.exhaustive
  )

describe("numeric TPE replays against live Optuna 4.9", () => {
  it.effect("tpe-numeric.stepped-float: stepped floats score quantized grid-cell mass", () =>
    Effect.gen(function*() {
      const { payload } = yield* loadStepped
      const space = yield* SearchSpace.make({
        x: SearchSpace.float(payload.space.low, payload.space.high, { step: payload.space.step })
      })
      const completed = Arr.map(payload.history, (trial) =>
        Sampler.observation(trial.trialNumber, { x: trial.x }, trial.value))
      yield* Effect.forEach(payload.runs, (run) =>
        Effect.gen(function*() {
          const strict = Arr.filter(run.expected, (row) =>
            Bool.not(isNearTie(payload.nearTie)(row.gap)))
          expect(strict).toHaveLength(Arr.length(run.expected))
          const selected = yield* Effect.forEach(strict, (row) =>
            Sampler.suggest(
              Sampler.tpe(
                new Sampler.TpeOptions({
                  seed: row.seed,
                  nStartupTrials: payload.sampler.nStartupTrials,
                  nEiCandidates: run.nEiCandidates,
                  multivariate: payload.sampler.multivariate
                })
              ),
              space,
              minimizeContext(completed, Arr.length(completed))
            ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Struct({ x: Schema.Finite })))))
          expect(Arr.map(selected, (config) => config.x), `nEiCandidates=${run.nEiCandidates}`).toEqual(
            Arr.map(strict, (row) => row.selected)
          )
        }))
    }))

  it.effect("tpe-numeric.mixed-default: default TPE samples numeric and mixed parameters independently", () =>
    Effect.gen(function*() {
      const { payload } = yield* loadMixed
      expect(payload.sampler.multivariate).toBe(false)
      yield* Effect.forEach(payload.runs, (run) =>
        Effect.gen(function*() {
          const space = yield* mixedSpace(run.space)
          const model = Sampler.tpe(
            new Sampler.TpeOptions({
              seed: run.seed,
              nStartupTrials: payload.sampler.nStartupTrials,
              nEiCandidates: payload.sampler.nEiCandidates
            })
          )
          // Startup trials come from the random sampler's own stream; Optuna's history is replayed so
          // every model-driven suggestion is compared against the exact upstream history.
          const modelDriven = Arr.drop(
            Arr.take(run.trace, Num.increment(run.strictThroughTrial)),
            payload.sampler.nStartupTrials
          )
          expect(Arr.length(modelDriven), `${run.space} seed=${run.seed}`).toBeGreaterThan(0)
          yield* Effect.forEach(modelDriven, (trial) =>
            Effect.gen(function*() {
              const history = Arr.map(
                Arr.take(run.trace, trial.number),
                (prior) => Sampler.observation(prior.number, prior.params, prior.value)
              )
              const label = `${run.space} seed=${run.seed} trial=${trial.number}`
              const suggested = yield* Sampler.suggest(model, space, minimizeContext(history, trial.number)).pipe(
                Effect.flatMap(decodeConfig)
              )
              expect(Arr.sort(Record.keys(suggested), Str.Order), label).toEqual(
                Arr.sort(Record.keys(trial.params), Str.Order)
              )
              yield* Effect.forEach(Record.toEntries(trial.params), ([name, expected]) =>
                Effect.sync(() =>
                  Bool.match(Arr.contains(continuousParameters(run.space), name), {
                    onFalse: () =>
                      expect(Record.get(suggested, name), `${label} ${name}`).toEqual(Option.some(expected)),
                    onTrue: () =>
                      expect(
                        Numeric.abs(Num.subtract(
                          Option.getOrElse(Option.filter(Record.get(suggested, name), Predicate.isNumber), () =>
                            Number.NaN),
                          Option.getOrElse(Option.liftPredicate(expected, Predicate.isNumber), () =>
                            Number.NaN)
                        )),
                        `${label} ${name}`
                      ).toBeLessThanOrEqual(SAMPLE_ABSOLUTE_TOLERANCE)
                  })
                ))
            }))
        }))
    }))
})
