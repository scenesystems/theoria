/**
 * Line-local bidi level reordering, punctuation mirroring, and visual text materialization.
 *
 * @since 0.1.0
 */
import { Array, Boolean, Chunk, Data, MutableRef, Number, String, Tuple } from "effect"

import * as BidiData from "./bidiData.js"

class LevelBounds extends Data.Class<{
  readonly maxLevel: number
  readonly minLevel: number
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

const scanLevelBounds = (units: Array.NonEmptyReadonlyArray<VisualOrderUnit>): LevelBounds => {
  const maxLevel = MutableRef.make(0)
  const minLevel = MutableRef.make(visualOrderUnitLevel(Array.headNonEmpty(units)))
  Array.forEach(units, (unit) => {
    const level = visualOrderUnitLevel(unit)
    MutableRef.set(maxLevel, Number.max(MutableRef.get(maxLevel), level))
    MutableRef.set(minLevel, Number.min(MutableRef.get(minLevel), level))
  })
  return new LevelBounds({ maxLevel: MutableRef.get(maxLevel), minLevel: MutableRef.get(minLevel) })
}

// UAX #9 L2: at each descending level, reverse each contiguous run whose
// levels meet the threshold. Group membership is a Boolean equivalence.
const reverseLevelRuns = (
  units: Array.NonEmptyReadonlyArray<VisualOrderUnit>,
  level: number
): Array.NonEmptyReadonlyArray<VisualOrderUnit> =>
  Array.flatMap(
    Array.groupWith(units, (self, that) =>
      Boolean.Equivalence(
        Number.greaterThanOrEqualTo(visualOrderUnitLevel(self), level),
        Number.greaterThanOrEqualTo(visualOrderUnitLevel(that), level)
      )),
    (run) =>
      Boolean.match(Number.greaterThanOrEqualTo(visualOrderUnitLevel(Array.headNonEmpty(run)), level), {
        onTrue: () => Array.reverse(run),
        onFalse: () => run
      })
  )

const reorderVisualUnits = (units: VisualOrderUnits): VisualOrderUnits =>
  Array.match(Chunk.toReadonlyArray(units), {
    onEmpty: () => units,
    onNonEmpty: (values) => {
      const bounds = scanLevelBounds(values)
      // ICU's L2 formulation rounds the overall minimum up to odd. Passes
      // below the lowest observed odd level cancel in identical pairs.
      const minimumOdd = Boolean.match(isOddLevel(bounds.minLevel), {
        onTrue: () => bounds.minLevel,
        onFalse: () => Number.increment(bounds.minLevel)
      })
      return Boolean.match(Number.lessThan(bounds.maxLevel, minimumOdd), {
        onTrue: () => units,
        onFalse: () =>
          Chunk.unsafeFromArray(Array.reduceRight(
            Array.range(minimumOdd, bounds.maxLevel),
            values,
            (reordered, level) =>
              Boolean.match(Number.Equivalence(level, bounds.minLevel), {
                onTrue: () => Array.reverse(reordered),
                onFalse: () => reverseLevelRuns(reordered, level)
              })
          ))
      })
    }
  })

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
