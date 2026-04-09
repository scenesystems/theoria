import { type Effect, Stream } from "effect"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import {
  canonicalStepEvent,
  Choreography,
  type EvidenceEvent,
  SectionAppend,
  SectionUpsert
} from "../../../contracts/evidence/stream.js"
import type { CanonicalStep } from "../../../contracts/study/workflow/canonical-step.js"
import {
  type ChoreographyCue,
  StageEnter,
  StageExit,
  type StageId
} from "../../../contracts/study/workflow/choreography.js"

/**
 * Shared server-side stream payloads for entry SSE composition.
 *
 * This module intentionally sits below the registry so individual entries can
 * author section / cue / step streams without importing the registry module
 * back into their own initialization path.
 */
export type StreamElement =
  | { readonly _tag: "section"; readonly section: EvidenceSection }
  | { readonly _tag: "section-upsert"; readonly section: EvidenceSection }
  | { readonly _tag: "cue"; readonly cue: ChoreographyCue }
  | { readonly _tag: "step"; readonly step: CanonicalStep }

export const section = (resolvedSection: EvidenceSection): StreamElement => ({
  _tag: "section",
  section: resolvedSection
})

export const sectionUpsert = (resolvedSection: EvidenceSection): StreamElement => ({
  _tag: "section-upsert",
  section: resolvedSection
})

export const cue = (resolvedCue: ChoreographyCue): StreamElement => ({
  _tag: "cue",
  cue: resolvedCue
})

export const step = (resolvedStep: CanonicalStep): StreamElement => ({
  _tag: "step",
  step: resolvedStep
})

export const evidenceEventForStreamElement = (element: StreamElement): EvidenceEvent =>
  element._tag === "cue"
    ? new Choreography({ cue: element.cue })
    : element._tag === "step"
    ? canonicalStepEvent(element.step)
    : element._tag === "section-upsert"
    ? new SectionUpsert({ section: element.section })
    : new SectionAppend({ section: element.section })

export const concatStreams = <A, E, R>(
  streams: ReadonlyArray<Stream.Stream<A, E, R>>
): Stream.Stream<A, E, R> =>
  streams.length === 0
    ? Stream.empty
    : streams.reduce((combined, current) => Stream.concat(combined, current))

export const sectionEffectsToStream = <E, R>(
  sectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, E, R>>
): Stream.Stream<EvidenceSection, E, R> =>
  concatStreams(sectionEffects.map((sectionEffect) => Stream.fromEffect(sectionEffect)))

export const sectionsToElements = <E, R>(
  stream: Stream.Stream<EvidenceSection, E, R>
): Stream.Stream<StreamElement, E, R> => Stream.map(stream, section)

export const sectionEffectsToElements = <E, R>(
  sectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, E, R>>
): Stream.Stream<StreamElement, E, R> => sectionsToElements(sectionEffectsToStream(sectionEffects))

export const cueStream = (resolvedCue: ChoreographyCue): Stream.Stream<StreamElement, never, never> =>
  Stream.make(cue(resolvedCue))

export const stage = <E, R>(
  stageId: StageId,
  body: Stream.Stream<StreamElement, E, R>
): Stream.Stream<StreamElement, E, R> =>
  concatStreams([
    cueStream(new StageEnter({ stageId })),
    body,
    cueStream(new StageExit({ stageId }))
  ])
