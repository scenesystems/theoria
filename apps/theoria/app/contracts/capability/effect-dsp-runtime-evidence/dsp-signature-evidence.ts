import { Data } from "effect"
import * as Arr from "effect/Array"

import { EvidenceSection, ScalarItem, TextItem } from "../../evidence/item.js"
import { dspEvidenceItemLabels, dspEvidenceTitles } from "../effect-dsp-runtime-presentation.js"
import type { DspScenarioDefinition } from "../effect-dsp.js"

export class DspSignatureEvidenceSection extends Data.Class<DspSignatureEvidenceSection.Shape> {
  static make(section: DspSignatureEvidenceSection.Shape): DspSignatureEvidenceSection {
    return new DspSignatureEvidenceSection(section)
  }

  static project(scenario: DspScenarioDefinition): EvidenceSection {
    const section = DspSignatureEvidenceSection.make({ scenario })

    return EvidenceSection.make({
      title: dspEvidenceTitles.signatureContract,
      items: [
        TextItem.make({
          _tag: "Text",
          label: dspEvidenceItemLabels.instruction,
          value: section.scenario.contract.instruction
        }),
        TextItem.make({
          _tag: "Text",
          label: dspEvidenceItemLabels.inputFields,
          value: Arr.map(section.scenario.contract.inputFields, (field) => field.name).join(", ")
        }),
        TextItem.make({
          _tag: "Text",
          label: dspEvidenceItemLabels.outputFields,
          value: Arr.map(section.scenario.contract.outputFields, (field) => field.name).join(", ")
        }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.fieldCount,
          value: section.scenario.contract.inputFields.length +
            section.scenario.contract.outputFields.length,
          unit: "fields",
          format: "integer"
        })
      ]
    })
  }
}

export namespace DspSignatureEvidenceSection {
  export interface Shape {
    readonly scenario: DspScenarioDefinition
  }
}
