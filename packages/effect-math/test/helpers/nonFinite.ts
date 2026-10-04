import { Number, Option } from "effect"

export const positiveInfinity = Option.getOrThrow(Number.parse("Infinity"))
export const negativeInfinity = Option.getOrThrow(Number.parse("-Infinity"))
export const nan = Option.getOrThrow(Number.parse("NaN"))
