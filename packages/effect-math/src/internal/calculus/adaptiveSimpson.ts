/**
 * Adaptive Simpson quadrature over continuous scalar functions.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Iterable, MutableList, MutableRef, Number, Option } from "effect"

import * as Numeric from "../../Numeric.js"

const defaultAbsoluteTolerance = 1e-10
const defaultRelativeTolerance = 1e-10
const defaultMaxDepth = 16

const midpoint = (a: number, b: number): number => Number.unsafeDivide(Number.sum(a, b), 2)

const segment = (
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number
): number =>
  Number.multiply(
    Number.unsafeDivide(Number.subtract(b, a), 6),
    Number.sum(Number.sum(fa, Number.multiply(4, fm)), fb)
  )

const localTolerance = (
  estimate: number,
  absoluteTolerance: number,
  relativeTolerance: number
): number => Number.max(absoluteTolerance, Number.multiply(relativeTolerance, Numeric.abs(estimate)))

class SimpsonFrame extends Data.Class<{
  readonly a: number
  readonly b: number
  readonly fa: number
  readonly fm: number
  readonly fb: number
  readonly whole: number
  readonly absoluteTolerance: number
  readonly relativeTolerance: number
  readonly depth: number
}> {}

const refine = (
  f: (x: number) => number,
  pending: MutableList.MutableList<SimpsonFrame>,
  total: MutableRef.MutableRef<number>
) => {
  return Option.match(Option.fromNullable(MutableList.shift(pending)), {
    onNone: () => total,
    onSome: (frame) => {
      const m = midpoint(frame.a, frame.b)
      const leftMid = midpoint(frame.a, m)
      const rightMid = midpoint(m, frame.b)
      const fLeftMid = f(leftMid)
      const fRightMid = f(rightMid)
      const left = segment(frame.a, m, frame.fa, fLeftMid, frame.fm)
      const right = segment(m, frame.b, frame.fm, fRightMid, frame.fb)
      const combined = Number.sum(left, right)
      const correction = Number.subtract(combined, frame.whole)
      const tolerance = localTolerance(combined, frame.absoluteTolerance, frame.relativeTolerance)
      const converged = Number.lessThanOrEqualTo(Numeric.abs(correction), Number.multiply(15, tolerance))
      const complete = Boolean.or(Number.lessThanOrEqualTo(frame.depth, 0), converged)

      return Boolean.match(complete, {
        onTrue: () =>
          MutableRef.set(
            total,
            Number.sum(MutableRef.get(total), Number.sum(combined, Number.unsafeDivide(correction, 15)))
          ),
        onFalse: () => {
          const nextAbsolute = Number.unsafeDivide(frame.absoluteTolerance, 2)
          const nextRelative = Number.unsafeDivide(frame.relativeTolerance, 2)
          const nextDepth = Number.decrement(frame.depth)
          MutableList.prepend(
            pending,
            new SimpsonFrame({
              a: m,
              b: frame.b,
              fa: frame.fm,
              fm: fRightMid,
              fb: frame.fb,
              whole: right,
              absoluteTolerance: nextAbsolute,
              relativeTolerance: nextRelative,
              depth: nextDepth
            })
          )
          return MutableList.prepend(
            pending,
            new SimpsonFrame({
              a: frame.a,
              b: m,
              fa: frame.fa,
              fm: fLeftMid,
              fb: frame.fm,
              whole: left,
              absoluteTolerance: nextAbsolute,
              relativeTolerance: nextRelative,
              depth: nextDepth
            })
          )
        }
      })
    }
  })
}

/**
 * Adaptive Simpson quadrature with independent absolute and relative tolerances.
 *
 * @since 0.1.0
 * @category internal
 */
export const adaptiveSimpsonIntegral = (
  f: (x: number) => number,
  a: number,
  b: number,
  absoluteTolerance: number = defaultAbsoluteTolerance,
  relativeTolerance: number = defaultRelativeTolerance,
  maxDepth: number = defaultMaxDepth
): number => {
  const normalizedDepth = Boolean.match(Numeric.isFinite(maxDepth), {
    onTrue: () => Number.max(0, maxDepth),
    onFalse: () => defaultMaxDepth
  })

  const m = midpoint(a, b)
  const fa = f(a)
  const fm = f(m)
  const fb = f(b)
  const whole = segment(a, b, fa, fm, fb)
  const normalizedAbsoluteTolerance = Number.max(absoluteTolerance, 5e-324)
  const normalizedRelativeTolerance = Number.max(relativeTolerance, 5e-324)
  const leftMid = midpoint(a, m)
  const rightMid = midpoint(m, b)
  const fLeftMid = f(leftMid)
  const fRightMid = f(rightMid)
  const left = segment(a, m, fa, fLeftMid, fm)
  const right = segment(m, b, fm, fRightMid, fb)
  const combined = Number.sum(left, right)
  const correction = Number.subtract(combined, whole)
  const tolerance = localTolerance(combined, normalizedAbsoluteTolerance, normalizedRelativeTolerance)
  const converged = Number.lessThanOrEqualTo(Numeric.abs(correction), Number.multiply(15, tolerance))
  const complete = Boolean.or(Number.lessThanOrEqualTo(normalizedDepth, 0), converged)

  return Boolean.match(complete, {
    onTrue: () => Number.sum(combined, Number.unsafeDivide(correction, 15)),
    onFalse: () => {
      const nextAbsolute = Number.unsafeDivide(normalizedAbsoluteTolerance, 2)
      const nextRelative = Number.unsafeDivide(normalizedRelativeTolerance, 2)
      const nextDepth = Number.decrement(normalizedDepth)
      const pending = MutableList.make(
        new SimpsonFrame({
          a,
          b: m,
          fa,
          fm: fLeftMid,
          fb: fm,
          whole: left,
          absoluteTolerance: nextAbsolute,
          relativeTolerance: nextRelative,
          depth: nextDepth
        }),
        new SimpsonFrame({
          a: m,
          b,
          fa: fm,
          fm: fRightMid,
          fb,
          whole: right,
          absoluteTolerance: nextAbsolute,
          relativeTolerance: nextRelative,
          depth: nextDepth
        })
      )
      const total = MutableRef.make(0)
      Iterable.forEach(
        Iterable.takeWhile(Iterable.range(0), () => Boolean.not(MutableList.isEmpty(pending))),
        () => refine(f, pending, total)
      )
      return MutableRef.get(total)
    }
  })
}
