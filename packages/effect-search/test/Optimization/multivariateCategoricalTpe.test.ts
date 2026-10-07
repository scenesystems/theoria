import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import { expectCoupledTrace, loadCoupledOptuna } from "../helpers/coupledOptuna.js"
import { withGapAssertions } from "../helpers/selectionGaps.js"

const instructionChoices = Arr.make("i0", "i1", "i2", "i3", "i4", "i5")
const demoChoices = Arr.make("d0", "d1", "d2", "d3", "d4", "d5")
const temperatureChoices = Arr.make("cool", "warm", "hot")
const preferredDemos = Arr.make("d3", "d5", "d1", "d4", "d0", "d2")

const CoupledSpace = SearchSpace.make({
  instruction: SearchSpace.categorical(instructionChoices),
  demo: SearchSpace.categorical(demoChoices),
  temperature: SearchSpace.categorical(temperatureChoices)
})

const decodeConfig = (raw: unknown) =>
  Effect.flatMap(CoupledSpace, (space) => Schema.decodeUnknownEffect(space.schema)(raw))

const indexOfChoice = (choices: Iterable<string>, value: string): number =>
  Arr.findFirstIndex(choices, Equal.equals(value)).pipe(Option.getOrElse(() => 0))

const objectiveValue = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeConfig(raw)
    const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
    const preferredDemo = Arr.get(preferredDemos, instructionIndex).pipe(
      Option.getOrElse(() => Arr.headNonEmpty(demoChoices))
    )
    const couplingPenalty = Match.value(Equal.equals(config.demo, preferredDemo)).pipe(
      Match.when(true, () => 0),
      Match.orElse(() => 4.5)
    )
    const temperaturePenalty = Match.value(config.temperature).pipe(
      Match.when("cool", () => 0),
      Match.when("warm", () => 0.15),
      Match.orElse(() => 0.35)
    )

    return Num.sumAll(Arr.make(couplingPenalty, temperaturePenalty, Num.multiply(instructionIndex, 0.01)))
  })

const isCoupledBestPair = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeConfig(raw)
    const instructionIndex = indexOfChoice(instructionChoices, config.instruction)
    const preferredDemo = Arr.get(preferredDemos, instructionIndex).pipe(
      Option.getOrElse(() => Arr.headNonEmpty(demoChoices))
    )

    return Equal.equals(config.demo, preferredDemo)
  })

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const runWith = (sampler: Sampler.Sampler) =>
  Effect.gen(function*() {
    const space = yield* CoupledSpace
    return yield* Optimization.run(
      new Optimization.FlatOptions({
        space,
        sampler,
        direction: "minimize",
        trials: 24,
        objective: objectiveValue
      })
    )
  })

describe("integration multivariate categorical tpe optimization", () => {
  it.effect("samples categorical products larger than 65536 without enumerating tuples", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        left: SearchSpace.categorical(Arr.range(0, 256)),
        right: SearchSpace.categorical(Arr.range(0, 255))
      })
      const result = yield* Sampler.suggest(
        Sampler.tpe(new Sampler.TpeOptions({ seed: 19, nStartupTrials: 0, nEiCandidates: 1 })),
        space,
        Sampler.emptyContext()
      ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(space.schema)))

      expect(result.left).toBeGreaterThanOrEqual(0)
      expect(result.left).toBeLessThan(257)
      expect(result.right).toBeGreaterThanOrEqual(0)
      expect(result.right).toBeLessThan(256)
    }))

  it.effect("samples at the joint categorical domain limit", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({
        left: SearchSpace.categorical(Arr.range(0, 255)),
        right: SearchSpace.categorical(Arr.range(0, 255))
      })
      const result = yield* Sampler.suggest(
        Sampler.tpe(new Sampler.TpeOptions({ seed: 19, nStartupTrials: 0, nEiCandidates: 1 })),
        space,
        Sampler.emptyContext()
      ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(space.schema)))

      expect(result.left).toBeGreaterThanOrEqual(0)
      expect(result.left).toBeLessThan(256)
      expect(result.right).toBeGreaterThanOrEqual(0)
      expect(result.right).toBeLessThan(256)
    }))

  it.effect("preserves categorical strings without requiring tuple-key encoding", () =>
    Effect.gen(function*() {
      const space = yield* SearchSpace.make({ choice: SearchSpace.categorical(Arr.of("\ud800")) })
      const result = yield* Sampler.suggest(
        Sampler.tpe(new Sampler.TpeOptions({ seed: 19, nStartupTrials: 0 })),
        space,
        Sampler.emptyContext()
      ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(space.schema)))

      expect(result.choice).toBe("\ud800")
    }))

  it.effect("replays Optuna's coupled categorical TPE and random trial tables", () =>
    Effect.gen(function*() {
      yield* Effect.forEach(yield* loadCoupledOptuna, (reference) =>
        Effect.gen(function*() {
          const sampler = Bool.match(Equal.equals(reference.sampler, "random"), {
            onFalse: () =>
              Sampler.tpe(
                new Sampler.TpeOptions({
                  seed: 211,
                  multivariate: reference.multivariate,
                  nStartupTrials: 8,
                  nEiCandidates: 80
                })
              ),
            onTrue: () => Sampler.random({ seed: 211 })
          })
          const result = yield* Effect.fromOption(asSingleObjective(
            yield* withGapAssertions(
              runWith(sampler),
              reference.acquisitionGaps,
              reference.strictThroughTrial
            )
          ))
          expect(yield* isCoupledBestPair(result.bestTrial.config)).toBe(true)
          expectCoupledTrace(result, reference)
        }))
    }))
})
