/** CPython integer seeds and sequence algorithms over pure MT19937 transitions. @internal */
import { Array, BigInt, Data, HashSet, Number, Option, Predicate, String, Tuple } from "effect"
import * as Numeric from "../../Numeric.js"
import * as MT from "./mersenneTwister.js"

const integer = (value: number) => Option.getOrThrow(BigInt.fromNumber(value))
const number = (value: bigint) => Option.getOrThrow(BigInt.toNumber(value))
const indices = (size: number) => Array.take(Array.makeBy(size, (i) => i), size)

export const seed = (value: number | bigint): MT.State => {
  const magnitude = BigInt.abs(Predicate.isBigInt(value) ? value : integer(value))
  const key = BigInt.Equivalence(magnitude, 0n) ?
    [0] :
    Array.unfold(magnitude, (remaining) =>
      BigInt.Equivalence(remaining, 0n) ? Option.none() : Option.some(Tuple.make(
        number(BigInt.remainder(remaining, 4294967296n)),
        BigInt.divideUnsafe(remaining, 4294967296n)
      )))
  return MT.initByArray(key)
}

export const getrandbits = (state: MT.State, k: number): MT.Draw<bigint> =>
  Array.reduce(indices(Numeric.ceil(Number.divideUnsafe(k, 32))), new MT.Draw({ value: 0n, state }), (draw, i) => {
    const bits = MT.bits(draw.state, Number.min(32, Number.subtract(k, Number.multiply(i, 32))))
    const place = BigInt.multiplyAll(Array.map(indices(i), () => 4294967296n))
    return new MT.Draw({
      value: BigInt.sum(draw.value, BigInt.multiply(integer(bits.value), place)),
      state: bits.state
    })
  })

export const randbelow = (state: MT.State, n: bigint): MT.Draw<bigint> => {
  const draw = getrandbits(state, String.length(n.toString(2)))
  return BigInt.isLessThan(draw.value, n) ? draw : randbelow(draw.state, n)
}

export const randint = (state: MT.State, a: number, b: number): MT.Draw<number> => {
  const draw = randbelow(state, BigInt.sum(BigInt.subtract(integer(b), integer(a)), 1n))
  return new MT.Draw({ state: draw.state, value: Number.sum(a, number(draw.value)) })
}

export const choice = <A>(state: MT.State, values: ReadonlyArray<A>): MT.Draw<A> => {
  const draw = randbelow(state, integer(values.length))
  return new MT.Draw({ state: draw.state, value: Option.getOrThrow(Array.get(values, number(draw.value))) })
}

export const shuffle = <A>(state: MT.State, values: ReadonlyArray<A>): MT.Draw<ReadonlyArray<A>> =>
  Array.reduce(
    Array.map(indices(Number.max(0, Number.decrement(values.length))), (i) =>
      Number.subtract(Number.decrement(values.length), i)),
    new MT.Draw<ReadonlyArray<A>>({ value: values, state }),
    (draw, i) => {
      const next = randint(draw.state, 0, i)
      const left = Option.getOrThrow(Array.get(draw.value, i))
      const right = Option.getOrThrow(Array.get(draw.value, next.value))
      const swapped = Option.getOrThrow(Array.modify(draw.value, i, () =>
        right))
      return new MT.Draw({ state: next.state, value: Option.getOrThrow(Array.modify(swapped, next.value, () => left)) })
    }
  )

class Sample<A> extends Data.Class<{
  readonly state: MT.State
  readonly pool: ReadonlyArray<A>
  readonly selected: HashSet.HashSet<number>
  readonly values: ReadonlyArray<A>
}> {}

const unique = (state: MT.State, n: number, selected: HashSet.HashSet<number>): MT.Draw<number> => {
  const draw = randint(state, 0, Number.decrement(n))
  return HashSet.has(selected, draw.value) ? unique(draw.state, n, selected) : draw
}

export const sample = <A>(state: MT.State, population: ReadonlyArray<A>, k: number): MT.Draw<ReadonlyArray<A>> => {
  const n = population.length
  const setsize = Number.sum(
    21,
    Number.isGreaterThan(k, 5)
      ? Numeric.pow(4, Numeric.ceil(Number.divideUnsafe(Numeric.log(Number.multiply(k, 3)), Numeric.log(4)))) :
      0
  )
  const pooled = Number.isLessThanOrEqualTo(n, setsize)
  const result = Array.reduce(
    indices(k),
    new Sample({ state, pool: population, selected: HashSet.empty<number>(), values: Array.empty<A>() }),
    (current, i) => {
      const last = Number.decrement(Number.subtract(n, i))
      const draw = pooled ? randint(current.state, 0, last) : unique(current.state, n, current.selected)
      const value = Option.getOrThrow(Array.get(current.pool, draw.value))
      return new Sample({
        state: draw.state,
        pool: pooled
          ? Option.getOrThrow(
            Array.modify(current.pool, draw.value, () => Option.getOrThrow(Array.get(current.pool, last)))
          )
          : current.pool,
        selected: pooled ? current.selected : HashSet.add(current.selected, draw.value),
        values: Array.append(current.values, value)
      })
    }
  )
  return new MT.Draw({ state: result.state, value: result.values })
}
