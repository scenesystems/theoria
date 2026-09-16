import { Array as Arr, Number as Num, Option } from "effect"

export const sum = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.reduce(values, 0, (total, value) => Num.sum(total, value))
}

export const minimumBandwidth = (low: number, high: number, nKernels: number): number =>
  Num.unsafeDivide(Num.subtract(high, low), Num.min(100, Num.increment(nKernels)))

export const valueAt = <A>(valuesInput: Iterable<A>, index: number, fallback: A): A => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(
    Option.getOrElse(() => fallback)
  )
}
