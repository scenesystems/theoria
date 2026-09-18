/**
 * Line-local bidi level reordering, punctuation mirroring, and visual text materialization.
 *
 * @since 0.1.0
 */
import { Array, Boolean, Chunk, Data, Number, Option, String } from "effect"

import * as BidiData from "./bidiData.js"

class LevelBounds extends Data.Class<{
  readonly maxLevel: number
  readonly minimumOddLevel: Option.Option<number>
}> {}

/** Internal line-local unit used while deriving visual order from prepared metadata. */
export class VisualOrderUnit extends Data.Class<{
  readonly level: number
  readonly mirroredText: string
  readonly text: string
}> {}

type VisualOrderUnits = Chunk.Chunk<VisualOrderUnit>

const isOddLevel = (level: number): boolean => Number.Equivalence(Number.remainder(level, 2), 1)

/** Mirrors paired punctuation glyphs for visually ordered odd-level runs. */
export const mirrorText = (text: string): string =>
  Boolean.match(BidiData.containsMirroredCharacters(text), {
    onFalse: () => text,
    onTrue: () =>
      Chunk.reduce(
        Chunk.fromIterable(text),
        "",
        (mirrored, character) => String.concat(BidiData.mirrorCharacter(character))(mirrored)
      )
  })

/** Re-exports unsupported bidi-control detection so preparation and projection share one decision point. */
export const containsUnsupportedBidiControls = BidiData.containsUnsupportedBidiControls

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
  Chunk.reduce(
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
const levelRuns = (units: VisualOrderUnits, level: number): Chunk.Chunk<VisualOrderUnits> =>
  Array.match(Chunk.toReadonlyArray(units), {
    onEmpty: Chunk.empty<VisualOrderUnits>,
    onNonEmpty: (nonEmpty) =>
      Chunk.fromIterable(Array.map(
        Array.groupWith(nonEmpty, (self, that) =>
          Boolean.Equivalence(
            Number.greaterThanOrEqualTo(self.level, level),
            Number.greaterThanOrEqualTo(that.level, level)
          )),
        Chunk.fromIterable
      ))
  })

const reverseLevelRuns = (units: VisualOrderUnits, level: number): VisualOrderUnits =>
  Chunk.flatMap(levelRuns(units, level), (run) =>
    Chunk.head(run).pipe(
      Option.match({
        onNone: Chunk.empty<VisualOrderUnit>,
        onSome: (head) =>
          Boolean.match(Number.greaterThanOrEqualTo(head.level, level), {
            onTrue: () => Chunk.reverse(run),
            onFalse: () => run
          })
      })
    ))

const reorderVisualUnits = (units: VisualOrderUnits): VisualOrderUnits => {
  const bounds = scanLevelBounds(units)
  return bounds.minimumOddLevel.pipe(
    Option.match({
      onNone: () => units,
      onSome: (minimumOdd) =>
        Chunk.reduceRight(
          Chunk.range(minimumOdd, bounds.maxLevel),
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
      Chunk.appendAll(
        units,
        Chunk.map(
          Chunk.fromIterable(insertedText),
          (text) =>
            new VisualOrderUnit({
              level: fallbackLevel,
              mirroredText: mirrorText(text),
              text
            })
        )
      )
  })

const renderVisualText = (units: VisualOrderUnits): string =>
  Chunk.join(
    Chunk.map(units, (unit) =>
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
