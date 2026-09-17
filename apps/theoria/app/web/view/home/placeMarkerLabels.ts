import * as Text from "@scenesystems/effect-text/Text"
import type * as TextMeasurer from "@scenesystems/effect-text/TextMeasurer"
import { Effect, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Bool from "effect/Boolean"
import * as Num from "effect/Number"
import * as Record from "effect/Record"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"

import { markerRadius, type Stage } from "../../../contracts/demo/imagined-place-flow.js"
import { placeFeatures, type PlaceOutline } from "../../../contracts/imagined-place.js"
import { prepareInputFor, semanticsFor, type TextRole } from "../../../contracts/text.js"
import type { BrowserTextLayout } from "../../text/browserTextLayout.js"
import { prepareBrowserText } from "../text/authority.js"

/**
 * Which discs can carry their names, measured with the same text engine that
 * flows the prose around them. A disc's size follows the stage width and the
 * feature's weight, not the search, so this is decided once per render and
 * holds for every trial.
 *
 * The value is the width the name may wrap at, in stage pixels. The disc lays
 * the name out at exactly that width, so what was measured is what is drawn.
 * A frame is named or numbered as a whole: if any name fits no disc, the
 * record is empty, every disc shows its number and the legend carries the
 * names, so the numbers on the stage and in the legend always agree.
 */
export const MarkerLabelWidths = Schema.Record({ key: Schema.String, value: Schema.Number })
export type MarkerLabelWidths = typeof MarkerLabelWidths.Type

/**
 * The role a disc's name is measured and painted in. Its measured fit clips
 * the label, so the role paints nothing the measurer cannot see: the
 * typography contract holds its tracking at zero.
 */
export const labelRole: TextRole = "marker-label"

/** Room between the disc's edge and its name: the inset ring and the trigger's padding. */
const labelInset = 6

/**
 * Wrap widths to try, as fractions of the disc's inner width. A narrower wrap
 * turns one long line into a taller, thinner block that can sit inside the
 * circle where the wide one could not.
 */
const wrapFractions = Arr.make(1, 0.8, 0.65)

/**
 * The engine breaks inside a word when nothing else fits; the browser would
 * overflow instead. A layout only counts when its lines rejoin to the name at
 * word boundaries.
 */
const breaksAtWords = (lines: Text.Lines, name: string): boolean =>
  Str.Equivalence(Arr.join(Arr.map(lines, (line) => line.text), " "), name)

/** A block of text sits inside a circle when its diagonal is no longer than the diameter. */
const fitsCircle = (lines: Text.Lines, lineHeight: number, maxWidth: number, inner: number) => {
  const widest = Arr.reduce(lines, 0, (acc, line) => Num.max(acc, line.width))
  const height = Num.multiply(Arr.length(lines), lineHeight)
  return Bool.and(
    Num.lessThanOrEqualTo(widest, maxWidth),
    Num.lessThanOrEqualTo(
      Num.sum(Num.multiply(widest, widest), Num.multiply(height, height)),
      Num.multiply(inner, inner)
    )
  )
}

export const labelWidthFor = (
  prepared: Text.WithSegments,
  name: string,
  diameter: number
): Option.Option<number> => {
  const inner = Num.subtract(diameter, Num.multiply(2, labelInset))
  const lineHeight = semanticsFor(labelRole).lineHeight
  return Bool.match(Num.lessThanOrEqualTo(inner, 0), {
    onFalse: () =>
      Arr.findFirst(wrapFractions, (fraction) => {
        const maxWidth = Num.multiply(inner, fraction)
        const lines = Text.lines(prepared, { maxWidth, lineHeight })
        return Bool.match(Bool.and(breaksAtWords(lines, name), fitsCircle(lines, lineHeight, maxWidth, inner)), {
          onFalse: Option.none,
          onTrue: () => Option.some(maxWidth)
        })
      }),
    onTrue: Option.none
  })
}

/**
 * Every feature's name measured against the disc it will have at this stage
 * width. An outline is enough: the names and weights are the outline's, so
 * the stage knows before the build arrives whether its discs will be named
 * or numbered, and lays the legend accordingly.
 */
export const markerLabelWidths = (
  place: PlaceOutline,
  stage: Stage
): Effect.Effect<MarkerLabelWidths, TextMeasurer.Failed, BrowserTextLayout> =>
  Effect.map(
    Effect.forEach(placeFeatures(place), (feature) =>
      Effect.map(
        prepareBrowserText(prepareInputFor(labelRole, feature.name)),
        (prepared) =>
          Option.map(
            labelWidthFor(prepared, feature.name, Num.multiply(markerRadius(stage, feature.weight), 2)),
            (width) => Tuple.make(feature.name, width)
          )
      )),
    (entries) => Option.getOrElse(Option.map(Option.all(entries), Record.fromEntries), Record.empty)
  )
