/**
 * GEPA shared-stream parent choice and epoch-shuffled minibatches.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Boolean, Chunk, Effect, Number as Num, Option, Schema } from "effect"

import type { ParentSelectionWeights } from "./model.js"

/** CPython choice over the frequency-expanded, insertion-ordered parent catalog. @internal */
export const selectParent = (weights: ParentSelectionWeights, rng: PseudoRandom.CPython) =>
  rng.choice(Chunk.fromIterable(Arr.flatMap(weights, (entry) => Arr.replicate(entry.candidateIndex, entry.weight))))

/** Epoch-shuffle bookkeeping persisted with the orchestration RNG. @internal */
export class BatchState extends Schema.Class<BatchState>("@scenesystems/effect-dsp/internal/gepa/sampling/BatchState")({
  shuffled: Schema.Array(Schema.Int),
  frequencies: Schema.Array(Schema.Struct({ id: Schema.Int, count: Schema.Int })),
  epoch: Schema.Int,
  iteration: Schema.Int,
  calls: Schema.Int,
  trainsetSize: Schema.Int
}) {}

/** Parent selection must precede this shared-stream draw. Padding consumes no RNG. @internal */
export const nextMinibatch = (
  trainsetSize: number,
  size: number,
  iteration: number,
  state: BatchState,
  rng: PseudoRandom.CPython
) =>
  Effect.gen(function*() {
    const calls = Boolean.match(iteration === state.iteration, {
      onFalse: () => 0,
      onTrue: () => state.calls + 1
    })
    const base = iteration * size
    const epoch = Boolean.match(state.epoch === -1, {
      onFalse: () => Numeric.floor(base / Numeric.max(1, state.shuffled.length)),
      onTrue: () => 0
    })
    const refreshed = state.shuffled.length === 0 || state.trainsetSize !== trainsetSize || epoch > state.epoch
    const initial = yield* Boolean.match(refreshed, {
      onFalse: () => Effect.succeed(state.shuffled),
      onTrue: () =>
        rng.shuffle(Chunk.fromIterable(Arr.range(0, trainsetSize - 1))).pipe(
          Effect.map((shuffled) => Arr.fromIterable(shuffled))
        )
    })
    const padding = Boolean.match(refreshed, {
      onFalse: () => 0,
      onTrue: () => Num.remainder(size - Num.remainder(trainsetSize, size), size)
    })
    const padded = Arr.reduce(
      Boolean.match(padding > 0, { onFalse: () => Arr.empty<number>(), onTrue: () => Arr.range(1, padding) }),
      {
        shuffled: initial,
        frequencies: Boolean.match(refreshed, {
          onFalse: () => state.frequencies,
          onTrue: () => Arr.map(initial, (id) => ({ id, count: 1 }))
        })
      },
      (current) => {
        // Counter.most_common()[::-1][0]: least frequent, last inserted on ties.
        const selected = Arr.reduce(
          Arr.drop(current.frequencies, 1),
          Option.getOrThrow(Arr.head(current.frequencies)),
          (best, candidate) =>
            Boolean.match(candidate.count <= best.count, { onFalse: () => best, onTrue: () => candidate })
        )
        return {
          shuffled: Arr.append(current.shuffled, selected.id),
          frequencies: Arr.map(
            current.frequencies,
            (entry) => ({
              ...entry,
              count: entry.count + Boolean.match(entry.id === selected.id, { onFalse: () => 0, onTrue: () => 1 })
            })
          )
        }
      }
    )
    const start = Num.remainder(base + calls * size, padded.shuffled.length)
    return {
      batch: Arr.take(Arr.drop(padded.shuffled, start), size),
      state: new BatchState({ ...padded, epoch, iteration, calls, trainsetSize })
    }
  })
