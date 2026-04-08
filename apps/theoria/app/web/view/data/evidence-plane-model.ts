import type { Metadata } from "../../../contracts/envelope.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"

import { buildEvidencePlaneLayout, type EvidencePlaneLayout } from "./evidence-plane-layout.js"
import {
  type EvidenceOption,
  type EvidencePlaneFilter,
  evidencePlaneFilterOptions,
  type EvidencePlaneOrder,
  evidencePlaneOrderOptions,
  evidencePlaneSectionOptions,
  normalizedEvidenceSectionKey,
  visibleEvidenceSections
} from "./evidence-plane-ordering.js"
import {
  type EvidenceMetric,
  type EvidenceSectionStats,
  type EvidenceSectionViewModel,
  projectEvidenceSections
} from "./evidence-section-projection.js"

export type { EvidencePlaneLane, EvidencePlaneLayout } from "./evidence-plane-layout.js"
export type { EvidenceOption, EvidencePlaneFilter, EvidencePlaneOrder } from "./evidence-plane-ordering.js"
export type {
  EvidenceMetric,
  EvidenceSectionGroup,
  EvidenceSectionStats,
  EvidenceSectionVariant,
  EvidenceSectionViewModel
} from "./evidence-section-projection.js"

export type EvidencePlaneViewModel = {
  readonly overview: {
    readonly eyebrow: string
    readonly description: string
    readonly metrics: ReadonlyArray<EvidenceMetric>
  }
  readonly controls: {
    readonly filterOptions: ReadonlyArray<EvidenceOption<EvidencePlaneFilter>>
    readonly activeFilterIndex: number
    readonly orderOptions: ReadonlyArray<EvidenceOption<EvidencePlaneOrder>>
    readonly activeOrderIndex: number
    readonly sectionOptions: ReadonlyArray<EvidenceOption<string | null>>
    readonly activeSectionIndex: number
  }
  readonly layout: EvidencePlaneLayout
  readonly sections: ReadonlyArray<EvidenceSectionViewModel>
}

const formatDuration = (durationMs: number): string =>
  durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${Math.round(durationMs)} ms`

const aggregateSectionStats = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidenceSectionStats =>
  sections.reduce(
    (totals, section) => ({
      scalarCount: totals.scalarCount + section.stats.scalarCount,
      comparisonCount: totals.comparisonCount + section.stats.comparisonCount,
      seriesCount: totals.seriesCount + section.stats.seriesCount,
      visualCount: totals.visualCount + section.stats.visualCount,
      tableCount: totals.tableCount + section.stats.tableCount,
      textCount: totals.textCount + section.stats.textCount
    }),
    {
      scalarCount: 0,
      comparisonCount: 0,
      seriesCount: 0,
      visualCount: 0,
      tableCount: 0,
      textCount: 0
    }
  )

const activeOptionIndex = <A>(options: ReadonlyArray<EvidenceOption<A>>, value: A): number =>
  Math.max(options.findIndex((option) => option.value === value), 0)

export const buildEvidencePlaneViewModel = ({
  complete,
  filter,
  meta,
  order,
  sectionKey,
  sections,
  summary
}: {
  readonly complete: boolean
  readonly filter: EvidencePlaneFilter
  readonly meta: Metadata | null
  readonly order: EvidencePlaneOrder
  readonly sectionKey: string | null
  readonly sections: ReadonlyArray<EvidenceSection>
  readonly summary: string | null
}): EvidencePlaneViewModel => {
  const projected = projectEvidenceSections(sections)
  const sectionOptions = evidencePlaneSectionOptions({ filter, order, sections: projected })
  const activeSectionValue = normalizedEvidenceSectionKey({ options: sectionOptions, sectionKey })
  const visible = visibleEvidenceSections({ filter, order, sectionKey: activeSectionValue, sections: projected })
  const stats = aggregateSectionStats(visible)
  const runtimeText = meta === null ? null : formatDuration(meta.durationMs)
  const latestSection = projected[projected.length - 1] ?? null
  const layout = buildEvidencePlaneLayout({ order, sectionKey: activeSectionValue, sections: visible })

  return {
    overview: {
      eyebrow: complete
        ? `${order === "live" ? "Live stream" : "Narrative view"} · evidence complete${
          runtimeText === null ? "" : ` · ${runtimeText}`
        }`
        : latestSection === null
        ? "Waiting for live evidence"
        : `${order === "live" ? "Live stream" : "Narrative view"} · latest section: ${latestSection.title}`,
      description: activeSectionValue === null
        ? complete
          ? summary ??
            "Decisive results stay promoted while datasets and context remain legible as supporting evidence."
          : order === "live"
          ? "Newest evidence lands first, with the freshest result held above the running stream."
          : "Results stay in the narrative lane while datasets and contract notes collect in a supporting reference lane."
        : `Focused on ${visible[0]?.title ?? "the selected section"}.`,
      metrics: [
        { label: "In view", value: `${visible.length}/${Math.max(projected.length, 1)}` },
        { label: "Metrics", value: String(stats.scalarCount) },
        { label: "Visuals", value: String(stats.visualCount) },
        { label: "Tables", value: String(stats.tableCount) },
        { label: "Notes", value: String(stats.textCount) }
      ]
    },
    controls: {
      filterOptions: evidencePlaneFilterOptions,
      activeFilterIndex: activeOptionIndex(evidencePlaneFilterOptions, filter),
      orderOptions: evidencePlaneOrderOptions,
      activeOrderIndex: activeOptionIndex(evidencePlaneOrderOptions, order),
      sectionOptions,
      activeSectionIndex: activeOptionIndex(sectionOptions, activeSectionValue)
    },
    layout,
    sections: visible
  }
}
