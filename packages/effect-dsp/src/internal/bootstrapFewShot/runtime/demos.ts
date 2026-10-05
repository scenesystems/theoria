/**
 * BootstrapFewShot demo construction — builds demonstrations from labeled
 * examples and traces.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean, Data, Effect, Inspectable, Match, Number, Option, String } from "effect"
import type { Codec as DemonstrationCodec, Demonstration as Demo } from "../../../Demonstration.js"
import type { Example } from "../../../Example.js"
import { DemoMerge } from "./model.js"

export const normalizeNonNegative = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

export class MergeAcceptedDemosOptions extends Data.Class<{
  readonly existing: Iterable<Demo>
  readonly accepted: Iterable<Demo>
  readonly maxBootstrappedDemos: number
  readonly contract: DemonstrationCodec
}> {}

export const mergeAcceptedDemos = (options: MergeAcceptedDemosOptions) =>
  Effect.reduce(
    options.accepted,
    () => new DemoMerge({ demos: Arr.take(options.existing, options.maxBootstrappedDemos), added: 0 }),
    (state, demo) =>
      Effect.suspend(() =>
        Boolean.match(Number.isGreaterThanOrEqualTo(Arr.length(state.demos), options.maxBootstrappedDemos), {
          onTrue: () => Effect.succeed(state),
          onFalse: () =>
            Effect.forEach(state.demos, (existing) => options.contract.equivalent(existing, demo)).pipe(
              Effect.flatMap((matches) =>
                Boolean.match(Arr.some(matches, (match) => match), {
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
              )
            )
        })
      )
  )

export const roundInstructions = (instructions: string, round: number): string =>
  String.concat(instructions, Arr.join(Arr.make("\n\n[bootstrap-round:", Inspectable.toStringUnknown(round), "]"), ""))

export const labeledTrainset = (
  trainset: Iterable<Example>,
  maxLabeledDemos: Option.Option<number>
) => {
  const labeled = Arr.filter(trainset, (example) => Option.isSome(example.labels))
  const normalizedLimit = Option.filter(
    maxLabeledDemos,
    (limit) => Number.isGreaterThan(normalizeNonNegative(limit), 0)
  )

  return Option.match(normalizedLimit, {
    onNone: () => labeled,
    onSome: (limit) => Arr.take(labeled, normalizeNonNegative(limit))
  })
}
