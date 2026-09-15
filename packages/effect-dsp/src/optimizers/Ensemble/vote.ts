/**
 * Ensemble output voting — deterministic majority vote across sub-module
 * predictions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Chunk, Data, Effect, Number as Num, Option, Order, Schema } from "effect"
import type { Equivalence } from "effect"
import { AllTrialsFailed } from "../../Errors/optimizer.js"
import type { ProgramOutput } from "./model.js"

class VoteBucket<O extends Schema.Struct.Fields> extends Data.Class<{
  readonly output: ProgramOutput<O>
  readonly count: number
  readonly firstIndex: number
}> {}

const appendVote = <O extends Schema.Struct.Fields>(
  buckets: Chunk.Chunk<VoteBucket<O>>,
  output: ProgramOutput<O>,
  index: number,
  equivalent: Equivalence.Equivalence<ProgramOutput<O>>
): Chunk.Chunk<VoteBucket<O>> =>
  Option.match(Chunk.findFirst(buckets, (bucket) => equivalent(bucket.output, output)), {
    onNone: () => Chunk.append(buckets, new VoteBucket({ output, count: 1, firstIndex: index })),
    onSome: (winner) =>
      Chunk.map(buckets, (bucket) =>
        Bool.match(equivalent(bucket.output, winner.output), {
          onFalse: () => bucket,
          onTrue: () =>
            new VoteBucket({
              output: bucket.output,
              count: Num.increment(bucket.count),
              firstIndex: bucket.firstIndex
            })
        }))
  })

const voteOrder = <O extends Schema.Struct.Fields>(): Order.Order<VoteBucket<O>> =>
  Order.combine(
    Order.mapInput(Num.Order, (bucket: VoteBucket<O>) => bucket.count),
    Order.reverse(Order.mapInput(Num.Order, (bucket: VoteBucket<O>) => bucket.firstIndex))
  )

const winningVote = <O extends Schema.Struct.Fields>(
  buckets: Chunk.Chunk<VoteBucket<O>>
): Option.Option<VoteBucket<O>> =>
  Arr.match(Chunk.toReadonlyArray(buckets), {
    onEmpty: Option.none,
    onNonEmpty: (nonEmptyBuckets) => Option.some(Arr.max(nonEmptyBuckets, voteOrder<O>()))
  })

/**
 * Selects the most frequent complete output value.
 *
 * @remarks
 * Structural equality groups outputs with equal field values regardless of
 * object identity. Fields are not voted independently. A tie returns the output
 * whose first occurrence has the lowest array index. An empty array fails with
 * `AllTrialsFailed`.
 *
 * @typeParam O - Field schemas represented by each decoded output.
 * @param outputs - Candidate values in tie-break order.
 * @returns One of the original output objects without copying it.
 *
 * @since 0.1.0
 * @category constructors
 */
export const majorityVote = <O extends Schema.Struct.Fields>(
  outputs: Schema.Array$<Schema.Struct<O>>["Type"],
  schema: Schema.Struct<O>
): Effect.Effect<ProgramOutput<O>, AllTrialsFailed> => {
  const indexedOutputs = Arr.map(outputs, (output, index) => Data.tuple(output, index))
  const equivalent = Schema.equivalence(schema)
  const votes = Arr.reduce(
    indexedOutputs,
    Chunk.empty<VoteBucket<O>>(),
    (buckets, [output, index]) => appendVote(buckets, output, index, equivalent)
  )

  return Option.match(winningVote(votes), {
    onNone: () =>
      Effect.fail(
        new AllTrialsFailed({
          message: "Optimizer.ensemble requires at least one output",
          trialCount: 0
        })
      ),
    onSome: (winner) => Effect.succeed(winner.output)
  })
}
