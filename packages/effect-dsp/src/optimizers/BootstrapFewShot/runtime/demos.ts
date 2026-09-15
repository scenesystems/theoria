/**
 * BootstrapFewShot demo construction — builds demonstrations from labeled
 * examples and traces.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean, Data, Equal, Inspectable, Match, Number, Option, String } from "effect"
import type { Demo, Example } from "../../../Example/index.js"
import { DemoMerge } from "./model.js"

export const normalizeNonNegative = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

const stableFieldRecordEquals = (
  left: Demo["input"],
  right: Demo["input"]
): boolean => Equal.equals(Data.struct(left), Data.struct(right))

const stableDemoEquals = (left: Demo, right: Demo): boolean =>
  Boolean.match(stableFieldRecordEquals(left.input, right.input), {
    onFalse: () => false,
    onTrue: () => stableFieldRecordEquals(left.output, right.output)
  })

class MergeAcceptedDemosOptions extends Data.Class<{
  readonly existing: Iterable<Demo>
  readonly accepted: Iterable<Demo>
  readonly maxBootstrappedDemos: number
}> {}

export const mergeAcceptedDemos = (options: MergeAcceptedDemosOptions): DemoMerge =>
  Arr.reduce(
    options.accepted,
    new DemoMerge({ demos: Arr.take(options.existing, options.maxBootstrappedDemos), added: 0 }),
    (state, demo) =>
      Boolean.match(Number.greaterThanOrEqualTo(Arr.length(state.demos), options.maxBootstrappedDemos), {
        onTrue: () => state,
        onFalse: () =>
          Boolean.match(Arr.some(state.demos, (existing) => stableDemoEquals(existing, demo)), {
            onTrue: () => state,
            onFalse: () => new DemoMerge({ demos: Arr.append(state.demos, demo), added: Number.increment(state.added) })
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
