import { Option } from "effect"

import type { CorpusEntry } from "./corpus.js"

type WidthProjection = {
  readonly width: number
  readonly measuredLineCount: number
  readonly naiveLineCount: number
  readonly lineDelta: number
  readonly sampleLine: string
}

type CorpusProjection = {
  readonly id: string
  readonly label: string
  readonly characters: number
  readonly width: number
  readonly measuredLineCount: number
  readonly naiveLineCount: number
  readonly lineDelta: number
  readonly sampleLine: string
}

export type CorpusMatrixEntry = {
  readonly id: string
  readonly label: string
  readonly characters: number
  readonly projections: ReadonlyArray<WidthProjection>
}

export type WidthMetric = {
  readonly width: number
  readonly meanMeasuredLineCount: number
  readonly meanNaiveLineCount: number
  readonly meanAbsoluteLineError: number
}

const averageGlyphWidth = 8

export type LayoutProjection = {
  readonly id: string
  readonly label: string
  readonly width: number
  readonly lineCount: number
  readonly sampleLine: string
  readonly characters: number
}

const average = (values: ReadonlyArray<number>): number => {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

export const lineCountFromCharacters = (characters: number, width: number): number => {
  const charactersPerLine = Math.max(1, Math.floor(width / averageGlyphWidth))

  return Math.max(1, Math.ceil(characters / charactersPerLine))
}

const layoutAt = (
  layouts: ReadonlyArray<LayoutProjection>,
  id: string,
  width: number
): Option.Option<LayoutProjection> =>
  Option.fromNullable(layouts.find((layout) => layout.id === id && layout.width === width))

const widthProjection = (
  layouts: ReadonlyArray<LayoutProjection>,
  entry: CorpusEntry,
  width: number
): WidthProjection => {
  const measured = layoutAt(layouts, entry.id, width)
  const naiveLineCount = lineCountFromCharacters(entry.text.length, width)

  const measuredLineCount = Option.match(measured, {
    onNone: () => 0,
    onSome: (layout) => layout.lineCount
  })

  const sampleLine = Option.match(measured, {
    onNone: () => "",
    onSome: (layout) => layout.sampleLine
  })

  return {
    width,
    measuredLineCount,
    naiveLineCount,
    lineDelta: naiveLineCount - measuredLineCount,
    sampleLine
  }
}

export const corpusProjection = (
  layouts: ReadonlyArray<LayoutProjection>,
  entries: ReadonlyArray<CorpusEntry>,
  focusWidth: number
): ReadonlyArray<CorpusProjection> =>
  entries.map((entry) => {
    const focused = widthProjection(layouts, entry, focusWidth)

    return {
      id: entry.id,
      label: entry.label,
      characters: entry.text.length,
      width: focusWidth,
      measuredLineCount: focused.measuredLineCount,
      naiveLineCount: focused.naiveLineCount,
      lineDelta: focused.lineDelta,
      sampleLine: focused.sampleLine
    }
  })

export const corpusMatrixProjection = (
  layouts: ReadonlyArray<LayoutProjection>,
  entries: ReadonlyArray<CorpusEntry>,
  widths: ReadonlyArray<number>
): ReadonlyArray<CorpusMatrixEntry> =>
  entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    characters: entry.text.length,
    projections: widths.map((width) => widthProjection(layouts, entry, width))
  }))

export const widthMetrics = (
  layouts: ReadonlyArray<LayoutProjection>,
  widths: ReadonlyArray<number>
): ReadonlyArray<WidthMetric> =>
  widths.map((width) => {
    const atWidth = layouts.filter((layout) => layout.width === width)

    const measuredValues = atWidth.map((layout) => layout.lineCount)
    const naiveValues = atWidth.map((layout) => lineCountFromCharacters(layout.characters, width))
    const absoluteErrorValues = atWidth.map((layout) =>
      Math.abs(lineCountFromCharacters(layout.characters, width) - layout.lineCount)
    )

    return {
      width,
      meanMeasuredLineCount: average(measuredValues),
      meanNaiveLineCount: average(naiveValues),
      meanAbsoluteLineError: average(absoluteErrorValues)
    }
  })

export const meanNaiveError = (layouts: ReadonlyArray<LayoutProjection>): number =>
  average(
    layouts.map((layout) => {
      const naiveLineCount = lineCountFromCharacters(layout.characters, layout.width)

      return Math.abs(naiveLineCount - layout.lineCount)
    })
  )
