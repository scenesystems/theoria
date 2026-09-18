/**
 * Golden-section search for one-dimensional minimization.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Iterable, MutableRef, Number } from "effect"

import * as Numeric from "../../Numeric.js"

const phi = Number.multiply(0.5, Number.subtract(Numeric.sqrt(5), 1))
const complement = Number.subtract(1, phi)
const defaultTolerance = 1e-12
const defaultMaxIterations = 100

const midpoint = (a: number, b: number): number => Number.multiply(0.5, Number.sum(a, b))

/**
 * Golden-section minimization kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const goldenSection = (
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number = defaultTolerance,
  maxIterations: number = defaultMaxIterations
): number => {
  const left = MutableRef.make(a)
  const right = MutableRef.make(b)
  const firstPoint = MutableRef.make(Number.sum(a, Number.multiply(complement, Number.subtract(b, a))))
  const secondPoint = MutableRef.make(Number.sum(a, Number.multiply(phi, Number.subtract(b, a))))
  const firstValue = MutableRef.make(f(MutableRef.get(firstPoint)))
  const secondValue = MutableRef.make(f(MutableRef.get(secondPoint)))
  const narrowLeft = () => {
    const nextRight = MutableRef.get(secondPoint)
    const nextFirstPoint = Number.sum(
      MutableRef.get(left),
      Number.multiply(complement, Number.subtract(nextRight, MutableRef.get(left)))
    )
    MutableRef.set(right, nextRight)
    MutableRef.set(secondPoint, MutableRef.get(firstPoint))
    MutableRef.set(secondValue, MutableRef.get(firstValue))
    MutableRef.set(firstPoint, nextFirstPoint)
    MutableRef.set(firstValue, f(nextFirstPoint))
  }
  const narrowRight = () => {
    const nextLeft = MutableRef.get(firstPoint)
    const nextSecondPoint = Number.sum(
      nextLeft,
      Number.multiply(phi, Number.subtract(MutableRef.get(right), nextLeft))
    )
    MutableRef.set(left, nextLeft)
    MutableRef.set(firstPoint, MutableRef.get(secondPoint))
    MutableRef.set(firstValue, MutableRef.get(secondValue))
    MutableRef.set(secondPoint, nextSecondPoint)
    MutableRef.set(secondValue, f(nextSecondPoint))
  }
  const narrow = { onTrue: narrowLeft, onFalse: narrowRight }
  const iterations = Iterable.takeWhile(
    Iterable.range(0),
    (iteration) =>
      Boolean.and(
        Boolean.not(Number.lessThan(
          Numeric.abs(Number.subtract(MutableRef.get(right), MutableRef.get(left))),
          tolerance
        )),
        Boolean.not(Number.greaterThanOrEqualTo(iteration, maxIterations))
      )
  )
  Iterable.forEach(iterations, () => {
    Boolean.match(Number.lessThan(MutableRef.get(firstValue), MutableRef.get(secondValue)), narrow)
  })
  return midpoint(MutableRef.get(left), MutableRef.get(right))
}
