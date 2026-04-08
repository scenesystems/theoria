import { Option } from "effect"

import type { EvidencePlaneOrder } from "./evidence-plane-ordering.js"
import type { EvidenceSectionViewModel } from "./evidence-section-projection.js"

export type EvidencePlaneLane = {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}

type EvidencePlaneLaneLayout = {
  readonly spotlight: ReadonlyArray<EvidenceSectionViewModel>
  readonly lanes: ReadonlyArray<EvidencePlaneLane>
}

export type EvidencePlaneLayout =
  | { readonly _tag: "Focused"; readonly section: EvidenceSectionViewModel }
  | ({ readonly _tag: "Narrative" } & EvidencePlaneLaneLayout)
  | ({ readonly _tag: "Live" } & EvidencePlaneLaneLayout)

const evidenceLanes = (
  { description, eyebrow, sections, title }: {
    readonly description: string
    readonly eyebrow: string
    readonly sections: ReadonlyArray<EvidenceSectionViewModel>
    readonly title: string
  }
): ReadonlyArray<EvidencePlaneLane> => sections.length === 0 ? [] : [{ description, eyebrow, sections, title }]

const spotlightSections = (section: EvidenceSectionViewModel | null): ReadonlyArray<EvidenceSectionViewModel> =>
  section === null ? [] : [section]

const isNarrativeSection = (section: EvidenceSectionViewModel): boolean =>
  section.variant === "highlight" || section.variant === "analysis"

const focusedLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout =>
  Option.match(Option.fromNullable(sections[0]), {
    onNone: () => liveLayout(sections),
    onSome: (section) => ({ _tag: "Focused", section })
  })

const narrativeLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout => {
  const spotlight = sections.find(isNarrativeSection) ?? sections[0] ?? null
  const remainingSections = spotlight === null ? sections : sections.filter((section) => section.key !== spotlight.key)

  return {
    _tag: "Narrative",
    spotlight: spotlightSections(spotlight),
    lanes: [
      ...evidenceLanes({
        description: "Outcome-driven sections and analytic evidence stay in the reading lane.",
        eyebrow: "Narrative",
        sections: remainingSections.filter(isNarrativeSection),
        title: "Results and Analysis"
      }),
      ...evidenceLanes({
        description: "Context, datasets, and contract detail stay nearby without burying the main story.",
        eyebrow: "Reference",
        sections: remainingSections.filter((section) => !isNarrativeSection(section)),
        title: "Context and Data"
      })
    ]
  }
}

const liveLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout => {
  const spotlight = sections.find(isNarrativeSection) ?? sections[0] ?? null
  const streamSections = spotlight === null ? sections : sections.filter((section) => section.key !== spotlight.key)

  return {
    _tag: "Live",
    spotlight: spotlightSections(spotlight),
    lanes: evidenceLanes({
      description: "Newest evidence arrives first so the stream reads like an active log instead of a buried archive.",
      eyebrow: "Live Stream",
      sections: streamSections,
      title: "Newest First"
    })
  }
}

export const buildEvidencePlaneLayout = (
  { order, sectionKey, sections }: {
    readonly order: EvidencePlaneOrder
    readonly sectionKey: string | null
    readonly sections: ReadonlyArray<EvidenceSectionViewModel>
  }
): EvidencePlaneLayout =>
  sectionKey !== null && sections.length > 0
    ? focusedLayout(sections)
    : order === "live"
    ? liveLayout(sections)
    : narrativeLayout(sections)
