import { Schema } from "effect"

import { PresentationDetailRow } from "./detail-row.js"
import { Program } from "./program.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export class PresentedSection extends Schema.Class<PresentedSection>("PresentedSection")({
  title: NonEmptyString,
  rows: Schema.Array(PresentationDetailRow)
}) {}

export class PresentedRun extends Schema.Class<PresentedRun>("PresentedRun")({
  summary: NonEmptyString,
  sections: Schema.Array(PresentedSection),
  program: Program
}) {}
