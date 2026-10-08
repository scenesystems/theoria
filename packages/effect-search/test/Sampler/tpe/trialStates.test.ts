import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Record,
  Schema,
  Struct
} from "effect"

import { splitHistory } from "../../../src/internal/tpe/historySplit.js"
import * as Objective from "../../../src/Objective.js"
import { Report } from "../../../src/Pruning.js"
import * as Sampler from "../../../src/Sampler.js"
import * as SearchSpace from "../../../src/SearchSpace.js"
import {
  FixtureRegistryLive,
  loadFixture,
  TrialStatesConstantLiarFixture,
  TrialStatesPrunedConstraintsFixture
} from "../../helpers/fixtures/index.js"

const loadLiar = loadFixture("trial-states.constant-liar").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(TrialStatesConstantLiarFixture)),
  Effect.provide(FixtureRegistryLive)
)

const loadPrunedConstraints = loadFixture("trial-states.pruned-constraints").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(TrialStatesPrunedConstraintsFixture)),
  Effect.provide(FixtureRegistryLive)
)

const decodeChoice = Schema.decodeUnknownEffect(Schema.Struct({ x: Schema.String }))

describe("TPE trial-state contracts against live Optuna 4.9", () => {
  it.effect("trial-states.constant-liar: RUNNING reservations enter the split only with constantLiar", () =>
    Effect.gen(function*() {
      const { payload } = yield* loadLiar
      const space = yield* SearchSpace.make({ x: SearchSpace.categorical(payload.choices) })
      const completed = Arr.map(
        payload.completed,
        (trial) => Sampler.observation(trial.trialNumber, { x: trial.x }, trial.value)
      )
      const context = (withRunning: boolean) =>
        new Sampler.Context({
          completed,
          pending: Arr.filter([Sampler.pending(payload.running.trialNumber, { x: payload.running.x })], () =>
            withRunning),
          objectiveSpec: Objective.single(payload.direction),
          nextTrialNumber: Bool.match(withRunning, {
            onFalse: () =>
              payload.running.trialNumber,
            onTrue: () => Num.increment(payload.running.trialNumber)
          }),
          epsilon: 0
        })
      const options = (seed: number, constantLiar: Option.Option<boolean>) =>
        new Sampler.TpeOptions({
          seed,
          nStartupTrials: payload.nStartupTrials,
          multivariate: payload.multivariate,
          ...Option.match(constantLiar, { onNone: () => ({}), onSome: (value) => ({ constantLiar: value }) })
        })
      const draws = (constantLiar: Option.Option<boolean>, withRunning: boolean) =>
        Effect.forEach(
          payload.seeds,
          (seed) =>
            Sampler.suggest(Sampler.tpe(options(seed, constantLiar)), space, context(withRunning)).pipe(
              Effect.flatMap(decodeChoice),
              Effect.map(Struct.get("x"))
            )
        )

      expect(payload.expected.defaultConstantLiar).toBe(false)
      expect(Sampler.tpe(options(0, Option.none())).pendingImputationPolicy.name).toBe("none")
      expect(Sampler.tpe(options(0, Option.some(true))).pendingImputationPolicy.name).toBe("constant-liar")
      expect(yield* draws(Option.none(), false)).toEqual(payload.expected.withoutRunning)
      expect(yield* draws(Option.none(), true)).toEqual(payload.expected.runningDefault)
      expect(yield* draws(Option.some(false), true)).toEqual(payload.expected.runningDefault)
      expect(yield* draws(Option.some(true), true)).toEqual(payload.expected.runningConstantLiar)
      expect(yield* draws(Option.some(true), false)).toEqual(payload.expected.withoutRunning)
    }))

  it.effect("trial-states.pruned-constraints: config constraints rank PRUNED trials as upstream does", () =>
    Effect.gen(function*() {
      const { payload } = yield* loadPrunedConstraints
      yield* Effect.forEach(payload.cases, (testCase) =>
        Effect.gen(function*() {
          const constraints = Arr.map(testCase.constraintParams, (name) => (config: unknown) =>
            Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Finite))(config).pipe(
              Effect.map((params) =>
                Record.get(params, name).pipe(Option.getOrElse(() => Number.NaN))
              ),
              Effect.orDie
            ))
          const completed = Arr.flatMap(testCase.trials, (trial) =>
            Match.value(trial.state).pipe(
              Match.when("complete", () =>
                Option.match(Option.fromNullishOr(trial.value), {
                  onNone: () => Arr.empty(),
                  onSome: (value) => Arr.of(Sampler.observation(trial.trialNumber, trial.params, value))
                })),
              Match.orElse(() => Arr.empty())
            ))
          const pruned = Arr.flatMap(testCase.trials, (trial) =>
            Bool.match(Equal.equals(trial.state, "pruned"), {
              onFalse: () => Arr.empty(),
              onTrue: () =>
                Arr.of(
                  new Sampler.PrunedObservation({
                    trialNumber: trial.trialNumber,
                    config: trial.params,
                    reports: Arr.map(trial.reports, (report) => new Report(report))
                  })
                )
            }))
          const split = yield* splitHistory(
            new Sampler.Context({
              completed,
              pruned,
              pending: [],
              objectiveSpec: Objective.single(testCase.direction),
              nextTrialNumber: Arr.length(testCase.trials),
              epsilon: 0
            }),
            constraints
          )
          expect(Arr.length(split.below), testCase.id).toBe(testCase.nBelow)
          expect(Arr.map(split.below, (trial) => trial.trialNumber), testCase.id).toEqual(testCase.expectedBelow)
          expect(Arr.map(split.above, (trial) => trial.trialNumber), testCase.id).toEqual(testCase.expectedAbove)
        }))
    }))
})
