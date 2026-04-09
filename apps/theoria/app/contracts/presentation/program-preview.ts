import { PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"

import { EntryId } from "../entry/id.js"
import { FailureEnvelope, Metadata } from "../envelope.js"
import { Program } from "./program.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const PreviewCard = Schema.Struct({
  id: EntryId,
  title: NonEmptyString,
  packageName: PackageNameSchema,
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

export class ProgramPreviewSuccessEnvelope extends Schema.Class<ProgramPreviewSuccessEnvelope>(
  "ProgramPreviewSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: ProgramPreview
}) {}

export const ProgramPreviewEnvelope = Schema.Union(ProgramPreviewSuccessEnvelope, FailureEnvelope)

export type ProgramPreviewEnvelope = typeof ProgramPreviewEnvelope.Type
