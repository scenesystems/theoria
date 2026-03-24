import { Array as Arr, Number as Num, Option } from "effect"

export const sum = (values: ReadonlyArray<number>): number =>
  Arr.reduce(values, 0, (total, value) => Num.sum(total, value))

export const minimumBandwidth = (low: number, high: number, nKernels: number): number =>
  Num.unsafeDivide(high - low, Num.min(100, 1 + nKernels))

export const valueAt = <A>(values: ReadonlyArray<A>, index: number, fallback: A): A =>
  Arr.get(values, index).pipe(
    Option.getOrElse(() => fallback)
  )
