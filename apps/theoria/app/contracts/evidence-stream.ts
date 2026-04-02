import { Schema } from "effect"

import { CanonicalStep, DspCanonicalStep, EffectTextProjectionStep } from "./canonical-step.js"
import { ChoreographyCue, Highlight, StageAdvance, StageEnter, StageExit } from "./choreography.js"
import { Metadata } from "./envelope.js"
import { ErrorModel } from "./error.js"
import { EvidenceSection } from "./evidence.js"

export class SectionAppend extends Schema.TaggedClass<SectionAppend>()("SectionAppend", {
  section: EvidenceSection
}) {}

export class SectionUpsert extends Schema.TaggedClass<SectionUpsert>()("SectionUpsert", {
  section: EvidenceSection
}) {}

/**
 * A choreography cue wrapper for the evidence stream. Carries a
 * server-authored cue that instructs the client's animation driver
 * to enter/advance/exit stages or highlight results.
 *
 * @see {@link ChoreographyCue} for the cue vocabulary.
 */
export class Choreography extends Schema.TaggedClass<Choreography>()("Choreography", {
  cue: ChoreographyCue
}) {}

/**
 * A canonical run-step wrapper for the evidence stream. Carries the
 * authored projection inputs that local demo drivers turn into frames
 * and synchronized evidence updates.
 */
export class Step extends Schema.TaggedClass<Step>()("Step", {
  step: CanonicalStep
}) {}

export class StreamComplete extends Schema.TaggedClass<StreamComplete>()("StreamComplete", {
  summary: Schema.String,
  meta: Metadata
}) {}

export class StreamFailed extends Schema.TaggedClass<StreamFailed>()("StreamFailed", {
  error: ErrorModel
}) {}

export const EvidenceEvent = Schema.Union(
  SectionAppend,
  SectionUpsert,
  Choreography,
  Step,
  StreamComplete,
  StreamFailed
)
const EvidenceEventJson = Schema.parseJson(EvidenceEvent)

export type EvidenceEvent = typeof EvidenceEvent.Type

export const encodeEvidenceEventJson = Schema.encodeSync(EvidenceEventJson)

export const decodeEvidenceEventJson = Schema.decodeUnknownEither(EvidenceEventJson)

// ---------------------------------------------------------------------------
// Choreography cue constructors — convenience for server demo authors
// ---------------------------------------------------------------------------

export { ChoreographyCue, DspCanonicalStep, EffectTextProjectionStep, Highlight, StageAdvance, StageEnter, StageExit }
