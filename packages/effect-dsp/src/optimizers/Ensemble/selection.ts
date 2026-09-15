/**
 * Ensemble candidate selection — picks the best parameter set from evaluated
 * candidates.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Chunk, Data, Match, Number as Num, Option, Order } from "effect"
import type { Schema } from "effect"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "../../contracts/DeterministicSeed.js"
import type { Module as DspModule } from "../../Module/model.js"
import type { EnsembleOptions } from "./model.js"

class ProgramSample<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R> extends Data.Class<{
  readonly score: number
  readonly program: DspModule<I, O, E, R>
}> {}

class SamplingState<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R> extends Data.Class<{
  readonly seed: number
  readonly samples: Chunk.Chunk<ProgramSample<I, O, E, R>>
}> {}

/** @internal */
export class ChooseProgramsOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>
  extends Data.Class<{
    readonly programs: EnsembleOptions<I, O, E, R>["programs"]
    readonly size: number
    readonly seed: number
  }>
{}

/**
 * Clamp the requested subset size to `[1, programCount]`, returning `0` only
 * when no programs exist.
 *
 * @since 0.1.0
 * @category helpers
 */
export const resolveSelectionSize = (programCount: number, requested: Option.Option<number>): number =>
  Match.value(programCount).pipe(
    Match.when((count) => Num.lessThanOrEqualTo(count, 0), () => 0),
    Match.orElse((count) =>
      Option.match(requested, {
        onNone: () => count,
        onSome: (size) =>
          Match.value(size).pipe(
            Match.when((value) => Bool.not(Numeric.isFinite(value)), () => 1),
            Match.orElse((value) => Num.clamp(Numeric.floor(value), { minimum: 1, maximum: count }))
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
export const choosePrograms = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  options: ChooseProgramsOptions<I, O, E, R>
) => {
  const initialState = new SamplingState<I, O, E, R>({
    seed: normalizeDeterministicSeed(options.seed),
    samples: Chunk.empty<ProgramSample<I, O, E, R>>()
  })
  const scored = Arr.reduce(
    options.programs,
    initialState,
    (state, program) => {
      const next = nextDeterministicSeed(state.seed)

      return new SamplingState<I, O, E, R>({
        seed: next,
        samples: Chunk.append(
          state.samples,
          new ProgramSample<I, O, E, R>({
            score: next,
            program
          })
        )
      })
    }
  ).samples

  return Arr.map(
    Arr.take(
      Arr.sort(
        Arr.fromIterable(scored),
        Order.mapInput(Num.Order, (sample: ProgramSample<I, O, E, R>) => sample.score)
      ),
      options.size
    ),
    (sample) => sample.program
  )
}
