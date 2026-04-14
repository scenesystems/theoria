/**
 * Prepared suggestion state reused across sampler asks.
 *
 * @since 0.3.0
 */
import { Data } from "effect"

import type { SuggestContext } from "./SuggestContext.js"

/**
 * Runtime-prepared sampler state derived from a concrete suggestion context.
 *
 * @since 0.3.0
 * @category models
 */
export class PreparedSuggestionState extends Data.Class<{
  readonly kind: string
  readonly context: SuggestContext
  readonly state: unknown
}> {}
