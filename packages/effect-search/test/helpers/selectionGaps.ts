import { expect } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Number as Num, Option, Ref, Schema } from "effect"
import { SelectionObserver } from "../../src/internal/tpe/candidateSelection.js"

export const AcquisitionGap = Schema.Struct({
  trial: Schema.Int,
  dimensions: Schema.Array(Schema.String),
  gap: Schema.OptionFromNullOr(Schema.Finite),
  tie: Schema.OptionFromNullOr(Schema.Struct({
    classification: Schema.Literals(["identicalInputs", "coincidentalCancellation", "subUlp"]),
    winner: Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Finite])),
    other: Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Finite]))
  }))
})

const encode = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))

/** Observe the real sampler, including independent dimension calls and exact ties. */
export const withGapAssertions = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  expected: ReadonlyArray<typeof AcquisitionGap.Type>,
  strictThroughTrial = Number.POSITIVE_INFINITY
): Effect.Effect<A, E, R> =>
  Effect.gen(function*() {
    const count = yield* Ref.make(0)
    const result = yield* effect.pipe(Effect.provideService(SelectionObserver, (candidates, scores, bestIndex) =>
      Effect.gen(function*() {
        const index = yield* Ref.getAndUpdate(count, Num.increment)
        const reference = Option.getOrThrow(Arr.get(expected, index))
        yield* Bool.match(Num.isGreaterThan(reference.trial, strictThroughTrial), {
          onFalse: () =>
            Effect.sync(() => {
              const maximum = Option.getOrThrow(Arr.get(scores, bestIndex))
              const winner = encode(Option.getOrThrow(Arr.get(candidates, bestIndex)))
              const distinct = Arr.getSomes(Arr.map(candidates, (candidate, index) =>
                Bool.match(Equal.equals(encode(candidate), winner), {
                  onFalse: () => Arr.get(scores, index),
                  onTrue: () => Option.none()
                })))
              expect(bestIndex).toBe(Option.getOrThrow(Arr.findFirstIndex(scores, Equal.equals(maximum))))
              Option.match(reference.gap, {
                onNone: () => expect(distinct).toHaveLength(0),
                onSome: (gap) => {
                  expect(distinct.length).toBeGreaterThan(0)
                  const actual = Num.subtract(maximum, Arr.reduce(distinct, Number.NEGATIVE_INFINITY, Num.max))
                  Bool.match(Num.Equivalence(gap, 0), {
                    onFalse: () => expect(actual, `trial ${reference.trial}`).toBeGreaterThan(0),
                    onTrue: () => expect(actual, `trial ${reference.trial}`).toBe(0)
                  })
                }
              })
            }),
          onTrue: () => Effect.void
        })
      })))
    expect(yield* Ref.get(count)).toBe(expected.length)
    return result
  })
