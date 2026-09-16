/**
 * Unicode 17.0 property data used by the UAX #29 grapheme scanner.
 *
 * @since 0.4.3
 */
import { Schema } from "effect"

/** Grapheme_Cluster_Break property, including the UCD default. */
export const GraphemeBreak = Schema.Literal(
  "Other",
  "CR",
  "LF",
  "Control",
  "Extend",
  "ZWJ",
  "Regional_Indicator",
  "Prepend",
  "SpacingMark",
  "L",
  "V",
  "T",
  "LV",
  "LVT"
)

/** Indic_Conjunct_Break property, including the UCD default. */
export const ConjunctBreak = Schema.Literal("None", "Consonant", "Extend", "Linker")

/** Inclusive range in a Unicode property file. Surrogates are retained as code points. */
export const CodePointRange = Schema.Struct({
  start: Schema.Int.pipe(Schema.between(0, 0x10ffff)),
  end: Schema.Int.pipe(Schema.between(0, 0x10ffff))
})

/** Inclusive range with a grapheme-break property. */
export const GraphemeRange = Schema.Struct({ ...CodePointRange.fields, value: GraphemeBreak })

/** Inclusive range with an Indic-conjunct property. */
export const ConjunctRange = Schema.Struct({ ...CodePointRange.fields, value: ConjunctBreak })

/** All version-pinned properties needed by the default extended boundary rules. */
export const GraphemeData = Schema.Struct({
  version: Schema.Literal("17.0.0"),
  grapheme: Schema.Array(GraphemeRange),
  conjunct: Schema.Array(ConjunctRange),
  pictographic: Schema.Array(CodePointRange)
})

/** Ordered grapheme clusters preserving the original UTF-16 contents. */
export const Graphemes = Schema.Array(Schema.String)
