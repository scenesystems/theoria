import * as Arr from "effect/Array"

import type { EntryPresentation } from "../entry/routing.js"

import { type PresentationDetailRow, presentationDetailRow } from "./detail-row.js"
import type { PresentedSection } from "./presented-run.js"

const compactEvidenceRowLimit = 2

const packageUseCaseRow = (surface: EntryPresentation): PresentationDetailRow =>
  presentationDetailRow("Entry Use Case", `${surface.packageName}: ${surface.useCase}`)

const selectedSectionRows = (sections: ReadonlyArray<PresentedSection>): ReadonlyArray<PresentationDetailRow> =>
  Arr.flatMap(sections, (section) => section.rows)

export const surfaceSummaryEvidenceRows = ({
  compact,
  hasSuccessfulRun,
  sections,
  surface
}: {
  readonly compact: boolean
  readonly hasSuccessfulRun: boolean
  readonly sections: ReadonlyArray<PresentedSection>
  readonly surface: EntryPresentation
}): ReadonlyArray<PresentationDetailRow> => {
  const rows = selectedSectionRows(sections)

  if (!compact) {
    return rows
  }

  const useCaseRow = packageUseCaseRow(surface)
  const rowsWithUseCase = rows[0]?.label === useCaseRow.label ? rows : [useCaseRow, ...rows]

  return hasSuccessfulRun || rows.length > 0
    ? Arr.take(rowsWithUseCase, compactEvidenceRowLimit + 1)
    : [useCaseRow, presentationDetailRow("Run Intent", surface.summary)]
}
