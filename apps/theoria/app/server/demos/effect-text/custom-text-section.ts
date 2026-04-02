import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { Text } from "effect-text"
import { type CorpusEntry, customCorpusEntry } from "../../../contracts/corpus.js"
import { effectTextProjectionWidths as widths } from "../../../contracts/demo/text.js"
import type { EvidenceItem, EvidenceSection } from "../../../contracts/evidence.js"
import { textInput } from "./analysis.js"

const customCorpusEntryWith = (customText: string): CorpusEntry => ({
  ...customCorpusEntry,
  text: customText
})

export const customTextSection = (customText: string): Effect.Effect<EvidenceSection, unknown, never> =>
  Effect.gen(function*() {
    const entry = customCorpusEntryWith(customText)
    const prepared = yield* Text.prepare(textInput(entry.text))

    const rows = Arr.map(widths, (width) => {
      const summary = Text.layout(prepared, { maxWidth: width, lineHeight: 20 })
      const lines = Text.layoutLines(prepared, { maxWidth: width, lineHeight: 20 })
      const firstLine = Option.fromNullable(lines.at(0))

      return [
        entry.label,
        String(entry.text.length),
        String(width),
        String(summary.lineCount),
        Option.match(firstLine, { onNone: () => "", onSome: (line) => line.text })
      ]
    })

    const items: ReadonlyArray<EvidenceItem> = [
      {
        _tag: "Scalar",
        label: "Characters",
        value: entry.text.length,
        unit: "chars",
        format: "integer"
      },
      {
        _tag: "Table",
        label: "Custom text projections",
        columns: ["Entry", "Characters", "Width", "Lines", "First Line"],
        rows
      }
    ]

    return {
      title: "Custom Text",
      items
    }
  }).pipe(Effect.provide(Text.TextLayoutLive))
