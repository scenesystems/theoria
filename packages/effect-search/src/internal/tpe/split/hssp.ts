/**
 * Greedy hypervolume subset selection following Optuna's `_hypervolume.hssp`: unique lexsorted
 * candidates, an O(k·n) 2-D sweep, and lazily bounded contribution updates in higher dimensions.
 *
 * @since 0.9.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Equal, HashSet, Number as Num, Order } from "effect"

import type { Vector } from "../../../Objective.js"
import {
  coordinate,
  generate,
  hypervolume,
  inclusiveVolume,
  intersection,
  replaceAt,
  rowAt,
  uniqueRows
} from "./hypervolume.js"

/** First index of the maximum, as `np.argmax` selects it. */
const argmax = (values: ReadonlyArray<number>): number =>
  Arr.reduce(values, 0, (best, value, index) =>
    Bool.match(Num.isGreaterThan(value, rowAt(values, best)), {
      onFalse: () => best,
      onTrue: () => index
    }))

const without = <A>(values: ReadonlyArray<A>, removed: number): Array<A> =>
  Arr.filter(values, (_value, index) => Bool.not(Equal.equals(index, removed)))

class SweepEntry extends Data.Class<{
  readonly position: number
  readonly loss: Vector
  readonly diagonal: Vector
}> {}

class SweepState extends Data.Class<{
  readonly entries: ReadonlyArray<SweepEntry>
  readonly selected: ReadonlyArray<number>
}> {}

/** `_solve_hssp_2d`: contributions are rectangles bounded by each neighbour's selected corner. */
const solve2d = (
  values: ReadonlyArray<Vector>,
  positions: ReadonlyArray<number>,
  subsetSize: number,
  reference: Vector
): ReadonlyArray<number> =>
  Arr.reduce(
    generate(subsetSize, (step) => step),
    new SweepState({
      entries: Arr.map(values, (loss, index) =>
        new SweepEntry({ position: rowAt(positions, index), loss, diagonal: reference })),
      selected: Arr.empty()
    }),
    (state) => {
      const contributions = Arr.map(state.entries, (entry) =>
        Num.multiply(
          Num.subtract(coordinate(entry.diagonal, 0), coordinate(entry.loss, 0)),
          Num.subtract(coordinate(entry.diagonal, 1), coordinate(entry.loss, 1))
        ))
      const chosen = argmax(contributions)
      const best = rowAt(state.entries, chosen)
      return new SweepState({
        entries: Arr.map(without(state.entries, chosen), (entry, index) =>
          new SweepEntry({
            position: entry.position,
            loss: entry.loss,
            diagonal: Bool.match(Num.isLessThan(index, chosen), {
              onFalse: () =>
                Arr.make(
                  coordinate(entry.diagonal, 0),
                  Num.min(coordinate(best.loss, 1), coordinate(entry.diagonal, 1))
                ),
              onTrue: () =>
                Arr.make(
                  Num.min(coordinate(best.loss, 0), coordinate(entry.diagonal, 0)),
                  coordinate(entry.diagonal, 1)
                )
            })
          })),
        selected: Arr.append(state.selected, best.position)
      })
    }
  ).selected

/**
 * `_lazy_contribs_update`: by submodularity, `H({latest} ∪ {j}) - H({latest})` and the previous
 * contribution both bound the next one, so candidates whose bound falls below the best exact
 * contribution found so far keep the bound and skip exact evaluation.
 */
const lazyContributions = (
  bounds: ReadonlyArray<number>,
  candidates: ReadonlyArray<Vector>,
  selected: ReadonlyArray<Vector>,
  latest: Vector,
  reference: Vector,
  selectedVolume: number
): ReadonlyArray<number> =>
  Bool.match(isFinite(selectedVolume), {
    onFalse: () => Arr.map(bounds, () => Number.POSITIVE_INFINITY),
    onTrue: () => {
      const inclusive = Arr.map(candidates, (candidate) => inclusiveVolume(candidate, reference))
      const tightened = Arr.map(bounds, (bound, index) =>
        Num.min(
          bound,
          Num.subtract(
            rowAt(inclusive, index),
            inclusiveVolume(intersection(rowAt(candidates, index), latest), reference)
          )
        ))
      const incremental = Num.isLessThanOrEqualTo(Arr.length(reference), 3)
      const visitOrder = Arr.sort(
        generate(Arr.length(candidates), (index) => index),
        Order.flip(Order.mapInput(Num.Order, (index: number) => rowAt(tightened, index)))
      )
      const exact = (index: number): number =>
        Bool.match(incremental, {
          onFalse: () =>
            Num.subtract(
              rowAt(inclusive, index),
              hypervolume(Arr.map(selected, (vector) => intersection(rowAt(candidates, index), vector)), reference)
            ),
          onTrue: () =>
            Num.subtract(hypervolume(Arr.append(selected, rowAt(candidates, index)), reference, true), selectedVolume)
        })
      return Arr.reduce(visitOrder, { maximum: 0, values: tightened }, (state, index) =>
        Bool.match(isFinite(rowAt(inclusive, index)), {
          onFalse: () => ({
            maximum: Number.POSITIVE_INFINITY,
            values: replaceAt(state.values, index, Number.POSITIVE_INFINITY)
          }),
          onTrue: () =>
            Bool.match(Num.isLessThan(rowAt(state.values, index), state.maximum), {
              onFalse: () => {
                const contribution = exact(index)
                return {
                  maximum: Num.max(contribution, state.maximum),
                  values: replaceAt(state.values, index, contribution)
                }
              },
              onTrue: () =>
                state
            })
        })).values
    }
  })

class LazyState extends Data.Class<{
  readonly bounds: ReadonlyArray<number>
  readonly candidates: ReadonlyArray<Vector>
  readonly positions: ReadonlyArray<number>
  readonly selected: ReadonlyArray<number>
  readonly selectedVectors: ReadonlyArray<Vector>
  readonly volume: number
}> {}

const solveLazy = (
  values: ReadonlyArray<Vector>,
  positions: ReadonlyArray<number>,
  subsetSize: number,
  reference: Vector
): ReadonlyArray<number> =>
  Arr.reduce(
    generate(subsetSize, (step) => step),
    new LazyState({
      bounds: Arr.map(values, (value) => inclusiveVolume(value, reference)),
      candidates: values,
      positions,
      selected: Arr.empty(),
      selectedVectors: Arr.empty(),
      volume: 0
    }),
    (state, step) => {
      const chosen = argmax(state.bounds)
      const volume = Num.sum(state.volume, rowAt(state.bounds, chosen))
      const latest = rowAt(state.candidates, chosen)
      const selectedVectors = Arr.append(state.selectedVectors, latest)
      const candidates = without(state.candidates, chosen)
      const bounds = without(state.bounds, chosen)
      return new LazyState({
        bounds: Bool.match(Equal.equals(step, Num.decrement(subsetSize)), {
          onFalse: () => lazyContributions(bounds, candidates, selectedVectors, latest, reference, volume),
          onTrue: () => bounds
        }),
        candidates,
        positions: without(state.positions, chosen),
        selected: Arr.append(state.selected, rowAt(state.positions, chosen)),
        selectedVectors,
        volume
      })
    }
  ).selected

const solveUnique = (
  values: ReadonlyArray<Vector>,
  positions: ReadonlyArray<number>,
  subsetSize: number,
  reference: Vector
): ReadonlyArray<number> =>
  Bool.match(Arr.every(reference, isFinite), {
    onFalse: () => Arr.take(positions, subsetSize),
    onTrue: () =>
      Bool.match(Equal.equals(Arr.length(positions), subsetSize), {
        onFalse: () =>
          Bool.match(Equal.equals(Arr.length(reference), 2), {
            onFalse: () => solveLazy(values, positions, subsetSize, reference),
            onTrue: () => solve2d(values, positions, subsetSize, reference)
          }),
        onTrue: () => positions
      })
  })

/**
 * Selects `subsetSize` of the loss vectors (`_solve_hssp`), returning positions into `losses`.
 * Ties resolve in lexicographic order of unique loss vectors; when fewer unique vectors exist than
 * requested, every first occurrence is kept and the earliest duplicates fill the remainder.
 */
export const hypervolumeSubset = (
  losses: ReadonlyArray<Vector>,
  reference: Vector,
  subsetSize: number
): ReadonlyArray<number> =>
  Bool.match(Equal.equals(subsetSize, Arr.length(losses)), {
    onFalse: () => {
      const unique = uniqueRows(losses)
      return Bool.match(Num.isLessThan(Arr.length(unique.first), subsetSize), {
        onFalse: () => solveUnique(unique.values, unique.first, subsetSize, reference),
        onTrue: () => {
          const firsts = HashSet.fromIterable(unique.first)
          const duplicates = Arr.filter(
            generate(Arr.length(losses), (index) => index),
            (index) => Bool.not(HashSet.has(firsts, index))
          )
          const filled = HashSet.union(
            firsts,
            HashSet.fromIterable(Arr.take(duplicates, Num.subtract(subsetSize, Arr.length(unique.first))))
          )
          return Arr.filter(generate(Arr.length(losses), (index) => index), (index) => HashSet.has(filled, index))
        }
      })
    },
    onTrue: () => generate(Arr.length(losses), (index) => index)
  })
