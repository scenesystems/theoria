import { Data } from "effect"

import { EvidenceSection, ScalarItem } from "../../evidence/item.js"
import { dspEvidenceItemLabels, dspEvidenceTitles } from "../effect-dsp-runtime-presentation.js"

export class DspOutcomeEvidenceSection extends Data.Class<DspOutcomeEvidenceSection.Shape> {
  static make(section: DspOutcomeEvidenceSection.Shape): DspOutcomeEvidenceSection {
    return new DspOutcomeEvidenceSection(section)
  }

  static project(section: DspOutcomeEvidenceSection.Shape): EvidenceSection {
    const { baselineScore, optimizedScore, improvementDelta, learnedDemos } = DspOutcomeEvidenceSection.make(section)

    return EvidenceSection.make({
      title: dspEvidenceTitles.optimizationOutcome,
      items: [
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.baselineScore,
          value: baselineScore,
          unit: "",
          format: "fixed"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.optimizedScore,
          value: optimizedScore,
          unit: "",
          format: "fixed"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.improvement,
          value: improvementDelta,
          unit: "",
          format: "fixed"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.learnedExamples,
          value: learnedDemos,
          unit: "examples",
          format: "integer"
        })
      ]
    })
  }
}

export namespace DspOutcomeEvidenceSection {
  export interface Shape {
    readonly baselineScore: number
    readonly optimizedScore: number
    readonly improvementDelta: number
    readonly learnedDemos: number
  }
}
