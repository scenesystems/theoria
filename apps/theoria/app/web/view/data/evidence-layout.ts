import { Match } from "effect"

import type { EvidenceItem } from "../../../contracts/evidence.js"

export type EvidenceSpan = "compact" | "medium" | "wide" | "full"

export const evidenceSpan = (item: EvidenceItem): EvidenceSpan =>
  Match.type<EvidenceItem>().pipe(
    Match.withReturnType<EvidenceSpan>(),
    Match.tag("Scalar", () => "compact"),
    Match.tag("Comparison", () => "medium"),
    Match.tag("Series", () => "wide"),
    Match.tag("Table", () => "full"),
    Match.tag("Text", () => "full"),
    Match.exhaustive
  )(item)

export const spanClassName = (span: EvidenceSpan): string =>
  Match.value(span).pipe(
    Match.when("compact", () => ""),
    Match.when("medium", () => "sm:col-span-2"),
    Match.when("wide", () => "sm:col-span-2 lg:col-span-3"),
    Match.when("full", () => "col-span-full"),
    Match.exhaustive
  )
