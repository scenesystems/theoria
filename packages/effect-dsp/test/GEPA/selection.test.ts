import { expect, it } from "@effect/vitest"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Effect, Ref, Schema } from "effect"
import { deriveParetoKernelSnapshot } from "../../src/internal/gepa/frontier.js"
import { BatchState, nextMinibatch, selectParent } from "../../src/internal/gepa/sampling.js"
import { fixture } from "../kit/Fixtures.js"

const Reference = Schema.Struct({
  seed: Schema.Int,
  trainsetSize: Schema.Int,
  minibatchSize: Schema.Int,
  cases: Schema.Array(Schema.Struct({
    name: Schema.String,
    scores: Schema.Array(Schema.Array(Schema.Finite)),
    holdings: Schema.Array(Schema.Array(Schema.Int)),
    pruned: Schema.Array(Schema.Array(Schema.Int)),
    calls: Schema.Array(Schema.Struct({
      iteration: Schema.Int,
      parent: Schema.Int,
      batch: Schema.Array(Schema.Int),
      epoch: Schema.Int,
      shuffled: Schema.Array(Schema.Int)
    })),
    nextRandom: Schema.Finite
  }))
})

it.effect("coverage pruning retains an irredundant cover, not all nondominated vectors", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(
      (yield* fixture("gepa-selection-001", "upstream-kernel")).payload
    )
    Arr.forEach(reference.cases, (test) => {
      const snapshot = deriveParetoKernelSnapshot(test.scores)
      expect(Arr.map(snapshot.exampleHoldings, (holding) => holding.holders), test.name).toEqual(test.holdings)
      expect(
        Arr.map(snapshot.exampleHoldings, (holding) =>
          Arr.filter(holding.holders, (index) => Arr.contains(snapshot.frontierIndices, index))),
        test.name
      ).toEqual(test.pruned)
      const order = Arr.dedupe(Arr.flatten(test.pruned))
      expect(snapshot.parentWeights, test.name).toEqual(Arr.map(order, (candidateIndex) => ({
        candidateIndex,
        weight: Arr.filter(test.pruned, (holders) =>
          Arr.contains(holders, candidateIndex)).length
      })))
    })
  }))

it.effect("parent choice precedes epoch shuffle, including padding and resumed batch state", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(
      (yield* fixture("gepa-selection-001", "upstream-kernel")).payload
    )
    yield* Effect.forEach(reference.cases, (test) =>
      Effect.gen(function*() {
        const rng = yield* PseudoRandom.makeCPython(reference.seed)
        const state = yield* Ref.make(
          new BatchState({ shuffled: [], frequencies: [], epoch: -1, iteration: -1, calls: 0, trainsetSize: 0 })
        )
        const weights = deriveParetoKernelSnapshot(test.scores).parentWeights
        yield* Effect.forEach(test.calls, (call) =>
          Effect.gen(function*() {
            expect(yield* selectParent(weights, rng)).toBe(call.parent)
            const next = yield* nextMinibatch(
              reference.trainsetSize,
              reference.minibatchSize,
              call.iteration,
              yield* Ref.get(state),
              rng
            )
            expect(next.batch).toEqual(call.batch)
            expect(next.state.shuffled).toEqual(call.shuffled)
            expect(next.state.epoch).toBe(call.epoch)
            const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(BatchState))(next.state)
            yield* Ref.set(state, yield* Schema.decodeEffect(Schema.fromJsonString(BatchState))(encoded))
          }))
        expect(yield* rng.random()).toBe(test.nextRandom)
      }))
  }))
