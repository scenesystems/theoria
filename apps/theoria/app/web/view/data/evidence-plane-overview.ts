import type { Metadata } from "../../../contracts/envelope.js"

import { EvidencePlaneOverviewViewModel } from "../../../contracts/evidence/plane-presentation.js"
import type { EvidencePlaneOrder } from "../../../contracts/evidence/plane.js"
import {
  EvidenceMetric,
  EvidenceSectionStats,
  type EvidenceSectionViewModel
} from "../../../contracts/evidence/section-presentation.js"

export { EvidencePlaneOverviewViewModel } from "../../../contracts/evidence/plane-presentation.js"

const formatDuration = (durationMs: number): string =>
  durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${Math.round(durationMs)} ms`

const aggregateSectionStats = (sections: ReadonlyArray<EvidenceSectionViewModel>): EvidenceSectionStats =>
  sections.reduce(
    (totals, section) =>
      EvidenceSectionStats.make({
        scalarCount: totals.scalarCount + section.stats.scalarCount,
        comparisonCount: totals.comparisonCount + section.stats.comparisonCount,
        seriesCount: totals.seriesCount + section.stats.seriesCount,
        visualCount: totals.visualCount + section.stats.visualCount,
        tableCount: totals.tableCount + section.stats.tableCount,
        textCount: totals.textCount + section.stats.textCount
      }),
    EvidenceSectionStats.make({
      scalarCount: 0,
      comparisonCount: 0,
      seriesCount: 0,
      visualCount: 0,
      tableCount: 0,
      textCount: 0
    })
  )

export const buildEvidencePlaneOverview = ({
  activeSectionKey,
  complete,
  meta,
  order,
  projectedSections,
  summary,
  visibleSections
}: {
  readonly activeSectionKey: string | null
  readonly complete: boolean
  readonly meta: Metadata | null
  readonly order: EvidencePlaneOrder
  readonly projectedSections: ReadonlyArray<EvidenceSectionViewModel>
  readonly summary: string | null
  readonly visibleSections: ReadonlyArray<EvidenceSectionViewModel>
}): EvidencePlaneOverviewViewModel => {
  const stats = aggregateSectionStats(visibleSections)
  const runtimeText = meta === null ? null : formatDuration(meta.durationMs)
  const latestSection = projectedSections[projectedSections.length - 1] ?? null

  return EvidencePlaneOverviewViewModel.make({
    eyebrow: complete
      ? `${order === "live" ? "Live stream" : "Narrative view"} · evidence complete${
        runtimeText === null ? "" : ` · ${runtimeText}`
      }`
      : latestSection === null
      ? "Waiting for live evidence"
      : `${order === "live" ? "Live stream" : "Narrative view"} · latest section: ${latestSection.title}`,
    description: activeSectionKey === null
      ? complete
        ? summary ??
          "Decisive results stay promoted while datasets and context remain legible as supporting evidence."
        : order === "live"
        ? "Newest evidence lands first, with the freshest result held above the running stream."
        : "Results stay in the narrative lane while datasets and contract notes collect in a supporting reference lane."
      : `Focused on ${visibleSections[0]?.title ?? "the selected section"}.`,
    metrics: [
      EvidenceMetric.make({
        label: "In view",
        value: `${visibleSections.length}/${Math.max(projectedSections.length, 1)}`
      }),
      EvidenceMetric.make({ label: "Metrics", value: String(stats.scalarCount) }),
      EvidenceMetric.make({ label: "Visuals", value: String(stats.visualCount) }),
      EvidenceMetric.make({ label: "Tables", value: String(stats.tableCount) }),
      EvidenceMetric.make({ label: "Notes", value: String(stats.textCount) })
    ]
  })
}
