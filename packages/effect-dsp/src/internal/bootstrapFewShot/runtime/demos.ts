/**
 * BootstrapFewShot demo construction — builds demonstrations from labeled
 * examples and traces.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Effect, Inspectable, Match, Number, Option, String } from "effect"
import type { Codec as DemonstrationCodec, Demonstration as Demo } from "../../../Demonstration.js"
import type { Example } from "../../../Example.js"
import { DemoMerge } from "./model.js"

export const normalizeNonNegative = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

class MergeAcceptedDemosOptions extends Data.Class<{
  readonly existing: Iterable<Demo>
  readonly accepted: Iterable<Demo>
  readonly maxBootstrappedDemos: number
  readonly contract: DemonstrationCodec
}> {}

export const mergeAcceptedDemos = (options: MergeAcceptedDemosOptions) =>
  Effect.reduce(
    options.accepted,
    new DemoMerge({ demos: Arr.take(options.existing, options.maxBootstrappedDemos), added: 0 }),
    (state, demo) =>
      Effect.if(Number.greaterThanOrEqualTo(Arr.length(state.demos), options.maxBootstrappedDemos), {
        onTrue: () => Effect.succeed(state),
        onFalse: () =>
          Effect.if(Effect.exists(state.demos, (existing) => options.contract.equivalent(existing, demo)), {
            onTrue: () => Effect.succeed(state),
            onFalse: () =>
              options.contract.decode(demo).pipe(
                Effect.map((validated) =>
                  new DemoMerge({
                    demos: Arr.append(state.demos, validated),
                    added: Number.increment(state.added)
                  })
                )
              )
          })
      })
  )

export const roundInstructions = (instructions: string, round: number): string =>
  String.concat(instructions, Arr.join(Arr.make("\n\n[bootstrap-round:", Inspectable.toStringUnknown(round), "]"), ""))

export const labeledTrainset = (
  trainset: Iterable<Example>,
  maxLabeledDemos: Option.Option<number>
) => {
  const labeled = Arr.filter(trainset, (example) => Option.isSome(Option.fromNullable(example.output)))
  const normalizedLimit = Option.filter(maxLabeledDemos, (limit) => Number.greaterThan(normalizeNonNegative(limit), 0))

  return Option.match(normalizedLimit, {
    onNone: () => labeled,
    onSome: (limit) => Arr.take(labeled, normalizeNonNegative(limit))
  })
}
