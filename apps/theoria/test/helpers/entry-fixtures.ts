import { EntryExecutionError } from "../../app/contracts/entry-error.js"
import { Card } from "../../app/contracts/entry/card.js"
import { EntryRegistry } from "../../app/contracts/entry/registry.js"
import { EntryPresentation } from "../../app/contracts/entry/routing.js"
import { ProgramPreview, programPreviewCard } from "../../app/contracts/presentation/program-preview.js"
import type { ProgramFile } from "../../app/contracts/presentation/program.js"
import type { RunData } from "../../app/contracts/study/run.js"

const effectTextSurface = EntryPresentation.fromEntryId("effect-text")
const entryRegistry = EntryRegistry.current()
export const effectTextCardFixture = Card.project(entryRegistry.descriptorForId("effect-text"))

const programFixtureFile: ProgramFile = {
  language: "ts",
  entry: "server/run.ts",
  name: "run.ts",
  source: "export const run = Effect.succeed('ok')"
}

export const errorFixture = new EntryExecutionError({
  code: "execution-failed",
  message: "fixture failure",
  retryable: true
})

export const runDataFixture = (summary: string): RunData => ({
  id: effectTextSurface.entryId,
  packageName: effectTextSurface.packageName,
  summary,
  durationMs: 3,
  program: {
    files: [programFixtureFile]
  },
  sections: [
    {
      title: "Performance",
      items: [
        {
          _tag: "Comparison",
          label: "Projection runtime",
          baseline: 2,
          improved: 1,
          unit: "ms",
          direction: "lower-is-better"
        }
      ]
    },
    {
      title: "Corpus",
      items: [
        { _tag: "Text", label: "Corpus entries", value: "1" }
      ]
    }
  ]
})

export const programPreviewFixture: ProgramPreview = ProgramPreview.make({
  id: effectTextSurface.entryId,
  card: programPreviewCard({
    deepDivePath: effectTextSurface.path,
    id: effectTextSurface.entryId,
    packageName: effectTextSurface.packageName,
    runLabel: effectTextSurface.runLabel,
    summary: effectTextSurface.summary,
    title: effectTextSurface.title,
    useCase: effectTextSurface.useCase
  }),
  summary: effectTextSurface.summary,
  program: {
    files: [programFixtureFile]
  }
})
