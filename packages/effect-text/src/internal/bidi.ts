/**
 * Line-local bidi level reordering, punctuation mirroring, and visual text materialization.
 *
 * @since 0.1.0
 */
import { Boolean, Chunk, Data, Iterable, Number, Option, String, Tuple } from "effect"

import * as BidiData from "./bidiData.js"

class LevelBounds extends Data.Class<{
  readonly maxLevel: number
  readonly minimumOddLevel: Option.Option<number>
}> {}

/** Internal line-local unit used while deriving visual order from prepared metadata. */
export type VisualOrderUnit = readonly [level: number, text: string]

/** Resolves mirroring once; reordering changes a unit's position, never its level. */
export const visualOrderUnit = (level: number, mirroredText: string, text: string): VisualOrderUnit =>
  Tuple.make(level, Boolean.match(isOddLevel(level), { onTrue: () => mirroredText, onFalse: () => text }))

/** Reads the embedding level retained by a line-local unit. */
export const visualOrderUnitLevel = Tuple.getFirst<VisualOrderUnit[0], VisualOrderUnit[1]>

type VisualOrderUnits = Chunk.Chunk<VisualOrderUnit>

const isOddLevel = (level: number): boolean => {
  // Embedding levels are non-negative integers; decimal remainder conversion
  // is unnecessary. Halving is exact for every representable integer level.
  const half = Number.multiply(level, 0.5)
  return Boolean.not(Number.Equivalence(half, Number.round(half, 0)))
}

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
        maxLevel: Number.max(bounds.maxLevel, visualOrderUnitLevel(unit)),
        minimumOddLevel: minimumOddLevel(bounds.minimumOddLevel, visualOrderUnitLevel(unit))
      })
  )

// UAX #9 L2: at each descending level, reverse each contiguous run whose
// levels meet the threshold. Group membership is a Boolean equivalence.
const levelRuns = (units: VisualOrderUnits, level: number): Chunk.Chunk<VisualOrderUnits> =>
  Chunk.fromIterable(Iterable.map(
    Iterable.groupWith(units, (self, that) =>
      Boolean.Equivalence(
        Number.greaterThanOrEqualTo(visualOrderUnitLevel(self), level),
        Number.greaterThanOrEqualTo(visualOrderUnitLevel(that), level)
      )),
    Chunk.fromIterable
  ))

const reverseLevelRuns = (units: VisualOrderUnits, level: number): VisualOrderUnits =>
  Chunk.flatMap(levelRuns(units, level), (run) =>
    Chunk.head(run).pipe(
      Option.match({
        onNone: Chunk.empty<VisualOrderUnit>,
        onSome: (head) =>
          Boolean.match(Number.greaterThanOrEqualTo(visualOrderUnitLevel(head), level), {
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
          (text) => visualOrderUnit(fallbackLevel, mirrorText(text), text)
        )
      )
  })

const renderVisualText = (units: VisualOrderUnits): string => Chunk.join(Chunk.map(units, Tuple.getSecond), "")

/** Resolves visually ordered text for a line without forcing permutation allocation. */
export const projectVisualText = (
  units: VisualOrderUnits,
  insertedText: string,
  fallbackLevel: number
): string => renderVisualText(reorderVisualUnits(appendInsertedTextUnits(units, insertedText, fallbackLevel)))
