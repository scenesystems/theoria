import { Data } from "effect"

import { EvidenceSection, ScalarItem, TextItem } from "../../evidence/item.js"
import { dspEvidenceItemLabels, dspEvidenceTitles } from "../effect-dsp-runtime-presentation.js"

export class DspProviderEvidenceSection extends Data.Class<DspProviderEvidenceSection.Shape> {
  static make(section: DspProviderEvidenceSection.Shape): DspProviderEvidenceSection {
    return new DspProviderEvidenceSection(section)
  }

  static project(section: DspProviderEvidenceSection.Shape): EvidenceSection {
    const { provider, model, durationMs } = DspProviderEvidenceSection.make(section)

    return EvidenceSection.make({
      title: dspEvidenceTitles.provider,
      items: [
        TextItem.make({ _tag: "Text", label: dspEvidenceItemLabels.provider, value: provider }),
        TextItem.make({ _tag: "Text", label: dspEvidenceItemLabels.model, value: model }),
        ScalarItem.make({
          _tag: "Scalar",
          label: dspEvidenceItemLabels.totalDuration,
          value: durationMs,
          unit: "ms",
          format: "fixed"
        })
      ]
    })
  }
}

export namespace DspProviderEvidenceSection {
  export interface Shape {
    readonly provider: string
    readonly model: string
    readonly durationMs: number
  }
}
