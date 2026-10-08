import { expect, it } from "@effect/vitest"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Effect, Option, Record, Schema, Tuple } from "effect"
import { PredictorInstruction, ProgramCandidate } from "../../src/GEPA.js"
import { prepareMerge, selectMergeSubsample } from "../../src/internal/gepa/merge.js"
import { fixture } from "../kit/Fixtures.js"

const Instructions = Schema.Record(Schema.String, Schema.String)
const Reference = Schema.Struct({
  seed: Schema.Int,
  validationOrder: Schema.Array(Schema.Int),
  buckets: Schema.Array(Schema.Array(Schema.Int)),
  cases: Schema.Array(Schema.Struct({
    name: Schema.String,
    programs: Schema.Array(Instructions),
    parents: Schema.Array(Schema.Array(Schema.OptionFromNullOr(Schema.Int))),
    scores: Schema.Array(Schema.Finite),
    hasSupport: Schema.Boolean,
    merged: Schema.OptionFromNullOr(Schema.Tuple([Instructions, Schema.Int, Schema.Int, Schema.Int])),
    subsample: Schema.Array(Schema.Int),
    nextRandom: Schema.Finite
  }))
})

it.effect("common-ancestor eligibility, tied conflicts and balanced samples follow the shared upstream stream", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(
      (yield* fixture("gepa-merge", "upstream-kernel")).payload
    )
    const left = [0.9, 0.8, 0.7, 0.6, 0.2, 0.5, 0.5], right = [0.1, 0.2, 0.3, 0.4, 0.8, 0.5, 0.5]
    const ids = Arr.range(0, left.length - 1)
    expect(ids).toEqual(reference.validationOrder)
    expect([
      Arr.filter(ids, (i) => Option.getOrThrow(Arr.get(left, i)) > Option.getOrThrow(Arr.get(right, i))),
      Arr.filter(ids, (i) => Option.getOrThrow(Arr.get(right, i)) > Option.getOrThrow(Arr.get(left, i))),
      Arr.filter(ids, (i) => Option.getOrThrow(Arr.get(left, i)) === Option.getOrThrow(Arr.get(right, i)))
    ]).toEqual(reference.buckets)
    yield* Effect.forEach(reference.cases, (entry) =>
      Effect.gen(function*() {
        const rng = yield* PseudoRandom.makeCPython(reference.seed)
        const candidates = Arr.map(entry.programs, (instructions, index) =>
          new ProgramCandidate({
            candidateId: `candidate-${index}`,
            parentIds: Arr.map(
              Arr.getSomes(Option.getOrThrow(Arr.get(entry.parents, index))),
              (parent) => `candidate-${parent}`
            ),
            predictorInstructions: Arr.map(
              Record.toEntries(instructions),
              ([predictorName, instruction]) => new PredictorInstruction({ predictorName, instruction })
            )
          }))
        const proposal = yield* prepareMerge(candidates, entry.scores, [1, 2], [], [], entry.hasSupport, rng)
        expect(
          Option.map(proposal, (value) =>
            Tuple.make(
              Record.fromEntries(
                Arr.map(
                  value.candidate.predictorInstructions,
                  (instruction) => Tuple.make(instruction.predictorName, instruction.instruction)
                )
              ),
              value.parents[0],
              value.parents[1],
              value.ancestor
            )),
          entry.name
        ).toEqual(entry.merged)
        yield* Option.match(proposal, {
          onNone: () => Effect.void,
          onSome: () =>
            Effect.gen(function*() {
              const batch = yield* selectMergeSubsample(left, right, rng)
              expect(batch, entry.name).toEqual(entry.subsample)
            })
        })
        expect(yield* rng.random(), entry.name).toBe(entry.nextRandom)
        yield* Option.match(proposal, {
          onNone: () => Effect.void,
          onSome: ({ parents: [i, j], ancestor, description }) =>
            Effect.gen(function*() {
              expect(yield* prepareMerge(candidates, entry.scores, [1, 2], [[i, j, ancestor]], [], true, rng)).toEqual(
                Option.none()
              )
              yield* Effect.gen(function*() {
                expect(yield* prepareMerge(candidates, entry.scores, [1, 2], [], [[i, j, description]], true, rng))
                  .toEqual(
                    Option.none()
                  )
              }).pipe(Effect.when(Effect.succeed(entry.name === "complementary")))
            })
        })
      }))
  }))
