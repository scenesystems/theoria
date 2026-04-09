import { Data } from "effect"

import { EvidenceSection, ScalarItem, TableItem, TextItem } from "../../evidence/item.js"
import {
  dspEvaluationSectionTitle,
  dspEvaluationSummary,
  dspEvidenceItemLabels,
  dspMetricScoreLabel,
  dspPerExampleResultColumns
} from "../effect-dsp-runtime-presentation.js"
import type { DspEvaluationPhaseId } from "../effect-dsp-runtime.js"

export class DspEvaluationEvidenceSection extends Data.Class<DspEvaluationEvidenceSection.Shape> {
  static make(section: DspEvaluationEvidenceSection.Shape): DspEvaluationEvidenceSection {
    return new DspEvaluationEvidenceSection(section)
  }

  static project(section: DspEvaluationEvidenceSection.Shape): EvidenceSection {
    const { phaseId, metricName, overallScore, successCount, totalExamples, resultRows } = DspEvaluationEvidenceSection
      .make(section)

    return EvidenceSection.make({
      title: dspEvaluationSectionTitle(phaseId),
      items: [
        TextItem.make({
          _tag: "Text",
          label: dspEvidenceItemLabels.summary,
          value: dspEvaluationSummary({ phaseId, metricName, overallScore, successCount, totalExamples })
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspMetricScoreLabel(metricName),
          value: overallScore,
          unit: "",
          format: "fixed"
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.successes,
          value: successCount,
          unit: `/ ${totalExamples}`,
          format: "integer"
        }),
        TableItem.make({
          _tag: "Table",
          label: dspEvidenceItemLabels.perExampleResults,
          columns: [...dspPerExampleResultColumns],
          rows: resultRows
        })
      ]
    })
  }
}

export namespace DspEvaluationEvidenceSection {
  export interface Shape {
    readonly phaseId: DspEvaluationPhaseId
    readonly metricName: string
    readonly overallScore: number
    readonly successCount: number
    readonly totalExamples: number
    readonly resultRows: ReadonlyArray<ReadonlyArray<string>>
  }
}
