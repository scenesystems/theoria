import * as Arr from "effect/Array"
import * as Str from "effect/String"

/** Joins class fragments, dropping empty ones. Optional `className` props default to `""` and flow through here. */
export const classNames = (...fragments: ReadonlyArray<string>): string =>
  Arr.join(Arr.filter(fragments, Str.isNonEmpty), " ")
