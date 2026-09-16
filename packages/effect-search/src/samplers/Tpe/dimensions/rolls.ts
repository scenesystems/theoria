/**
 * Candidate roll pair extraction — shared value-roll accessor for float and int dimensions.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Array as Arr, Option } from "effect"

import type { CandidateRollPairSchema } from "./trace.js"

type CandidateRollPairs = Schema.Array$<typeof CandidateRollPairSchema>["Type"]

/**
 * Extract the value roll from a candidate roll pair at the given index.
 *
 * Single-source implementation replacing duplicates in float.ts and int.ts.
 *
 * @since 0.1.0
 */
export const rollFromCandidatePair = (
  rolls: CandidateRollPairs,
  index: number
): Option.Option<number> => Arr.get(rolls, index).pipe(Option.map(([_kernelRoll, valueRoll]) => valueRoll))
