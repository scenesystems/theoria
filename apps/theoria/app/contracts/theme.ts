import { Schema } from "effect"

/**
 * The tones: the three voices the site colours, in one ladder of roles and
 * one colour, each voice a saturation of it (`palette.ts`). Colour says who,
 * and nothing else — a package, a status, a content ID is read in the neutral ink.
 *
 * - `primary`: the brand's accent, and the reader's own voice — the controls,
 *   the features the reader placed, the versions the reader signed.
 * - `secondary`: another person's voice — the neighbor's proposal, its disc,
 *   the note they sealed.
 * - `tertiary`: a program's voice — the proposer program's disc and card.
 *
 * @since 0.3.0
 */
export const Tone = Schema.Literal("primary", "secondary", "tertiary")

export type Tone = typeof Tone.Type
