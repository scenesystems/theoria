/**
 * BootstrapFewShot demo construction — builds demonstrations from labeled
 * examples and traces.
 *
 * @since 0.0.0
 * @internal
 */
import { Array as Arr, Data, Equal, Match, Option } from "effect"
import type { Demo, Example } from "../../../Example/index.js"
import { DemoMerge } from "./model.js"

export const normalizeNonNegative = (value: number): number =>
  Match.value(value).pipe(
    Match.when((candidate) => candidate < 0, () => 0),
    Match.orElse((candidate) => candidate)
  )

const stableFieldRecordEquals = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>
): boolean => Equal.equals(Data.struct(left), Data.struct(right))

const stableDemoEquals = (left: Demo, right: Demo): boolean =>
  stableFieldRecordEquals(left.input, right.input) && stableFieldRecordEquals(left.output, right.output)

export const mergeAcceptedDemos = (options: {
  readonly existing: ReadonlyArray<Demo>
  readonly accepted: ReadonlyArray<Demo>
  readonly maxBootstrappedDemos: number
}): DemoMerge =>
  Arr.reduce(
    options.accepted,
    new DemoMerge({ demos: Arr.take(options.existing, options.maxBootstrappedDemos), added: 0 }),
    (state, demo) =>
      state.demos.length >= options.maxBootstrappedDemos ||
        Arr.some(state.demos, (existing) => stableDemoEquals(existing, demo))
        ? state
        : new DemoMerge({ demos: Arr.append(state.demos, demo), added: state.added + 1 })
  )

export const roundInstructions = (instructions: string, round: number): string =>
  `${instructions}\n\n[bootstrap-round:${round}]`

export const labeledTrainset = (
  trainset: ReadonlyArray<Example>,
  maxLabeledDemos: Option.Option<number>
): ReadonlyArray<Example> => {
  const labeled = Arr.filter(trainset, (example) => Option.isSome(Option.fromNullable(example.output)))
  const normalizedLimit = Option.filter(maxLabeledDemos, (limit) => normalizeNonNegative(limit) > 0)

  return Option.match(normalizedLimit, {
    onNone: () => labeled,
    onSome: (limit) => Arr.take(labeled, normalizeNonNegative(limit))
  })
}
