import { Match, Option } from "effect"

import type { Metadata } from "./envelope.js"
import type { EvidenceEvent } from "./evidence-stream.js"
import type { EvidenceSection } from "./evidence.js"

export type EvidenceStoreState = {
  readonly nextSectionId: number
  readonly sectionOrder: ReadonlyArray<string>
  readonly sectionsById: Readonly<Record<string, EvidenceSection>>
  readonly sectionIdsByTitle: Readonly<Record<string, string>>
  readonly complete: boolean
  readonly summary: string | null
  readonly meta: Metadata | null
}

export const emptyEvidenceStoreState: EvidenceStoreState = {
  nextSectionId: 1,
  sectionOrder: [],
  sectionsById: {},
  sectionIdsByTitle: {},
  complete: false,
  summary: null,
  meta: null
}

const nextEvidenceSectionId = (state: EvidenceStoreState): string => `section-${state.nextSectionId}`

export const appendEvidenceSectionToStore = (
  state: EvidenceStoreState,
  section: EvidenceSection
): EvidenceStoreState => {
  const sectionId = nextEvidenceSectionId(state)
  const existingId = state.sectionIdsByTitle[section.title]

  return Option.fromNullable(existingId).pipe(
    Option.match({
      onNone: () => ({
        ...state,
        nextSectionId: state.nextSectionId + 1,
        sectionOrder: [...state.sectionOrder, sectionId],
        sectionsById: {
          ...state.sectionsById,
          [sectionId]: section
        },
        sectionIdsByTitle: {
          ...state.sectionIdsByTitle,
          [section.title]: sectionId
        }
      }),
      onSome: () => ({
        ...state,
        nextSectionId: state.nextSectionId + 1,
        sectionOrder: [...state.sectionOrder, sectionId],
        sectionsById: {
          ...state.sectionsById,
          [sectionId]: section
        }
      })
    })
  )
}

const upsertEvidenceSectionInStore = (
  state: EvidenceStoreState,
  section: EvidenceSection
): EvidenceStoreState => {
  const existingId = state.sectionIdsByTitle[section.title]

  return Option.fromNullable(existingId).pipe(
    Option.match({
      onNone: () => appendEvidenceSectionToStore(state, section),
      onSome: (sectionId) => ({
        ...state,
        sectionsById: {
          ...state.sectionsById,
          [sectionId]: section
        }
      })
    })
  )
}

export const applyEvidenceEventToStore = (state: EvidenceStoreState, event: EvidenceEvent): EvidenceStoreState =>
  Match.value(event).pipe(
    Match.tag("SectionAppend", ({ section }) => appendEvidenceSectionToStore(state, section)),
    Match.tag("SectionUpsert", ({ section }) => upsertEvidenceSectionInStore(state, section)),
    Match.tag("StreamComplete", ({ summary, meta }) => ({
      ...state,
      complete: true,
      summary,
      meta
    })),
    Match.orElse(() => state)
  )

export const evidenceSectionsFromStore = (state: EvidenceStoreState): ReadonlyArray<EvidenceSection> =>
  state.sectionOrder.flatMap((sectionId) => {
    const section = state.sectionsById[sectionId]

    return Option.fromNullable(section).pipe(
      Option.match({
        onNone: () => [],
        onSome: (value) => [value]
      })
    )
  })
