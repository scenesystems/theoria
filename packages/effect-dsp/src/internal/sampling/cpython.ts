/** CPython sequence sampling atop immutable MT19937 transitions.
 * Internal callers supply valid integer bounds, nonempty choices and 0 <= k <= n.
 * @internal
 */
import { Array as Arr, Data, Effect, HashSet, Option, Ref, Tuple } from "effect"
import * as MT from "./mersenneTwister.js"

export const randbelow = (state: MT.State, n: bigint): MT.Draw<bigint> => {
  const draw = MT.getrandbits(state, n.toString(2).length)
  return draw.value < n ? draw : randbelow(draw.state, n)
}

export const randint = (state: MT.State, a: number, b: number): MT.Draw<number> => {
  const draw = randbelow(state, BigInt(b) - BigInt(a) + 1n)
  return new MT.Draw({ state: draw.state, value: a + Number(draw.value) })
}

export const choice = <A>(state: MT.State, values: ReadonlyArray<A>): MT.Draw<A> => {
  const draw = randbelow(state, BigInt(values.length))
  return new MT.Draw({ state: draw.state, value: Option.getOrThrow(Arr.get(values, Number(draw.value))) })
}

export const shuffle = <A>(state: MT.State, values: ReadonlyArray<A>): MT.Draw<ReadonlyArray<A>> =>
  values.length < 2 ? new MT.Draw({ value: values, state }) : Arr.reduce(
    Arr.makeBy(Math.max(0, values.length - 1), (i) => values.length - 1 - i),
    new MT.Draw<ReadonlyArray<A>>({ value: values, state }),
    (draw, i) => {
      const next = randint(draw.state, 0, i)
      const left = Option.getOrThrow(Arr.get(draw.value, i))
      const right = Option.getOrThrow(Arr.get(draw.value, next.value))
      const swapped = Option.getOrThrow(Arr.modify(draw.value, i, () => right))
      return new MT.Draw({ state: next.state, value: Option.getOrThrow(Arr.modify(swapped, next.value, () => left)) })
    }
  )

class Sample<A> extends Data.Class<{
  readonly state: MT.State
  readonly pool: ReadonlyArray<A>
  readonly selected: HashSet.HashSet<number>
  readonly values: ReadonlyArray<A>
}> {}

const unique = (state: MT.State, n: number, selected: HashSet.HashSet<number>): MT.Draw<number> => {
  const draw = randint(state, 0, n - 1)
  return HashSet.has(selected, draw.value) ? unique(draw.state, n, selected) : draw
}

export const sample = <A>(state: MT.State, population: ReadonlyArray<A>, k: number): MT.Draw<ReadonlyArray<A>> => {
  if (k === 0) return new MT.Draw({ value: Arr.empty<A>(), state })
  const n = population.length
  const setsize = 21 + (k > 5 ? 4 ** Math.ceil(Math.log(k * 3) / Math.log(4)) : 0)
  const result = Arr.reduce(
    Arr.makeBy(k, (i) => i),
    new Sample({ state, pool: population, selected: HashSet.empty<number>(), values: Arr.empty<A>() }),
    (current, i) => {
      const draw = n <= setsize ? randint(current.state, 0, n - i - 1) : unique(current.state, n, current.selected)
      const value = Option.getOrThrow(Arr.get(current.pool, draw.value))
      return new Sample({
        state: draw.state,
        pool: n <= setsize
          ? Option.getOrThrow(
            Arr.modify(current.pool, draw.value, () => Option.getOrThrow(Arr.get(current.pool, n - i - 1)))
          )
          : current.pool,
        selected: n <= setsize ? current.selected : HashSet.add(current.selected, draw.value),
        values: Arr.append(current.values, value)
      })
    }
  )
  return new MT.Draw({ state: result.state, value: result.values })
}

/** Each instance holds one independent CPython stream; each operation is atomic. */
export class Sampling extends Data.Class<{ readonly state: Ref.Ref<MT.State> }> {
  private draw<A>(transition: (state: MT.State) => MT.Draw<A>): Effect.Effect<A> {
    return Ref.modify(this.state, (state) => {
      const draw = transition(state)
      return Tuple.make(draw.value, draw.state)
    })
  }
  random() {
    return this.draw(MT.random)
  }
  getrandbits(k: number) {
    return this.draw((state) => MT.getrandbits(state, k))
  }
  randbelow(n: bigint) {
    return this.draw((state) => randbelow(state, n))
  }
  randint(a: number, b: number) {
    return this.draw((state) => randint(state, a, b))
  }
  choice<A>(values: ReadonlyArray<A>) {
    return this.draw((state) => choice(state, values))
  }
  shuffle<A>(values: ReadonlyArray<A>) {
    return this.draw((state) => shuffle(state, values))
  }
  sample<A>(values: ReadonlyArray<A>, k: number) {
    return this.draw((state) => sample(state, values, k))
  }
}

export const make = (seed: number | bigint) =>
  Ref.make(MT.seed(BigInt(seed))).pipe(Effect.map((state) => new Sampling({ state })))
