import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Schema } from "effect"

import { EntryId } from "../../contracts/entry/id.js"
import type { EntryId as EntryIdType } from "../../contracts/entry/id.js"
import { entryPresentationForId } from "../../contracts/entry/routing.js"
import type { SurfaceVariant } from "../../contracts/presentation/program.js"
import type { RunData } from "../../contracts/study/run.js"
import { statusText } from "../state/run/status.js"
import { buildEvidencePlaneViewModel, type EvidencePlaneViewModel } from "../view/data/evidence-layout.js"
import { tabHintFor } from "../view/deep/interactiveMetadata.js"
import { type DemoEvidenceViewModel, demoEvidenceViewModel } from "../view/deep/stageEvidenceModel.js"
import {
  type DemoStageFrameViewModel,
  demoStageFrameViewModel,
  type DemoStageViewModel,
  demoStageViewModel
} from "../view/deep/stageModel.js"
import { type PresentedRun, presentRun } from "../view/presenter.js"
import {
  type DeepDiveSurfaceFrameViewModel,
  deepDiveSurfaceFrameViewModel,
  type SurfaceViewModel,
  surfaceViewModel
} from "../view/surfaceModel.js"

import { surfaceEvidencePlaneAtom } from "./evidence/plane.js"
import {
  surfaceAtom,
  surfaceEvidenceCompleteAtom,
  surfaceEvidenceMetaAtom,
  surfaceEvidenceSectionCountAtom,
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStreamAtom,
  surfaceEvidenceSummaryAtom,
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
        {
          complete: false,
          sectionCount: get(surfaceEvidenceSectionCountAtom(id))
        }
      )
    )
)

export const deepDiveStageFrameAtom: (id: EntryIdType) => AtomType.Atom<DemoStageFrameViewModel> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) => {
      const surface = entryPresentationForId(id)

      return demoStageFrameViewModel({
        activeTab: get(surfaceStageTabAtom(id)),
        interactiveLabel: surface.interactiveLabel,
        tabHint: tabHintFor(surface.entryId)
      })
    })
)

type DeepDiveEvidenceAtomViewModel = DemoEvidenceViewModel & {
  readonly plane: EvidencePlaneViewModel
}

export const deepDiveEvidenceAtom: (id: EntryIdType) => AtomType.Atom<DeepDiveEvidenceAtomViewModel> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      const stream = get(surfaceEvidenceStreamAtom(id))
      const plane = get(surfaceEvidencePlaneAtom(id))

      return {
        ...demoEvidenceViewModel({ run, stream }),
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

export const deepDiveStageAtom: (id: EntryIdType) => AtomType.Atom<DemoStageViewModel> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) => {
      const surface = entryPresentationForId(id)

      return demoStageViewModel({
        activeTab: get(surfaceStageTabAtom(id)),
        interactiveLabel: surface.interactiveLabel,
        run: get(surfaceRunStateAtom(id)),
        stream: get(surfaceEvidenceStreamAtom(id)),
        tabHint: tabHintFor(surface.entryId)
      })
    })
)

export const presentedRunAtom: (id: EntryIdType) => AtomType.Atom<PresentedRun | null> = Atom.family(
  (id: EntryIdType) =>
    Atom.make((get: AtomType.Context) => {
      const runData: RunData | null = get(surfaceRunDataAtom(id))
      return runData !== null ? presentRun(runData) : null
    })
)
