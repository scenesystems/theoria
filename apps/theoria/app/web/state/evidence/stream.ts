import { Data } from "effect"

import type { Metadata } from "../../../contracts/envelope.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import type { EvidenceStore } from "../../../contracts/evidence/store.js"
import type { RunData } from "../../../contracts/study/run.js"

export class EvidenceStatusState extends Data.Class<EvidenceStatusState.Shape> {
  static make(status: EvidenceStatusState.Shape): EvidenceStatusState {
    return new EvidenceStatusState(status)
  }

  static empty(): EvidenceStatusState {
    return EvidenceStatusState.make({ complete: false, sectionCount: 0 })
  }

  static fromStore(state: EvidenceStore): EvidenceStatusState {
    return EvidenceStatusState.make({
      complete: state.complete,
      sectionCount: state.sectionCount()
    })
  }

  static fromStream(state: EvidenceStreamState): EvidenceStatusState {
    return EvidenceStatusState.make({
      complete: state.complete,
      sectionCount: state.sections.length
    })
  }
}

export namespace EvidenceStatusState {
  export interface Shape {
    readonly complete: boolean
    readonly sectionCount: number
  }
}

export class EvidenceStreamState extends Data.Class<EvidenceStreamState.Shape> {
  static make(state: EvidenceStreamState.Shape): EvidenceStreamState {
    return new EvidenceStreamState(state)
  }

  static empty(): EvidenceStreamState {
    return EvidenceStreamState.make({
      sections: [],
      complete: false,
      summary: null,
      meta: null
    })
  }

  static fromStore(state: EvidenceStore): EvidenceStreamState {
    return EvidenceStreamState.make({
      sections: state.sections(),
      complete: state.complete,
      summary: state.summary,
      meta: state.meta
    })
  }

  static fromSuccess({
    data,
    meta
  }: {
    readonly data: RunData
    readonly meta: Metadata | null
  }): EvidenceStreamState {
    return EvidenceStreamState.make({
      sections: data.sections,
      complete: true,
      summary: data.summary,
      meta
    })
  }

  status(): EvidenceStatusState {
    return EvidenceStatusState.fromStream(this)
  }
}

export namespace EvidenceStreamState {
  export interface Shape {
    readonly sections: ReadonlyArray<EvidenceSection>
    readonly complete: boolean
    readonly summary: string | null
    readonly meta: Metadata | null
  }
}
