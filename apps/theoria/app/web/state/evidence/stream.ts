import { Match, Option } from "effect"

import type { Metadata } from "../../../contracts/envelope.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import {
  appendEvidenceSectionToStore,
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  evidenceSectionsFromStore,
  type EvidenceStoreState
} from "../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { RunData } from "../../../contracts/study/run.js"

export type EvidenceStreamState = {
  readonly sections: ReadonlyArray<EvidenceSection>
  readonly complete: boolean
  readonly summary: string | null
  readonly meta: Metadata | null
}

export type EvidenceStatusState = {
  readonly complete: boolean
  readonly sectionCount: number
}

export const emptyEvidenceStreamState: EvidenceStreamState = {
  sections: [],
  complete: false,
  summary: null,
  meta: null
}

export const emptyEvidenceStatusState: EvidenceStatusState = {
  complete: false,
  sectionCount: 0
}

const hasSharedSectionKey = (current: EvidenceSection, section: EvidenceSection): boolean =>
  Option.all({
    currentKey: Option.fromNullable(current.key),
    nextKey: Option.fromNullable(section.key)
  }).pipe(
    Option.match({
      onNone: () => false,
      onSome: ({ currentKey, nextKey }) => currentKey === nextKey
    })
  )

const upsertSection = (
  sections: ReadonlyArray<EvidenceSection>,
  section: EvidenceSection
): ReadonlyArray<EvidenceSection> => {
  const index = sections.findIndex((current) =>
    hasSharedSectionKey(current, section) || current.title === section.title
  )

  return index === -1
    ? [...sections, section]
    : sections.map((current, currentIndex) => (currentIndex === index ? section : current))
}

const applyEvidenceEventToStream = (state: EvidenceStreamState, event: EvidenceEvent): EvidenceStreamState =>
  Match.value(event).pipe(
    Match.tag("SectionAppend", ({ section }) => ({
      ...state,
      sections: [...state.sections, section]
    })),
    Match.tag("SectionUpsert", ({ section }) => ({
      ...state,
      sections: upsertSection(state.sections, section)
    })),
    Match.tag("StreamComplete", ({ summary, meta }) => ({
      ...state,
      complete: true,
      summary,
      meta
    })),
    Match.orElse(() => state)
  )

const isEvidenceStoreState = (
  state: EvidenceStoreState | EvidenceStreamState
): state is EvidenceStoreState => "sectionOrder" in state

export function applyEvidenceEvent(state: EvidenceStoreState, event: EvidenceEvent): EvidenceStoreState
export function applyEvidenceEvent(state: EvidenceStreamState, event: EvidenceEvent): EvidenceStreamState
export function applyEvidenceEvent(
  state: EvidenceStoreState | EvidenceStreamState,
  event: EvidenceEvent
): EvidenceStoreState | EvidenceStreamState {
  return isEvidenceStoreState(state)
    ? applyEvidenceEventToStore(state, event)
    : applyEvidenceEventToStream(state, event)
}

export const evidenceStatusFromStore = (state: EvidenceStoreState): EvidenceStatusState => ({
  complete: state.complete,
  sectionCount: state.sectionOrder.length
})

export const evidenceStatusFromStream = (state: EvidenceStreamState): EvidenceStatusState => ({
  complete: state.complete,
  sectionCount: state.sections.length
})

export const evidenceStreamFromStore = (state: EvidenceStoreState): EvidenceStreamState => ({
  sections: evidenceSectionsFromStore(state),
  complete: state.complete,
  summary: state.summary,
  meta: state.meta
})

export const evidenceStreamFromSuccess = ({
  data,
  meta
}: {
  readonly data: RunData
  readonly meta: Metadata | null
}): EvidenceStreamState => ({
  sections: data.sections,
  complete: true,
  summary: data.summary,
  meta
})

export const evidenceStoreFromSuccess = ({
  data,
  meta
}: {
  readonly data: RunData
  readonly meta: Metadata | null
}): EvidenceStoreState => {
  const stateWithSections = data.sections.reduce(appendEvidenceSectionToStore, emptyEvidenceStoreState)

  return {
    ...stateWithSections,
    complete: true,
    summary: data.summary,
    meta
  }
}
