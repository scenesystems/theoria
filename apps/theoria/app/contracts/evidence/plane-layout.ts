import { Option } from "effect"

import {
  EvidencePlaneLane,
  type EvidencePlaneLayout,
  FocusedEvidencePlaneLayout,
  LiveEvidencePlaneLayout,
  NarrativeEvidencePlaneLayout
} from "./plane-presentation.js"
import type { EvidenceSectionViewModel } from "./section-presentation.js"

const evidenceLanes = ({
  description,
  eyebrow,
  sections,
  title
}: {
  readonly description: string
  readonly eyebrow: string
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
  readonly title: string
}): ReadonlyArray<EvidencePlaneLane> =>
  sections.length === 0 ? [] : [EvidencePlaneLane.make({ description, eyebrow, sections, title })]

const spotlightSections = (section: EvidenceSectionViewModel | null): ReadonlyArray<EvidenceSectionViewModel> =>
  section === null ? [] : [section]

const isNarrativeSection = (section: EvidenceSectionViewModel): boolean =>
  section.variant === "highlight" || section.variant === "analysis"

const liveLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout => {
  const spotlight = sections.find(isNarrativeSection) ?? sections[0] ?? null
  const streamSections = spotlight === null ? sections : sections.filter((section) => section.key !== spotlight.key)

  return LiveEvidencePlaneLayout.make({
    spotlight: spotlightSections(spotlight),
    lanes: evidenceLanes({
      description: "Newest evidence arrives first so the stream reads like an active log instead of a buried archive.",
      eyebrow: "Live Stream",
      sections: streamSections,
      title: "Newest First"
    })
  })
}

const focusedLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout => {
  const section = Option.fromNullable(sections[0])

  return Option.match(section, {
    onNone: () => liveLayout(sections),
    onSome: (value) => FocusedEvidencePlaneLayout.make({ section: value })
  })
}

const narrativeLayout = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidencePlaneLayout => {
  const spotlight = sections.find(isNarrativeSection) ?? sections[0] ?? null
  const remainingSections = spotlight === null ? sections : sections.filter((section) => section.key !== spotlight.key)

  return NarrativeEvidencePlaneLayout.make({
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
  })
}

export const buildEvidencePlaneLayout = ({
  order,
  sectionKey,
  sections
}: {
  readonly order: "live" | "narrative"
  readonly sectionKey: string | null
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}): EvidencePlaneLayout =>
  sectionKey !== null && sections.length > 0
    ? focusedLayout(sections)
    : order === "live"
    ? liveLayout(sections)
    : narrativeLayout(sections)
