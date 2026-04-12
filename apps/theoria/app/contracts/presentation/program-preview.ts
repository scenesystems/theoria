import { PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"

import { EntryId } from "../entry/id.js"
import { FailureEnvelope, Metadata } from "../envelope.js"
import { Program } from "./program.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export type ProgramPreviewCardInput = {
  readonly deepDivePath: string
  readonly id: typeof EntryId.Type
  readonly packageName: typeof PackageNameSchema.Type
  readonly runLabel: string
  readonly summary: string
  readonly title: string
  readonly useCase: string
}

export class ProgramPreviewCard extends Schema.Class<ProgramPreviewCard>("ProgramPreviewCard")({
  id: EntryId,
  title: NonEmptyString,
  packageName: PackageNameSchema,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString
}) {}

export const programPreviewCard = (input: ProgramPreviewCardInput): ProgramPreviewCard =>
  ProgramPreviewCard.make({
    deepDivePath: input.deepDivePath,
    id: input.id,
    packageName: input.packageName,
    runLabel: input.runLabel,
    summary: input.summary,
    title: input.title,
    useCase: input.useCase
  })

export class ProgramPreview extends Schema.Class<ProgramPreview>("ProgramPreview")({
  id: EntryId,
  card: ProgramPreviewCard,
  summary: NonEmptyString,
  program: Program
}) {}

export class ProgramPreviewSuccessEnvelope extends Schema.Class<ProgramPreviewSuccessEnvelope>(
  "ProgramPreviewSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: ProgramPreview
}) {
  static ok(meta: Metadata, data: ProgramPreview): ProgramPreviewSuccessEnvelope {
    return ProgramPreviewSuccessEnvelope.make({ ok: true, meta, data })
  }
}

export const ProgramPreviewEnvelope = Schema.Union(ProgramPreviewSuccessEnvelope, FailureEnvelope)

export type ProgramPreviewEnvelope = typeof ProgramPreviewEnvelope.Type
