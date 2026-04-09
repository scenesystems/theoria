import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Schema } from "effect"

import { EntryId } from "../../contracts/entry/id.js"
import type { EntryId as EntryIdType } from "../../contracts/entry/id.js"
import { entryInteractiveLabelForId, entryPresentationForId } from "../../contracts/entry/routing.js"
import type { SurfaceVariant } from "../../contracts/presentation/program.js"
import type { RunData } from "../../contracts/study/run.js"
import { tabHintFor } from "../runtime/kernel/surface-view.js"
import { EvidenceStatusState } from "../state/evidence/stream.js"
import type { RunEvidenceState } from "../state/run/evidence.js"
import { runEvidenceState } from "../state/run/evidence.js"
import { statusText } from "../state/run/status.js"
import { buildEvidencePlaneViewModel, type EvidencePlaneViewModel } from "../view/data/evidence-plane-model.js"
import {
  type SurfaceStageFrameViewModel,
  surfaceStageFrameViewModel,
  type SurfaceStageViewModel,
  surfaceStageViewModel
} from "../view/deep/surface-stage-model.js"
import { type PresentedRun, presentRun } from "../view/presenter.js"
import {
  type DeepDiveSurfaceFrameViewModel,
  deepDiveSurfaceFrameViewModel,
  type SurfaceViewModel,
  surfaceViewModel
} from "../view/surfaceModel.js"

import { surfaceEvidencePlaneAtom } from "./evidence/plane.js"
import {
  surfaceEvidenceCompleteAtom,
  surfaceEvidenceMetaAtom,
  surfaceEvidenceSectionCountAtom,
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStreamAtom,
  surfaceEvidenceSummaryAtom
} from "./surface/evidence-store.js"
import {
  surfaceAtom,
  surfacePreloadStateAtom,
  surfaceRunDataAtom,
  surfaceRunStateAtom,
  surfaceStageTabAtom
} from "./surface/state.js"

type ViewModelKey = `${EntryIdType}:${SurfaceVariant}`

export const viewModelKey = (id: EntryIdType, variant: SurfaceVariant): ViewModelKey => `${id}:${variant}`

const isEntryId = Schema.is(EntryId)

export const surfaceViewModelAtom: (key: ViewModelKey) => AtomType.Atom<SurfaceViewModel | null> = Atom.family(
  (key: ViewModelKey) => {
    const separatorIndex = key.lastIndexOf(":")
    const rawId = key.slice(0, separatorIndex)
    const variant: SurfaceVariant = key.slice(separatorIndex + 1) === "compact" ? "compact" : "expanded"

    if (!isEntryId(rawId)) {
      return Atom.make(() => null)
    }

    const id = rawId
    return Atom.make((get: AtomType.Context) => {
      const state = get(surfaceAtom(id))
      const presented = get(presentedRunAtom(id))
      const stream = get(surfaceEvidenceStreamAtom(id))

      return surfaceViewModel({
        surface: entryPresentationForId(id),
        presented,
        state,
        stream,
        variant
      })
    })
  }
)

export const deepDiveSurfaceFrameAtom: (id: EntryIdType) => AtomType.Atom<DeepDiveSurfaceFrameViewModel> = Atom
  .family(
    (id: EntryIdType) =>
      Atom.make((get: AtomType.Context) =>
        deepDiveSurfaceFrameViewModel({
          surface: entryPresentationForId(id),
          state: get(surfaceAtom(id))
        })
      )
  )

export const deepDiveStatusAtom: (id: EntryIdType) => AtomType.Atom<string> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) =>
      statusText(
        {
          preload: get(surfacePreloadStateAtom(id)),
          run: get(surfaceRunStateAtom(id))
        },
        EvidenceStatusState.make({
          complete: get(surfaceEvidenceCompleteAtom(id)),
          sectionCount: get(surfaceEvidenceSectionCountAtom(id))
        })
      )
    )
)

export const deepDiveSurfaceStageFrameAtom: (id: EntryIdType) => AtomType.Atom<SurfaceStageFrameViewModel> = Atom
  .family(
    (id: EntryIdType) =>
      Atom.make((get: AtomType.Context) =>
        surfaceStageFrameViewModel({
          activeTab: get(surfaceStageTabAtom(id)),
          interactiveLabel: entryInteractiveLabelForId(id),
          tabHint: tabHintFor(id)
        })
      )
  )

type DeepDiveEvidenceAtomViewModel = RunEvidenceState & {
  readonly plane: EvidencePlaneViewModel
}

export const deepDiveEvidenceAtom: (id: EntryIdType) => AtomType.Atom<DeepDiveEvidenceAtomViewModel> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      const stream = get(surfaceEvidenceStreamAtom(id))
      const plane = get(surfaceEvidencePlaneAtom(id))

      return {
        ...runEvidenceState({ run, stream }),
        plane: buildEvidencePlaneViewModel({
          complete: get(surfaceEvidenceCompleteAtom(id)),
          filter: plane.filter,
          meta: get(surfaceEvidenceMetaAtom(id)),
          order: plane.order,
          sections: get(surfaceEvidenceSectionsAtom(id)),
          sectionKey: plane.sectionKey,
          summary: get(surfaceEvidenceSummaryAtom(id))
        })
      }
    })
)

export const deepDiveSurfaceStageAtom: (id: EntryIdType) => AtomType.Atom<SurfaceStageViewModel> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) =>
      surfaceStageViewModel({
        activeTab: get(surfaceStageTabAtom(id)),
        interactiveLabel: entryInteractiveLabelForId(id),
        run: get(surfaceRunStateAtom(id)),
        stream: get(surfaceEvidenceStreamAtom(id)),
        tabHint: tabHintFor(id)
      })
    )
)

export const presentedRunAtom: (id: EntryIdType) => AtomType.Atom<PresentedRun | null> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) => {
      const runData: RunData | null = get(surfaceRunDataAtom(id))
      return runData !== null ? presentRun(runData) : null
    })
)
