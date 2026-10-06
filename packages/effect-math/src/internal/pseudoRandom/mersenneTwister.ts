/** MT19937 pure transitions shared by CPython and NumPy legacy RandomState.
 * Approved native uint32 operations preserve the upstream algorithm bit-exactly.
 * @internal
 */
import { Array, Data, Number, Option } from "effect"

export class State extends Data.Class<{
  readonly words: ReadonlyArray<number>
  readonly index: number
}> {}

export class Draw<A> extends Data.Class<{ readonly value: A; readonly state: State }> {}

const at = (words: ReadonlyArray<number>, index: number) => Option.getOrThrow(Array.get(words, index))
const put = (words: ReadonlyArray<number>, index: number, value: number) =>
  Option.getOrThrow(Array.modify(words, index, () => value >>> 0))
const advance = (words: ReadonlyArray<number>, index: number) =>
  Number.Equivalence(index, 623)
    ? new State({ words: put(words, 0, at(words, 623)), index: 1 })
    : new State({ words, index: Number.increment(index) })

export const initGenrand = (seed: number): State =>
  new State({
    words: Array.reduce(Array.range(1, 623), put(Array.makeBy(624, () => 0), 0, seed), (words, i) => {
      const previous = at(words, Number.decrement(i))
      return put(words, i, Number.sum(Math.imul(1812433253, previous ^ (previous >>> 30)), i))
    }),
    index: 624
  })

export const initByArray = (key: ReadonlyArray<number>): State => {
  const mixed = Array.reduce(
    Array.makeBy(Number.max(624, key.length), (i) => i),
    new State({ words: initGenrand(19650218).words, index: 1 }),
    (state, step) => {
      const previous = at(state.words, Number.decrement(state.index))
      const j = Number.remainder(step, key.length)
      return advance(
        put(
          state.words,
          state.index,
          Number.sum(
            Number.sum(at(state.words, state.index) ^ Math.imul(previous ^ (previous >>> 30), 1664525), at(key, j)),
            j
          )
        ),
        state.index
      )
    }
  )
  const finished = Array.reduce(Array.makeBy(623, (i) => i), mixed, (state) => {
    const previous = at(state.words, Number.decrement(state.index))
    return advance(
      put(
        state.words,
        state.index,
        Number.subtract(at(state.words, state.index) ^ Math.imul(previous ^ (previous >>> 30), 1566083941), state.index)
      ),
      state.index
    )
  })
  return new State({ words: put(finished.words, 0, 0x80000000), index: 624 })
}

export const uint32 = (state: State): Draw<number> => {
  // Later twist positions intentionally read already-updated earlier positions.
  const words = Number.isLessThan(state.index, 624) ?
    state.words :
    Array.reduce(Array.makeBy(624, (i) => i), state.words, (words, i) => {
      const y = (at(words, i) & 0x80000000) | (at(words, Number.remainder(Number.increment(i), 624)) & 0x7fffffff)
      return put(
        words,
        i,
        at(words, Number.remainder(Number.sum(i, 397), 624)) ^ (y >>> 1) ^
          (Number.Equivalence(y & 1, 0) ? 0 : 0x9908b0df)
      )
    })
  const index = Number.isLessThan(state.index, 624) ? state.index : 0
  const a = at(words, index)
  const b = a ^ (a >>> 11)
  const c = b ^ ((b << 7) & 0x9d2c5680)
  const d = c ^ ((c << 15) & 0xefc60000)
  return new Draw({ value: (d ^ (d >>> 18)) >>> 0, state: new State({ words, index: Number.increment(index) }) })
}

/** CPython's 27+26-bit construction, not a single uint32 rescaling. */
export const random = (state: State): Draw<number> => {
  const a = uint32(state)
  const b = uint32(a.state)
  return new Draw({
    value: Number.divideUnsafe(Number.sum(Number.multiply(a.value >>> 5, 67108864), b.value >>> 6), 9007199254740992),
    state: b.state
  })
}

/** Most significant k bits of a fresh word, for 1 <= k <= 32. */
export const bits = (state: State, k: number): Draw<number> => {
  const word = uint32(state)
  return new Draw({ value: word.value >>> Number.subtract(32, k), state: word.state })
}
