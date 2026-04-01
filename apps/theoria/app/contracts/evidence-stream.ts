import { Schema } from "effect"

import { Metadata } from "./envelope.js"
import { ErrorModel } from "./error.js"
import { EvidenceSection } from "./evidence.js"

export class SectionAppend extends Schema.TaggedClass<SectionAppend>()("SectionAppend", {
  section: EvidenceSection
}) {}

export class SectionUpsert extends Schema.TaggedClass<SectionUpsert>()("SectionUpsert", {
  section: EvidenceSection
}) {}

export class StreamComplete extends Schema.TaggedClass<StreamComplete>()("StreamComplete", {
  summary: Schema.String,
  meta: Metadata
}) {}

export class StreamFailed extends Schema.TaggedClass<StreamFailed>()("StreamFailed", {
  error: ErrorModel
}) {}

export const EvidenceEvent = Schema.Union(SectionAppend, SectionUpsert, StreamComplete, StreamFailed)
const EvidenceEventJson = Schema.parseJson(EvidenceEvent)

export type EvidenceEvent = typeof EvidenceEvent.Type

export const encodeEvidenceEventJson = Schema.encodeSync(EvidenceEventJson)

export const decodeEvidenceEventJson = Schema.decodeUnknownEither(EvidenceEventJson)
