import { expect, it } from "@effect/vitest"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Effect, Option, Schema, Struct } from "effect"
import { MIPROv2Error } from "../../src/DspError.js"
import { Example } from "../../src/Example.js"
import {
  resolveOptions,
  toPhase1Options,
  toPhase2Options,
  toPhase3Options
} from "../../src/internal/miprov2/runtime/options.js"
import * as Sampling from "../../src/internal/miprov2/sampling.js"
import * as Metric from "../../src/Metric.js"
import * as MIPROv2 from "../../src/MIPROv2.js"
import * as Module from "../../src/Module.js"
import * as Signature from "../../src/Signature.js"

const rows = (count: number) =>
  Arr.makeBy(
    count,
    (index) => new Example({ input: { question: `row-${index}` }, labels: Option.some({ answer: "a" }) })
  )
const makeModule = Effect.gen(function*() {
  return yield* Module.predict(
    "qa",
    yield* Signature.make("baseline", { question: Schema.String }, { answer: Schema.String })
  )
})

it.effect("defaults match the pinned constructor and compile signatures", () =>
  Effect.gen(function*() {
    const options = new MIPROv2.Options({
      module: yield* makeModule,
      trainset: rows(5),
      metric: Metric.exactMatch("answer")
    })
    const resolved = yield* resolveOptions(options)
    const bootstrap = toPhase1Options(resolved)
    const proposer = toPhase2Options(resolved, [])
    const search = toPhase3Options(resolved, MIPROv2.noEvents, [], [])
    expect([resolved.numCandidates, resolved.numInstructions, resolved.numTrials]).toEqual([6, 3, 10])
    expect([resolved.trainset.length, resolved.valset.length, resolved.minibatch, resolved.zeroShot]).toEqual([
      1,
      4,
      false,
      false
    ])
    expect([bootstrap.seed, bootstrap.maxLabeledDemos, bootstrap.maxBootstrappedDemos]).toEqual([9, 4, 4])
    expect(bootstrap.metricThreshold).toEqual(Option.none())
    // dspy.settings.max_errors is 10 at the pinned DSPy 3.4.0; both phases inherit it.
    expect(bootstrap.maxErrors).toEqual(Option.some(10))
    expect(search.maxErrors).toEqual(Option.some(10))
    expect([proposer.initTemperature, proposer.viewDataBatchSize]).toEqual([1, 10])
    expect([
      proposer.programAwareProposer,
      proposer.dataAwareProposer,
      proposer.tipAwareProposer,
      proposer.fewshotAwareProposer
    ]).toEqual([true, true, true, true])
    expect([search.seed, search.minibatchSize, search.fullEvalEvery]).toEqual([9, 35, 5])
    expect(Option.fromUndefinedOr(search.numThreads)).toEqual(Option.none())
    expect(Option.fromUndefinedOr(search.provideTraceback)).toEqual(Option.none())
    const explicit = yield* resolveOptions(
      new MIPROv2.Options(
        Struct.assign(options, { auto: Option.none(), valset: rows(40), numCandidates: 3, numTrials: 12 })
      )
    )
    expect(toPhase3Options(explicit, MIPROv2.noEvents, [], []).minibatch).toBe(true)
  }))

it.effect("splits the training prefix from the validation suffix without an RNG draw, including the 1000 cap", () =>
  Effect.gen(function*() {
    const program = yield* makeModule
    yield* Effect.forEach(
      [{ count: 2, cutoff: 1 }, { count: 7, cutoff: 2 }, { count: 1251, cutoff: 251 }],
      ({ count, cutoff }) =>
        Effect.gen(function*() {
          const dataset = rows(count)
          const rng = yield* PseudoRandom.makeCPython(9)
          const before = yield* rng.snapshot
          const resolved = yield* resolveOptions(
            new MIPROv2.Options({
              module: program,
              trainset: dataset,
              metric: Metric.exactMatch("answer"),
              auto: Option.none(),
              numCandidates: 3,
              numTrials: 12,
              minibatch: false
            })
          ).pipe(Effect.provideService(Sampling.Current, Option.some(rng)))
          expect(resolved.trainset).toEqual(Arr.take(dataset, cutoff))
          expect(resolved.valset).toEqual(Arr.drop(dataset, cutoff))
          expect(yield* rng.snapshot).toEqual(before)
        })
    )
  }))

it.effect("auto overrides the minibatch flag exactly at the 50-row boundary", () =>
  Effect.gen(function*() {
    const program = yield* makeModule
    yield* Effect.forEach([50, 51], (count) =>
      Effect.gen(function*() {
        const resolved = yield* resolveOptions(
          new MIPROv2.Options({
            module: program,
            trainset: rows(2),
            valset: rows(count),
            metric: Metric.exactMatch("answer"),
            minibatch: count === 50
          })
        )
        expect(resolved.minibatch).toBe(count === 51)
      }))
  }))

it.effect("rejects missing explicit budgets, conflicting auto counts, and invalid datasets before model calls", () =>
  Effect.gen(function*() {
    const base = {
      module: yield* makeModule,
      trainset: rows(2),
      metric: Metric.exactMatch("answer")
    }
    yield* Effect.forEach([
      new MIPROv2.Options({ ...base, numCandidates: 3 }),
      new MIPROv2.Options({ ...base, numTrials: 12 }),
      new MIPROv2.Options({ ...base, auto: Option.none(), numCandidates: 3 }),
      new MIPROv2.Options({ ...base, auto: Option.none(), numTrials: 12 }),
      new MIPROv2.Options({ ...base, trainset: [] }),
      new MIPROv2.Options({ ...base, trainset: rows(1) }),
      new MIPROv2.Options({ ...base, valset: [] })
    ], (options) =>
      Effect.gen(function*() {
        expect(yield* resolveOptions(options).pipe(Effect.flip)).toBeInstanceOf(MIPROv2Error)
      }))
  }))
