import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import {
  EvidenceSectionProjection,
  EvidenceSectionViewModel
} from "../../../contracts/evidence/section-presentation.js"
import { buildEvidenceSectionStats } from "./evidence-section-stats.js"
import {
  evidenceSectionBadge,
  evidenceSectionItemCountLabel,
  evidenceSectionPriorityScore,
  evidenceSectionSummaryText,
  evidenceSectionVariantFor
} from "./evidence-section-summary.js"

import { buildEvidenceSectionGroups } from "./evidence-section-groups.js"

export {
  EvidenceSectionProjection,
  type EvidenceSectionStats,
  type EvidenceSectionVariant,
  EvidenceSectionViewModel
} from "../../../contracts/evidence/section-presentation.js"

const sectionKeyFor = (index: number): string => `section-${String(index + 1).padStart(2, "0")}`

export const projectEvidenceSections = (
  sections: ReadonlyArray<EvidenceSection>
): EvidenceSectionProjection => {
  const latestKey = sections.length === 0 ? null : sectionKeyFor(sections.length - 1)

  return EvidenceSectionProjection.make({
    sectionCount: sections.length,
    sections: sections.map((section, originalIndex) => {
      const stats = buildEvidenceSectionStats(section.items)
      const variant = evidenceSectionVariantFor({ stats, title: section.title })
      const key = sectionKeyFor(originalIndex)

      return EvidenceSectionViewModel.make({
        key,
        title: section.title,
        badge: evidenceSectionBadge(variant),
        eyebrow: evidenceSectionBadge(variant),
        itemCountLabel: evidenceSectionItemCountLabel(section.items.length),
        latest: latestKey === key,
        originalIndex,
        priorityScore: evidenceSectionPriorityScore({ stats, title: section.title, variant }),
        summaryText: evidenceSectionSummaryText({ itemCount: section.items.length, stats, variant }),
        variant,
        stats,
        groups: buildEvidenceSectionGroups({ items: section.items, variant })
      })
    })
  })
}
