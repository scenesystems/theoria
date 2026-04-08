import { Schema } from "effect"

import { EntryId } from "../entry/id.js"
import { Envelope } from "../envelope.js"
import { EvidenceSection } from "../evidence/item.js"
import { Program } from "../presentation/program.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const RunData = Schema.Struct({
  id: EntryId,
  packageName: NonEmptyString,
  summary: NonEmptyString,
  durationMs: NonNegativeNumber,
  program: Program,
  sections: Schema.Array(EvidenceSection)
})

export type RunData = typeof RunData.Type

export const RunEnvelope = Envelope(RunData)

export type RunEnvelope = typeof RunEnvelope.Type
