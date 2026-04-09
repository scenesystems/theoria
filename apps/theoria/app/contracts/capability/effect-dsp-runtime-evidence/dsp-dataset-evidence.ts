import { Data } from "effect"
import * as Arr from "effect/Array"

import { EvidenceSection, TableItem } from "../../evidence/item.js"
import { dspEvaluationDatasetTitle, dspEvidenceItemLabels } from "../effect-dsp-runtime-presentation.js"
import type { DspScenarioDefinition } from "../effect-dsp.js"

const truncate = (value: string, max: number): string => value.length > max ? `${value.slice(0, max)}...` : value

export class DspDatasetEvidenceSection extends Data.Class<DspDatasetEvidenceSection.Shape> {
  static make(section: DspDatasetEvidenceSection.Shape): DspDatasetEvidenceSection {
    return new DspDatasetEvidenceSection(section)
  }

  static project(scenario: DspScenarioDefinition): EvidenceSection {
    const section = DspDatasetEvidenceSection.make({ scenario })

    return EvidenceSection.make({
      title: dspEvaluationDatasetTitle(section.scenario.examples.length),
      items: [TableItem.make({
        _tag: "Table",
        label: dspEvidenceItemLabels.evaluationExamples,
        columns: [
          "#",
          ...Arr.map(section.scenario.contract.inputFields, (field) => field.name),
          ...Arr.map(section.scenario.contract.outputFields, (field) => `→ ${field.name}`)
        ],
        rows: Arr.map(section.scenario.examples, (example, index) => [
          `${index + 1}`,
          ...Arr.map(section.scenario.contract.inputFields, (field) => truncate(example.input[field.name] ?? "", 80)),
          ...Arr.map(
            section.scenario.contract.outputFields,
            (field) => truncate(example.expected[field.name] ?? "", 80)
          )
        ])
      })]
    })
  }
}

export namespace DspDatasetEvidenceSection {
  export interface Shape {
    readonly scenario: DspScenarioDefinition
  }
}
