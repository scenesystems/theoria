/**
 * Internal bidi visual-order helpers.
 *
 * @since 0.1.0
 */
import * as Arr from "effect/Array"

import {
  containsMirroredCharacters,
  containsUnsupportedBidiControls as containsUnsupportedBidiControlsFromData,
  mirrorCharacter
} from "./bidiData.js"

type LevelSpan = readonly [number, number]

type LevelBounds = Readonly<{
  maxLevel: number
  minimumOddLevel: number
}>

const noOddLevel = -1

/**
 * Internal line-local unit used while deriving visual order from prepared metadata.
 *
 * @since 0.2.0
 * @category internals
 */
export type VisualOrderUnit = Readonly<{
  text: string
  mirroredText: string
  level: number
  logicalIndex: number
}>

/**
 * Internal visual run after line-local reordering.
 *
 * @since 0.2.0
 * @category internals
 */
export type VisualRun = Readonly<{
  level: number
  units: ReadonlyArray<VisualOrderUnit>
}>

/**
 * Internal visual-order projection for a walked line.
 *
 * @since 0.2.0
 * @category internals
 */
export type VisualOrderProjection = Readonly<{
  permutation: ReadonlyArray<number>
  text: string
}>

const levelSpan = (start: number, end: number): LevelSpan => [start, end]

/**
 * Mirrors paired punctuation glyphs for visually ordered odd-level runs.
 *
 * @since 0.2.0
 * @category internals
 */
export const mirrorText = (text: string): string =>
  containsMirroredCharacters(text)
    ? Arr.reduce(Arr.fromIterable(text), "", (mirrored, character) => mirrored + mirrorCharacter(character))
    : text

/**
 * Re-exports unsupported bidi-control detection so preparation and visual projection share one decision point.
 *
 * @since 0.2.0
 * @category internals
 */
export const containsUnsupportedBidiControls = containsUnsupportedBidiControlsFromData

const scanLevelBounds = (units: ReadonlyArray<VisualOrderUnit>): LevelBounds =>
  Arr.reduce(
    units,
    { maxLevel: 0, minimumOddLevel: noOddLevel },
    (bounds, unit) => ({
      maxLevel: Math.max(bounds.maxLevel, unit.level),
      minimumOddLevel:
        unit.level % 2 === 1 && (bounds.minimumOddLevel === noOddLevel || unit.level < bounds.minimumOddLevel)
          ? unit.level
          : bounds.minimumOddLevel
    })
  )

const collectLevelSpans = (units: ReadonlyArray<VisualOrderUnit>, level: number): ReadonlyArray<LevelSpan> => {
  const state = Arr.reduce(
    units,
    { activeStart: noOddLevel, spans: Arr.empty<LevelSpan>() },
    (current, unit, index) =>
      unit.level >= level
        ? {
          activeStart: current.activeStart === noOddLevel ? index : current.activeStart,
          spans: current.spans
        }
        : current.activeStart === noOddLevel
        ? current
        : {
          activeStart: noOddLevel,
          spans: Arr.append(current.spans, levelSpan(current.activeStart, index))
        }
  )

  return state.activeStart === noOddLevel
    ? state.spans
    : Arr.append(state.spans, levelSpan(state.activeStart, units.length))
}

const reverseRange = <A>(values: ReadonlyArray<A>, start: number, end: number): ReadonlyArray<A> => [
  ...values.slice(0, start),
  ...values.slice(start, end).slice().reverse(),
  ...values.slice(end)
]

const reverseLevelSpans = <A>(values: ReadonlyArray<A>, spans: ReadonlyArray<LevelSpan>): ReadonlyArray<A> =>
  Arr.reduce(spans, values, (reordered, [start, end]) => reverseRange(reordered, start, end))

const reorderVisualUnits = (units: ReadonlyArray<VisualOrderUnit>): ReadonlyArray<VisualOrderUnit> => {
  const bounds = scanLevelBounds(units)

  return bounds.minimumOddLevel === noOddLevel
    ? units
    : Arr.reduceRight(
      Arr.range(bounds.minimumOddLevel, bounds.maxLevel),
      units,
      (reordered, level) => reverseLevelSpans(reordered, collectLevelSpans(reordered, level))
    )
}

const appendInsertedTextUnits = (
  units: ReadonlyArray<VisualOrderUnit>,
  insertedText: string,
  fallbackLevel: number
): ReadonlyArray<VisualOrderUnit> =>
  insertedText.length === 0
    ? units
    : Arr.appendAll(
      units,
      Arr.map(Arr.fromIterable(insertedText), (text, index) => ({
        level: fallbackLevel,
        logicalIndex: units.length + index,
        mirroredText: mirrorText(text),
        text
      }))
    )

const groupVisualRuns = (units: ReadonlyArray<VisualOrderUnit>): ReadonlyArray<VisualRun> =>
  Arr.reduce(units, Arr.empty<VisualRun>(), (runs, unit) => {
    const lastRun = runs[runs.length - 1] ?? null

    return lastRun === null || lastRun.level !== unit.level
      ? Arr.append(runs, { level: unit.level, units: Arr.make(unit) })
      : Arr.append(
        runs.slice(0, runs.length - 1),
        { level: lastRun.level, units: Arr.append(lastRun.units, unit) }
      )
  })

const renderVisualRunText = (run: VisualRun): string =>
  Arr.reduce(
    run.units,
    "",
    (text, unit) => text + (run.level % 2 === 1 ? unit.mirroredText : unit.text)
  )

/**
 * Resolves visually ordered text for a line without forcing permutation allocation.
 *
 * @since 0.2.0
 * @category internals
 */
export const projectVisualText = (
  units: ReadonlyArray<VisualOrderUnit>,
  insertedText: string,
  fallbackLevel: number
): string =>
  Arr.reduce(
    groupVisualRuns(reorderVisualUnits(appendInsertedTextUnits(units, insertedText, fallbackLevel))),
    "",
    (text, run) => text + renderVisualRunText(run)
  )

/**
 * Resolves visual-order text and the logical-to-visual permutation for a line.
 *
 * @since 0.2.0
 * @category internals
 */
export const projectVisualOrder = (units: ReadonlyArray<VisualOrderUnit>): VisualOrderProjection => {
  const reordered = reorderVisualUnits(units)
  const runs = groupVisualRuns(reordered)

  return {
    permutation: Arr.reduce(
      runs,
      Arr.empty<number>(),
      (logicalIndices, run) => Arr.appendAll(logicalIndices, Arr.map(run.units, (unit) => unit.logicalIndex))
    ),
    text: Arr.reduce(runs, "", (text, run) => text + renderVisualRunText(run))
  }
}
