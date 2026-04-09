import { Data } from "effect"

import { EvidenceSection, ScalarItem, TextItem } from "../../evidence/item.js"
import { dspEvidenceItemLabels, dspEvidenceTitles } from "../effect-dsp-runtime-presentation.js"
import type { DspModuleType, DspScenarioDefinition } from "../effect-dsp.js"

export class DspScenarioEvidenceSection extends Data.Class<DspScenarioEvidenceSection.Shape> {
  static make(section: DspScenarioEvidenceSection.Shape): DspScenarioEvidenceSection {
    return new DspScenarioEvidenceSection(section)
  }

  static project(section: DspScenarioEvidenceSection.Shape): EvidenceSection {
    const { moduleType, optimizationBudget, scenario } = DspScenarioEvidenceSection.make(section)

    return EvidenceSection.make({
      title: dspEvidenceTitles.scenario,
      items: [
        TextItem.make({ _tag: "Text", label: dspEvidenceItemLabels.scenario, value: scenario.label }),
        TextItem.make({
          _tag: "Text",
          label: dspEvidenceItemLabels.invariant,
          value: `${scenario.invariant} — ${scenario.invariantDescription}`
        }),
        TextItem.make({ _tag: "Text", label: dspEvidenceItemLabels.moduleType, value: moduleType }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.optimizationBudget,
          value: optimizationBudget,
          unit: "rounds",
          format: "integer"
        }),
        TextItem.make({
          _tag: "Text",
          label: dspEvidenceItemLabels.metric,
          value: `${scenario.metricName} — ${scenario.metricDescription}`
        })
      ]
    })
  }
}

export namespace DspScenarioEvidenceSection {
  export interface Shape {
    readonly moduleType: DspModuleType
    readonly optimizationBudget: number
    readonly scenario: DspScenarioDefinition
  }
}
