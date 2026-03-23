import { Array as Arr, Option } from "effect"

import type { CandidateRollPair } from "./trace.js"

/**
 * Extract the value roll from a candidate roll pair at the given index.
 *
 * Single-source implementation replacing duplicates in float.ts and int.ts.
 */
export const rollFromCandidatePair = (
  rolls: ReadonlyArray<CandidateRollPair>,
  index: number
): Option.Option<number> => Arr.get(rolls, index).pipe(Option.map(([_kernelRoll, valueRoll]) => valueRoll))
