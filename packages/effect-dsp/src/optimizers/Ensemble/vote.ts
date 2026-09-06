/**
 * Ensemble output voting — deterministic majority vote across sub-module
 * predictions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Equal, Option } from "effect"
import type { Schema } from "effect"
import { AllTrialsFailed } from "../../Errors/optimizer.js"
import type { ProgramOutput } from "./model.js"

class VoteBucket<O extends Schema.Struct.Fields> extends Data.Class<{
  readonly output: ProgramOutput<O>
  readonly count: number
  readonly firstIndex: number
}> {}

const stableOutputEquals = <O extends Schema.Struct.Fields>(
  left: ProgramOutput<O>,
  right: ProgramOutput<O>
): boolean => Equal.equals(Data.struct(left), Data.struct(right))

const appendVote = <O extends Schema.Struct.Fields>(
  buckets: Array<VoteBucket<O>>,
  output: ProgramOutput<O>,
  index: number
): Array<VoteBucket<O>> =>
  Option.match(Arr.findFirst(buckets, (bucket) => stableOutputEquals(bucket.output, output)), {
    onNone: () =>
      Arr.append(buckets, {
        output,
        count: 1,
        firstIndex: index
      }),
    onSome: (winner) =>
      Arr.map(buckets, (bucket) =>
        stableOutputEquals(bucket.output, winner.output)
          ? {
            output: bucket.output,
            count: bucket.count + 1,
            firstIndex: bucket.firstIndex
          }
          : bucket)
  })

const winningVote = <O extends Schema.Struct.Fields>(
  buckets: Array<VoteBucket<O>>
): Option.Option<VoteBucket<O>> =>
  Arr.reduce(
    buckets,
    Option.none<VoteBucket<O>>(),
    (current, bucket) =>
      Option.match(current, {
        onNone: () => Option.some(bucket),
        onSome: (winner) =>
          bucket.count > winner.count ||
            (bucket.count === winner.count && bucket.firstIndex < winner.firstIndex)
            ? Option.some(bucket)
            : current
      })
  )

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
  outputs: ReadonlyArray<ProgramOutput<O>>
): Effect.Effect<ProgramOutput<O>, AllTrialsFailed> => {
  const indexedOutputs = Arr.map(outputs, (output, index) => ({ output, index }))
  const votes = Arr.reduce(
    indexedOutputs,
    Arr.empty<VoteBucket<O>>(),
    (buckets, entry) => appendVote(buckets, entry.output, entry.index)
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
