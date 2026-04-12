import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import { EntryPresentation } from "../../../contracts/entry/routing.js"
import type { DeepDiveSurfaceFrameViewModel } from "../../../contracts/presentation/surface-presentation.js"
import type {
  SurfaceStageFrameViewModel,
  SurfaceStageViewModel
} from "../../../contracts/presentation/surface-stage.js"
import { EvidenceStatusState } from "../../state/evidence/stream.js"
import { statusText } from "../../state/run/status.js"
import { surfaceStageFrameViewModel, surfaceStageViewModel } from "../../view/deep/surface-stage-input.js"
import { deepDiveSurfaceFrameViewModel } from "../../view/surfaceModel.js"

import {
  surfaceEvidenceCompleteAtom,
  surfaceEvidenceSectionCountAtom,
  surfaceEvidenceStreamAtom
} from "../surface/evidence-store.js"
import { surfaceAtom, surfacePreloadStateAtom, surfaceRunStateAtom, surfaceStageTabAtom } from "../surface/state.js"

export const deepDiveSurfaceFrameAtom: (id: EntryId) => AtomType.Atom<DeepDiveSurfaceFrameViewModel> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) =>
      deepDiveSurfaceFrameViewModel({
        surface: EntryPresentation.fromEntryId(id),
        state: get(surfaceAtom(id))
      })
    )
)

export const deepDiveStatusAtom: (id: EntryId) => AtomType.Atom<string> = Atom.family(
  (id: EntryId) =>
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

export const deepDiveSurfaceStageFrameAtom: (id: EntryId) => AtomType.Atom<SurfaceStageFrameViewModel> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const surface = EntryPresentation.fromEntryId(id)

      return surfaceStageFrameViewModel({
        activeTab: get(surfaceStageTabAtom(id)),
        interactiveLabel: surface.interactiveLabel,
        projectionHint: surface.projectionHint
      })
    })
)

export const deepDiveSurfaceStageAtom: (id: EntryId) => AtomType.Atom<SurfaceStageViewModel> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const surface = EntryPresentation.fromEntryId(id)

      return surfaceStageViewModel({
        activeTab: get(surfaceStageTabAtom(id)),
        interactiveLabel: surface.interactiveLabel,
        projectionHint: surface.projectionHint,
        run: get(surfaceRunStateAtom(id)),
        stream: get(surfaceEvidenceStreamAtom(id))
      })
    })
)
