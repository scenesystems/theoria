import { PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"

import { EntryId } from "../entry/id.js"
import { FailureEnvelope, Metadata } from "../envelope.js"
import { EvidenceSection } from "../evidence/item.js"
import { Program } from "../presentation/program.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const RunData = Schema.Struct({
  id: EntryId,
  packageName: PackageNameSchema,
  summary: NonEmptyString,
  durationMs: NonNegativeNumber,
  program: Program,
  sections: Schema.Array(EvidenceSection)
})

export type RunData = typeof RunData.Type

export class RunSuccessEnvelope extends Schema.Class<RunSuccessEnvelope>("RunSuccessEnvelope")({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: RunData
}) {
  static ok(meta: Metadata, data: RunData): RunSuccessEnvelope {
    return RunSuccessEnvelope.make({ ok: true, meta, data })
  }
}

export const RunEnvelope = Schema.Union(RunSuccessEnvelope, FailureEnvelope)

export type RunEnvelope = typeof RunEnvelope.Type
