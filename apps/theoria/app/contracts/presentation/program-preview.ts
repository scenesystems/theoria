import { Schema } from "effect"

import { EntryId } from "../entry/id.js"
import { Envelope } from "../envelope.js"
import { Program } from "./program.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const PreviewCard = Schema.Struct({
  id: EntryId,
  title: NonEmptyString,
  packageName: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString
})

export const ProgramPreview = Schema.Struct({
  id: EntryId,
  card: PreviewCard,
  summary: NonEmptyString,
  program: Program
})

export type ProgramPreview = typeof ProgramPreview.Type

export const ProgramPreviewEnvelope = Envelope(ProgramPreview)

export type ProgramPreviewEnvelope = typeof ProgramPreviewEnvelope.Type
