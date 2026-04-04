/**
 * Ensemble candidate selection — picks the best parameter set from evaluated
 * candidates.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option, Order } from "effect"
import type { Schema } from "effect"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "../../contracts/DeterministicSeed.js"
import type { Module as DspModule } from "../../Module/model.js"

type ProgramSample<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = Readonly<{
  readonly score: number
  readonly program: DspModule<I, O>
}>

type SamplingState<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> = Readonly<{
  readonly seed: number
  readonly samples: Array<ProgramSample<I, O>>
}>

/**
 * Clamp the requested subset size to `[1, programCount]`, returning `0` only
 * when no programs exist.
 *
 * @since 0.1.0
 * @category helpers
 */
export const resolveSelectionSize = (programCount: number, requested: Option.Option<number>): number =>
  Match.value(programCount).pipe(
    Match.when((count) => count <= 0, () => 0),
    Match.orElse((count) =>
      Option.match(requested, {
        onNone: () => count,
        onSome: (size) =>
          Match.value(size).pipe(
            Match.when((value) => value <= 0, () => 1),
            Match.when((value) => value >= count, () => count),
            Match.orElse((value) => value)
          )
      })
    )
  )

/**
 * Select a deterministic pseudo-random subset of `size` programs. Each program
 * is scored with a seeded hash and the lowest-scored entries are returned,
 * guaranteeing reproducible selection across runs.
 *
 * @since 0.1.0
 * @category constructors
 */
export const choosePrograms = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(options: {
  readonly programs: ReadonlyArray<DspModule<I, O>>
  readonly size: number
  readonly seed: number
}): ReadonlyArray<DspModule<I, O>> => {
  const initialState: SamplingState<I, O> = {
    seed: normalizeDeterministicSeed(options.seed),
    samples: Arr.empty<ProgramSample<I, O>>()
  }
  const scored = Arr.reduce(
    options.programs,
    initialState,
    (state, program) => {
      const next = nextDeterministicSeed(state.seed)

      return {
        seed: next,
        samples: Arr.append(state.samples, {
          score: next,
          program
        })
      }
    }
  ).samples

  return Arr.map(
    Arr.take(
      Arr.sort(scored, Order.mapInput(Order.number, (sample: ProgramSample<I, O>) => sample.score)),
      options.size
    ),
    (sample) => sample.program
  )
}
