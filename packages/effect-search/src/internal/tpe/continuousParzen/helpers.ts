import type { Schema } from "effect"
import { Array as Arr, Number as Num, Option } from "effect"

import type { ContinuousValues } from "./model.js"

export const sum = (values: ContinuousValues): number => Arr.reduce(values, 0, (total, value) => Num.sum(total, value))

export const minimumBandwidth = (low: number, high: number, nKernels: number): number =>
  Num.unsafeDivide(Num.subtract(high, low), Num.min(100, Num.increment(nKernels)))

export const valueAt = <A>(values: Schema.Array$<Schema.Schema<A>>["Type"], index: number, fallback: A): A =>
  Arr.get(values, index).pipe(
    Option.getOrElse(() => fallback)
  )
