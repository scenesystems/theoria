import { Text } from "@scenesystems/effect-text"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"

import { markerRadius, type Stage } from "../../../contracts/demo/imagined-place-flow.js"
import { type PlaceArtifact, placeFeatures } from "../../../contracts/imagined-place.js"
import { prepareInputFor, semanticsFor } from "../../../contracts/text.js"
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
export type MarkerLabelWidths = Record.ReadonlyRecord<string, number>

const labelRole = "marker-label"

/** Room between the disc's edge and its name: the inset ring and the trigger's padding. */
const labelInset = 6

/**
 * Wrap widths to try, as fractions of the disc's inner width. A narrower wrap
 * turns one long line into a taller, thinner block that can sit inside the
 * circle where the wide one could not.
 */
const wrapFractions: ReadonlyArray<number> = [1, 0.8, 0.65]

/**
 * The engine breaks inside a word when nothing else fits; the browser would
 * overflow instead. A layout only counts when its lines rejoin to the name at
 * word boundaries.
 */
const breaksAtWords = (lines: ReadonlyArray<Text.LayoutLineType>, name: string): boolean =>
  Arr.join(Arr.map(lines, (line) => line.text), " ") === name

/** A block of text sits inside a circle when its diagonal is no longer than the diameter. */
const fitsCircle = (lines: ReadonlyArray<Text.LayoutLineType>, lineHeight: number, maxWidth: number, inner: number) => {
  const widest = Arr.reduce(lines, 0, (acc, line) => Math.max(acc, line.width))
  return widest <= maxWidth && Math.hypot(widest, lines.length * lineHeight) <= inner
}

export const labelWidthFor = (
  prepared: Text.PreparedTextWithSegments,
  name: string,
  diameter: number
): Option.Option<number> => {
  const inner = diameter - 2 * labelInset
  const lineHeight = semanticsFor(labelRole).lineHeight
  return inner <= 0 ? Option.none() : Arr.findFirst(wrapFractions, (fraction) => {
    const maxWidth = inner * fraction
    const lines = Text.layoutLines(prepared, { maxWidth, lineHeight })
    return breaksAtWords(lines, name) && fitsCircle(lines, lineHeight, maxWidth, inner)
      ? Option.some(maxWidth)
      : Option.none()
  })
}

/** Every feature's name measured against the disc it will have at this stage width. */
export const markerLabelWidths = (
  artifact: PlaceArtifact,
  stage: Stage
): Effect.Effect<MarkerLabelWidths, unknown, BrowserTextLayout> =>
  Effect.map(
    Effect.forEach(placeFeatures(artifact), (feature) =>
      Effect.map(
        prepareBrowserText(prepareInputFor(labelRole, feature.name)),
        (prepared) =>
          Option.map(
            labelWidthFor(prepared, feature.name, markerRadius(stage, feature.weight) * 2),
            (width): readonly [string, number] => [feature.name, width]
          )
      )),
    (entries) => Option.getOrElse(Option.map(Option.all(entries), Record.fromEntries), Record.empty)
  )
