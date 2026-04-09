import { Data } from "effect"

import { EvidenceSection, ScalarItem, TextItem } from "../../evidence/item.js"
import { dspEvidenceItemLabels, dspEvidenceTitles, dspFallbackText } from "../effect-dsp-runtime-presentation.js"

export class DspOptimizationEvidenceSection extends Data.Class<DspOptimizationEvidenceSection.Shape> {
  static make(section: DspOptimizationEvidenceSection.Shape): DspOptimizationEvidenceSection {
    return new DspOptimizationEvidenceSection(section)
  }

  static project(section: DspOptimizationEvidenceSection.Shape): EvidenceSection {
    const { requestedRounds, roundsUsed, learnedDemos, acceptedTraces, rejectedTraces, fallbackUsed } =
      DspOptimizationEvidenceSection.make(section)

    return EvidenceSection.make({
      title: dspEvidenceTitles.optimization,
      items: [
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.requestedRounds,
          value: requestedRounds,
          unit: "rounds",
          format: "integer"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.roundsUsed,
          value: roundsUsed,
          unit: "rounds",
          format: "integer"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.learnedExamples,
          value: learnedDemos,
          unit: "examples",
          format: "integer"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.acceptedTraces,
          value: acceptedTraces,
          unit: "traces",
          format: "integer"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.rejectedTraces,
          value: rejectedTraces,
          unit: "traces",
          format: "integer"
        }),
        TextItem.make({ _tag: "Text", label: dspEvidenceItemLabels.fallback, value: dspFallbackText(fallbackUsed) })
      ]
    })
  }
}

export namespace DspOptimizationEvidenceSection {
  export interface Shape {
    readonly requestedRounds: number
    readonly roundsUsed: number
    readonly learnedDemos: number
    readonly acceptedTraces: number
    readonly rejectedTraces: number
    readonly fallbackUsed: boolean
  }
}
