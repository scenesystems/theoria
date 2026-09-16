/**
 * Schema-owned dictionary source contracts shared by generated pattern data.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { HyphenationBreakPoints, type HyphenationBreakPointsType } from "../../../contracts/hyphenationSupport.js"

export { HyphenationBreakPoints, type HyphenationBreakPointsType }

/** Explicit normalized-word to UTF-16 break-offset dictionary. */
export const HyphenationWordBreakDictionary = Schema.Record({
  key: Schema.String,
  value: HyphenationBreakPoints
})

/** Explicit normalized-word to UTF-16 break-offset dictionary. */
export type HyphenationWordBreakDictionaryType = typeof HyphenationWordBreakDictionary.Type

const HyphenationPatternIdentifier = Schema.Union(Schema.String, Schema.Array(Schema.String))
const HyphenationPatternGroups = Schema.Record({ key: Schema.String, value: Schema.String })
const HyphenationPatternSourceFields = {
  id: HyphenationPatternIdentifier,
  leftmin: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  rightmin: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  patterns: HyphenationPatternGroups,
  charSubstitution: Schema.optional(HyphenationPatternGroups),
  exceptions: Schema.optional(Schema.String)
}

/** Structural Liang-pattern source accepted from callers. */
export const HyphenationPatternSource = Schema.Struct(HyphenationPatternSourceFields)

/** Structural Liang-pattern source accepted from callers. */
export type HyphenationPatternSource = typeof HyphenationPatternSource.Type

/** Structural Liang-pattern source accepted from callers. */
export type HyphenationPatternSourceType = HyphenationPatternSource

/** Supported pure dictionary source formats. */
export const HyphenationDictionarySource = Schema.Union(
  HyphenationPatternSource,
  HyphenationWordBreakDictionary
)

/** Supported pure dictionary source formats. */
export type HyphenationDictionarySourceType = typeof HyphenationDictionarySource.Type
