/** CPython integer-seeded MT19937. Pure transitions; uint32 arithmetic is intentional.
 * Algorithm reference: CPython Modules/_randommodule.c (Python 3.12).
 * @internal
 */
import { Array as Arr, Data, Option, Tuple } from "effect"

export class State extends Data.Class<{
  readonly words: ReadonlyArray<number>
  readonly index: number
}> {}

export class Draw<A> extends Data.Class<{ readonly value: A; readonly state: State }> {}

const at = (words: ReadonlyArray<number>, index: number) => Option.getOrThrow(Arr.get(words, index))
const put = (words: ReadonlyArray<number>, index: number, value: number) =>
  Option.getOrThrow(Arr.modify(words, index, () => value >>> 0))
const advance = (words: ReadonlyArray<number>, index: number) =>
  index === 623
    ? new State({ words: put(words, 0, at(words, 623)), index: 1 })
    : new State({ words, index: index + 1 })

/** Absolute integer magnitude, little-endian 32-bit key chunks; zero has key [0]. */
export const seed = (value: bigint): State => {
  const magnitude = value < 0n ? -value : value
  const key = magnitude === 0n ? [0] : Arr.unfold(magnitude, (remaining) =>
    remaining === 0n
      ? Option.none()
      : Option.some(Tuple.make(Number(remaining & 0xffffffffn), remaining >> 32n)))
  const initialized = Arr.reduce(Arr.range(1, 623), put(Arr.makeBy(624, () => 0), 0, 19650218), (words, i) => {
    const previous = at(words, i - 1)
    return put(words, i, Math.imul(1812433253, previous ^ (previous >>> 30)) + i)
  })
  const mixed = Arr.reduce(
    Arr.makeBy(Math.max(624, key.length), (i) => i),
    new State({ words: initialized, index: 1 }),
    (state, step) => {
      const previous = at(state.words, state.index - 1)
      const j = step % key.length
      return advance(
        put(
          state.words,
          state.index,
          (at(state.words, state.index) ^ Math.imul(previous ^ (previous >>> 30), 1664525)) + at(key, j) + j
        ),
        state.index
      )
    }
  )
  const finished = Arr.reduce(Arr.makeBy(623, (i) => i), mixed, (state) => {
    const previous = at(state.words, state.index - 1)
    return advance(
      put(
        state.words,
        state.index,
        (at(state.words, state.index) ^ Math.imul(previous ^ (previous >>> 30), 1566083941)) - state.index
      ),
      state.index
    )
  })
  return new State({ words: put(finished.words, 0, 0x80000000), index: 624 })
}

export const uint32 = (state: State): Draw<number> => {
  // Later twist positions intentionally read already-updated earlier positions.
  const words = state.index < 624 ? state.words : Arr.reduce(Arr.makeBy(624, (i) => i), state.words, (words, i) => {
    const y = (at(words, i) & 0x80000000) | (at(words, (i + 1) % 624) & 0x7fffffff)
    return put(words, i, at(words, (i + 397) % 624) ^ (y >>> 1) ^ ((y & 1) === 0 ? 0 : 0x9908b0df))
  })
  const index = state.index < 624 ? state.index : 0
  const a = at(words, index)
  const b = a ^ (a >>> 11)
  const c = b ^ ((b << 7) & 0x9d2c5680)
  const d = c ^ ((c << 15) & 0xefc60000)
  return new Draw({ value: (d ^ (d >>> 18)) >>> 0, state: new State({ words, index: index + 1 }) })
}

/** CPython's 27+26-bit construction, not a single uint32 rescaling. */
export const random = (state: State): Draw<number> => {
  const a = uint32(state)
  const b = uint32(a.state)
  return new Draw({ value: ((a.value >>> 5) * 67108864 + (b.value >>> 6)) / 9007199254740992, state: b.state })
}

/** Requires a nonnegative integer bit count. First word is least significant. */
export const getrandbits = (state: State, k: number): Draw<bigint> =>
  k === 0 ?
    new Draw({ value: 0n, state }) :
    Arr.reduce(Arr.makeBy(Math.ceil(k / 32), (i) => i), new Draw({ value: 0n, state }), (draw, i) => {
      const word = uint32(draw.state)
      const bits = Math.min(32, k - i * 32)
      return new Draw({ value: draw.value | (BigInt(word.value >>> (32 - bits)) << BigInt(i * 32)), state: word.state })
    })
