import { Data, Match, Option } from "effect"
import * as Arr from "effect/Array"

import type { Metadata } from "../envelope.js"
import type { EvidenceSection } from "./item.js"
import type { EvidenceEvent } from "./stream.js"

export class EvidenceStore extends Data.Class<EvidenceStore.Shape> {
  static make(store: EvidenceStore.Shape): EvidenceStore {
    return new EvidenceStore(store)
  }

  static empty(): EvidenceStore {
    return EvidenceStore.make({
      nextSectionId: 1,
      sectionOrder: [],
      sectionIdsByKey: {},
      sectionsById: {},
      sectionIdsByTitle: {},
      complete: false,
      summary: null,
      meta: null
    })
  }

  static fromSections({
    complete,
    meta,
    sections,
    summary
  }: {
    readonly complete: boolean
    readonly meta: Metadata | null
    readonly sections: ReadonlyArray<EvidenceSection>
    readonly summary: string | null
  }): EvidenceStore {
    const store = sections.reduce(
      (nextStore, section) => nextStore.append(section),
      EvidenceStore.empty()
    )

    return EvidenceStore.make({
      ...store,
      complete,
      summary,
      meta
    })
  }

  private static nextSectionId(store: EvidenceStore): string {
    return `section-${store.nextSectionId}`
  }

  private static sectionIdByTitle(store: EvidenceStore, title: string): Option.Option<string> {
    return Option.fromNullable(store.sectionIdsByTitle[title])
  }

  private static existingSectionId(store: EvidenceStore, section: EvidenceSection): Option.Option<string> {
    return Option.fromNullable(section.key).pipe(
      Option.match({
        onNone: () => EvidenceStore.sectionIdByTitle(store, section.title),
        onSome: (key) =>
          Option.fromNullable(store.sectionIdsByKey[key]).pipe(
            Option.orElse(() => EvidenceStore.sectionIdByTitle(store, section.title))
          )
      })
    )
  }

  private static appendSectionKeyIndex(
    store: EvidenceStore,
    section: EvidenceSection,
    sectionId: string
  ): EvidenceStore.Shape["sectionIdsByKey"] {
    return Option.fromNullable(section.key).pipe(
      Option.match({
        onNone: () => store.sectionIdsByKey,
        onSome: (key) =>
          Option.fromNullable(store.sectionIdsByKey[key]).pipe(
            Option.match({
              onNone: () => ({
                ...store.sectionIdsByKey,
                [key]: sectionId
              }),
              onSome: () => store.sectionIdsByKey
            })
          )
      })
    )
  }

  private static upsert(store: EvidenceStore, section: EvidenceSection): EvidenceStore {
    return EvidenceStore.existingSectionId(store, section).pipe(
      Option.match({
        onNone: () => store.append(section),
        onSome: (sectionId) =>
          EvidenceStore.make({
            ...store,
            sectionsById: {
              ...store.sectionsById,
              [sectionId]: section
            }
          })
      })
    )
  }

  static append(store: EvidenceStore, section: EvidenceSection): EvidenceStore {
    const sectionId = EvidenceStore.nextSectionId(store)

    return EvidenceStore.existingSectionId(store, section).pipe(
      Option.match({
        onNone: () =>
          EvidenceStore.make({
            ...store,
            nextSectionId: store.nextSectionId + 1,
            sectionOrder: [...store.sectionOrder, sectionId],
            sectionsById: {
              ...store.sectionsById,
              [sectionId]: section
            },
            sectionIdsByKey: EvidenceStore.appendSectionKeyIndex(store, section, sectionId),
            sectionIdsByTitle: {
              ...store.sectionIdsByTitle,
              [section.title]: sectionId
            }
          }),
        onSome: () =>
          EvidenceStore.make({
            ...store,
            nextSectionId: store.nextSectionId + 1,
            sectionOrder: [...store.sectionOrder, sectionId],
            sectionsById: {
              ...store.sectionsById,
              [sectionId]: section
            }
          })
      })
    )
  }

  static applyEvent(store: EvidenceStore, event: EvidenceEvent): EvidenceStore {
    return Match.value(event).pipe(
      Match.tag("SectionAppend", ({ section }) => store.append(section)),
      Match.tag("SectionUpsert", ({ section }) => EvidenceStore.upsert(store, section)),
      Match.tag("StreamComplete", ({ summary, meta }) => store.recordCompletion({ summary, meta })),
      Match.orElse(() => store)
    )
  }

  static sectionCount(store: EvidenceStore): number {
    return store.sectionOrder.length
  }

  static sections(store: EvidenceStore): ReadonlyArray<EvidenceSection> {
    return Arr.filterMap(store.sectionOrder, (sectionId) => Option.fromNullable(store.sectionsById[sectionId]))
  }

  append(section: EvidenceSection): EvidenceStore {
    return EvidenceStore.append(this, section)
  }

  apply(event: EvidenceEvent): EvidenceStore {
    return EvidenceStore.applyEvent(this, event)
  }

  recordCompletion({
    summary,
    meta
  }: {
    readonly summary: string
    readonly meta: Metadata | null
  }): EvidenceStore {
    return EvidenceStore.make({
      ...this,
      complete: true,
      summary,
      meta
    })
  }

  sectionCount(): number {
    return EvidenceStore.sectionCount(this)
  }

  sections(): ReadonlyArray<EvidenceSection> {
    return EvidenceStore.sections(this)
  }
}

export namespace EvidenceStore {
  export interface Shape {
    readonly nextSectionId: number
    readonly sectionOrder: ReadonlyArray<string>
    readonly sectionIdsByKey: Readonly<Record<string, string>>
    readonly sectionsById: Readonly<Record<string, EvidenceSection>>
    readonly sectionIdsByTitle: Readonly<Record<string, string>>
    readonly complete: boolean
    readonly summary: string | null
    readonly meta: Metadata | null
  }
}
