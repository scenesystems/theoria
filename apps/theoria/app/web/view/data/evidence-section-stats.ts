import type { EvidenceItem } from "../../../contracts/evidence/item.js"
import { EvidenceSectionStats } from "../../../contracts/evidence/section-presentation.js"

type ScalarEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Scalar" }>
type ComparisonEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Comparison" }>
type SeriesEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Series" }>
type TableEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Table" }>
type TextEvidenceItem = Extract<EvidenceItem, { readonly _tag: "Text" }>

export { EvidenceSectionStats } from "../../../contracts/evidence/section-presentation.js"

const scalarItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ScalarEvidenceItem> =>
  items.flatMap((item) => item._tag === "Scalar" ? [item] : [])

const comparisonItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ComparisonEvidenceItem> =>
  items.flatMap((item) => item._tag === "Comparison" ? [item] : [])

const seriesItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<SeriesEvidenceItem> =>
  items.flatMap((item) => item._tag === "Series" ? [item] : [])

const textItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<TextEvidenceItem> =>
  items.flatMap((item) => item._tag === "Text" ? [item] : [])

const visualItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<ComparisonEvidenceItem | SeriesEvidenceItem> =>
  items.flatMap((item) => item._tag === "Comparison" || item._tag === "Series" ? [item] : [])

const tableItems = (items: ReadonlyArray<EvidenceItem>): ReadonlyArray<TableEvidenceItem> =>
  items.flatMap((item) => item._tag === "Table" ? [item] : [])

export const buildEvidenceSectionStats = (items: ReadonlyArray<EvidenceItem>): EvidenceSectionStats =>
  EvidenceSectionStats.make({
    scalarCount: scalarItems(items).length,
    comparisonCount: comparisonItems(items).length,
    seriesCount: seriesItems(items).length,
    visualCount: visualItems(items).length,
    tableCount: tableItems(items).length,
    textCount: textItems(items).length
  })
