/**
 * Line-local bidi level reordering, punctuation mirroring, and visual text materialization.
 *
 * @since 0.1.0
 */
import { Boolean, Number, Option, Schema, String } from "effect"
import * as Arr from "effect/Array"

import {
  containsMirroredCharacters,
  containsUnsupportedBidiControls as containsUnsupportedBidiControlsFromData,
  mirrorCharacter
} from "./bidiData.js"

class LevelBounds extends Schema.Class<LevelBounds>("effect-text/BidiLevelBounds")({
  maxLevel: Schema.Number,
  minimumOddLevel: Schema.OptionFromSelf(Schema.Number)
}) {}

/** Internal line-local unit used while deriving visual order from prepared metadata. */
export class VisualOrderUnit extends Schema.Class<VisualOrderUnit>("effect-text/VisualOrderUnit")({
  level: Schema.Number,
  logicalIndex: Schema.Number,
  mirroredText: Schema.String,
  text: Schema.String
}) {}

const VisualOrderUnits = Schema.Array(VisualOrderUnit)
type VisualOrderUnits = typeof VisualOrderUnits.Type

const VisualPermutation = Schema.Array(Schema.Number)

/** Internal visual-order projection for a walked line. */
export class VisualOrderProjection extends Schema.Class<VisualOrderProjection>("effect-text/VisualOrderProjection")({
  permutation: VisualPermutation,
  text: Schema.String
}) {}

const isOddLevel = (level: number): boolean => Number.Equivalence(Number.remainder(level, 2), 1)

/** Mirrors paired punctuation glyphs for visually ordered odd-level runs. */
export const mirrorText = (text: string): string =>
  Boolean.match(containsMirroredCharacters(text), {
    onFalse: () => text,
    onTrue: () =>
      Arr.reduce(
        Arr.fromIterable(text),
        "",
        (mirrored, character) => String.concat(mirrorCharacter(character))(mirrored)
      )
  })

/** Re-exports unsupported bidi-control detection so preparation and projection share one decision point. */
export const containsUnsupportedBidiControls = containsUnsupportedBidiControlsFromData

const minimumOddLevel = (current: Option.Option<number>, level: number): Option.Option<number> =>
  Boolean.match(isOddLevel(level), {
    onFalse: () => current,
    onTrue: () =>
      current.pipe(
        Option.match({
          onNone: () => Option.some(level),
          onSome: (minimum) => Option.some(Number.min(minimum, level))
        })
      )
  })

const scanLevelBounds = (units: VisualOrderUnits): LevelBounds =>
  Arr.reduce(
    units,
    new LevelBounds({ maxLevel: 0, minimumOddLevel: Option.none() }),
    (bounds, unit) =>
      new LevelBounds({
        maxLevel: Number.max(bounds.maxLevel, unit.level),
        minimumOddLevel: minimumOddLevel(bounds.minimumOddLevel, unit.level)
      })
  )

// UAX #9 L2: at each descending level, reverse each contiguous run whose
// levels meet the threshold. Group membership is a Boolean equivalence.
const reverseLevelRuns = (units: VisualOrderUnits, level: number): VisualOrderUnits =>
  Arr.match(units, {
    onEmpty: Arr.empty<VisualOrderUnit>,
    onNonEmpty: (nonEmpty) =>
      Arr.flatMap(
        Arr.groupWith(nonEmpty, (left, right) =>
          Boolean.Equivalence(
            Number.greaterThanOrEqualTo(left.level, level),
            Number.greaterThanOrEqualTo(right.level, level)
          )),
        (run) =>
          Boolean.match(Number.greaterThanOrEqualTo(Arr.headNonEmpty(run).level, level), {
            onTrue: () => Arr.reverse(run),
            onFalse: () => run
          })
      )
  })

const reorderVisualUnits = (units: VisualOrderUnits): VisualOrderUnits => {
  const bounds = scanLevelBounds(units)
  return bounds.minimumOddLevel.pipe(
    Option.match({
      onNone: () => units,
      onSome: (minimumOdd) =>
        Arr.reduceRight(
          Arr.range(minimumOdd, bounds.maxLevel),
          units,
          reverseLevelRuns
        )
    })
  )
}

const appendInsertedTextUnits = (
  units: VisualOrderUnits,
  insertedText: string,
  fallbackLevel: number
): VisualOrderUnits =>
  Boolean.match(String.isEmpty(insertedText), {
    onTrue: () => units,
    onFalse: () =>
      Arr.appendAll(
        units,
        Arr.map(
          Arr.fromIterable(insertedText),
          (text, index) =>
            new VisualOrderUnit({
              level: fallbackLevel,
              logicalIndex: Number.sum(Arr.length(units), index),
              mirroredText: mirrorText(text),
              text
            })
        )
      )
  })

const renderVisualText = (units: VisualOrderUnits): string =>
  Arr.join(
    Arr.map(units, (unit) =>
      Boolean.match(isOddLevel(unit.level), {
        onFalse: () => unit.text,
        onTrue: () => unit.mirroredText
      })),
    ""
  )

/** Resolves visually ordered text for a line without forcing permutation allocation. */
export const projectVisualText = (
  units: VisualOrderUnits,
  insertedText: string,
  fallbackLevel: number
): string => renderVisualText(reorderVisualUnits(appendInsertedTextUnits(units, insertedText, fallbackLevel)))

/** Resolves visual-order text and the logical-to-visual permutation for a line. */
export const projectVisualOrder = (units: VisualOrderUnits): VisualOrderProjection => {
  const reordered = reorderVisualUnits(units)
  return new VisualOrderProjection({
    permutation: Arr.map(reordered, (unit) => unit.logicalIndex),
    text: renderVisualText(reordered)
  })
}
