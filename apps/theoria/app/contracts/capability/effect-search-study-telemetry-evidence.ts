import type { EvidenceItem } from "../evidence/item.js"
import { EvidenceSection, TextItem } from "../evidence/item.js"

import type { EffectSearchStudyLaneTelemetry, EffectSearchStudyTelemetry } from "./effect-search-study-telemetry.js"
import {
  effectSearchStudyRuntimeSectionTitle,
  effectSearchStudyTraceSectionTitle
} from "./effect-search-study-telemetry.js"

const textItem = (label: string, value: string): EvidenceItem => TextItem.make({ _tag: "Text", label, value })

const summaryValue = ({
  budget,
  telemetry
}: {
  readonly budget: number
  readonly telemetry: EffectSearchStudyLaneTelemetry
}): string =>
  `${telemetry.completedTrials}/${budget} completed · ${telemetry.eventCount} events · best ${telemetry.bestValue}`

export const effectSearchStudyTelemetrySections = (
  telemetry: EffectSearchStudyTelemetry
): ReadonlyArray<EvidenceSection> => {
  const traceItems = [
    ...telemetry.tpe.recentSignals.map((signal) => textItem(`TPE · ${signal.label}`, signal.value)),
    ...telemetry.random.recentSignals.map((signal) => textItem(`Random · ${signal.label}`, signal.value))
  ]

  return [
    EvidenceSection.make({
      title: effectSearchStudyRuntimeSectionTitle,
      items: [
        textItem("TPE study", summaryValue({ budget: telemetry.trialBudget, telemetry: telemetry.tpe })),
        textItem("TPE last signal", telemetry.tpe.lastSignal),
        textItem("Random study", summaryValue({ budget: telemetry.trialBudget, telemetry: telemetry.random })),
        textItem("Random last signal", telemetry.random.lastSignal)
      ]
    }),
    EvidenceSection.make({
      title: effectSearchStudyTraceSectionTitle,
      items: traceItems
    })
  ]
}
