/** NumPy legacy random_sample, uniform and weighted replacement choice. @internal */
import { Array, Number, Option } from "effect"
import * as MT from "./mersenneTwister.js"

export const uniform = (state: MT.State, low: number, high: number, size: number): MT.Draw<ReadonlyArray<number>> =>
  Array.reduce(
    Array.take(Array.makeBy(size, (i) => i), size),
    new MT.Draw<ReadonlyArray<number>>({ state, value: [] }),
    (draw) => {
      const next = MT.random(draw.state)
      return new MT.Draw({
        state: next.state,
        value: Array.append(draw.value, Number.sum(low, Number.multiply(Number.subtract(high, low), next.value)))
      })
    }
  )

export const kahanSum = (values: ReadonlyArray<number>) =>
  Array.reduce(values, { sum: 0, correction: 0 }, (acc, value) => {
    const y = Number.subtract(value, acc.correction)
    const sum = Number.sum(acc.sum, y)
    return { sum, correction: Number.subtract(Number.subtract(sum, acc.sum), y) }
  }).sum

export const choice = (state: MT.State, p: ReadonlyArray<number>, size: number): MT.Draw<ReadonlyArray<number>> => {
  // NumPy divides the ordinary cumulative sum by its last entry, not the Kahan sum.
  const cumulative = Array.drop(Array.scan(p, 0, Number.sum), 1)
  const total = Option.getOrThrow(Array.last(cumulative))
  const normalized = Array.map(cumulative, (value) => Number.divideUnsafe(value, total))
  const uniforms = uniform(state, 0, 1, size)
  return new MT.Draw({
    state: uniforms.state,
    value: Array.map(
      uniforms.value,
      (value) => Option.getOrThrow(Array.findFirstIndex(normalized, (edge) => Number.isGreaterThan(edge, value)))
    )
  })
}
