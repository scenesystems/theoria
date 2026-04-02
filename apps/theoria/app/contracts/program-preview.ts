import { Schema } from "effect"

import { Envelope } from "./envelope.js"

import { Id } from "./id.js"
import { Program } from "./presentation.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const PreviewCard = Schema.Struct({
  id: Id,
  title: NonEmptyString,
  packageName: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString
})

export const ProgramPreview = Schema.Struct({
  id: Id,
  card: PreviewCard,
  summary: NonEmptyString,
  program: Program
})

export type ProgramPreview = typeof ProgramPreview.Type

export const ProgramPreviewEnvelope = Envelope(ProgramPreview)

export type ProgramPreviewEnvelope = typeof ProgramPreviewEnvelope.Type
