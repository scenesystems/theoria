import { Schema } from "effect"

import { Metadata } from "../envelope.js"
import { ErrorModel } from "../error.js"
import { CanonicalFrame, canonicalFrameV1 } from "../study/workflow/canonical-step.js"
import { ChoreographyCue } from "../study/workflow/choreography.js"
import { EvidenceSection } from "./item.js"

type StreamCompleteInput = {
  readonly meta: Metadata | ConstructorParameters<typeof Metadata>[0]
  readonly summary: string
}

type StreamFailedInput = {
  readonly error: ErrorModel | ConstructorParameters<typeof ErrorModel>[0]
}

const metadataForStreamComplete = (meta: StreamCompleteInput["meta"]): Metadata =>
  meta instanceof Metadata ? meta : Metadata.make(meta)

const errorModelForStreamFailed = (error: StreamFailedInput["error"]): ErrorModel =>
  error instanceof ErrorModel ? error : ErrorModel.make(error)

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
 * The canonical run-frame event for the shared runtime spine.
 *
 * `Step` is the only transport that carries authoritative in-flight frame
 * progression. The enclosed frame is versioned so browser projection logic can
 * evolve without relying on widget-local interpretation of bare step payloads.
 */
export class Step extends Schema.TaggedClass<Step>()("Step", {
  frame: CanonicalFrame
}) {}

export class StreamComplete extends Schema.TaggedClass<StreamComplete>()("StreamComplete", {
  summary: Schema.String,
  meta: Metadata
}) {
  constructor({ meta, summary }: StreamCompleteInput) {
    super({
      summary,
      meta: metadataForStreamComplete(meta)
    })
  }
}

export class StreamFailed extends Schema.TaggedClass<StreamFailed>()("StreamFailed", {
  error: ErrorModel
}) {
  constructor({ error }: StreamFailedInput) {
    super({
      error: errorModelForStreamFailed(error)
    })
  }
}

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

export const canonicalStepEvent = (step: ConstructorParameters<typeof CanonicalFrame>[0]["step"]): Step =>
  new Step({ frame: canonicalFrameV1(step) })
