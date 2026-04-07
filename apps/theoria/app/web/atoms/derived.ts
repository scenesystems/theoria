import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Option, Schema } from "effect"

import { cardById } from "../../contracts/card.js"
import { Id } from "../../contracts/id.js"
import type { Id as IdType, SurfaceId } from "../../contracts/id.js"
import type { SurfaceVariant } from "../../contracts/presentation.js"
import { publishedConsumerPresentationForId } from "../../contracts/proving-substrate.js"
import type { RunData } from "../../contracts/run.js"
import { statusText } from "../state/status.js"
import { buildEvidencePlaneViewModel, type EvidencePlaneViewModel } from "../view/data/evidence-layout.js"
import { tabHintFor } from "../view/deep/interactiveMetadata.js"
import {
  type DemoEvidenceViewModel,
  demoEvidenceViewModel,
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

import { surfaceEvidencePlaneAtom } from "./evidence-plane.js"
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
} from "./surface.js"

type ViewModelKey = `${IdType}:${SurfaceVariant}`

export const viewModelKey = (id: IdType, variant: SurfaceVariant): ViewModelKey => `${id}:${variant}`

const isId = Schema.is(Id)

export const surfaceViewModelAtom: (key: ViewModelKey) => AtomType.Atom<SurfaceViewModel | null> = Atom.family(
  (key: ViewModelKey) => {
    const separatorIndex = key.lastIndexOf(":")
    const rawId = key.slice(0, separatorIndex)
    const variant: SurfaceVariant = key.slice(separatorIndex + 1) === "compact" ? "compact" : "expanded"

    if (!isId(rawId)) {
      return Atom.make(() => null)
    }

    const id = rawId
    return Atom.make((get: AtomType.Context) =>
      Option.match(cardById(id), {
        onNone: () => null,
        onSome: (card) => {
          const state = get(surfaceAtom(id))
          const presented = get(presentedRunAtom(id))
          const stream = get(surfaceEvidenceStreamAtom(id))
          return surfaceViewModel({
            surface: publishedConsumerPresentationForId(card.id),
            presented,
            state,
            stream,
            variant
          })
        }
      })
    )
  }
)

export const deepDiveSurfaceFrameAtom: (id: SurfaceId) => AtomType.Atom<DeepDiveSurfaceFrameViewModel> = Atom
  .family(
    (id: SurfaceId) =>
      Atom.make((get: AtomType.Context) =>
        deepDiveSurfaceFrameViewModel({
          surface: publishedConsumerPresentationForId(id),
          state: get(surfaceAtom(id))
        })
      )
  )

export const deepDiveStatusAtom: (id: SurfaceId) => AtomType.Atom<string> = Atom.family(
  (id: SurfaceId) =>
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

export const deepDiveStageFrameAtom: (id: SurfaceId) => AtomType.Atom<DemoStageFrameViewModel> = Atom.family(
  (id: SurfaceId) =>
    Atom.make((get: AtomType.Context) => {
      const surface = publishedConsumerPresentationForId(id)

      return demoStageFrameViewModel({
        activeTab: get(surfaceStageTabAtom(id)),
        interactiveLabel: surface.interactiveLabel,
        tabHint: tabHintFor(surface.consumerId)
      })
    })
)

type DeepDiveEvidenceAtomViewModel = DemoEvidenceViewModel & {
  readonly plane: EvidencePlaneViewModel
}

export const deepDiveEvidenceAtom: (id: SurfaceId) => AtomType.Atom<DeepDiveEvidenceAtomViewModel> = Atom.family(
  (id: SurfaceId) =>
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

export const deepDiveStageAtom: (id: SurfaceId) => AtomType.Atom<DemoStageViewModel> = Atom.family(
  (id: SurfaceId) =>
    Atom.make((get: AtomType.Context) => {
      const surface = publishedConsumerPresentationForId(id)

      return demoStageViewModel({
        activeTab: get(surfaceStageTabAtom(id)),
        interactiveLabel: surface.interactiveLabel,
        run: get(surfaceRunStateAtom(id)),
        stream: get(surfaceEvidenceStreamAtom(id)),
        tabHint: tabHintFor(surface.consumerId)
      })
    })
)

export const presentedRunAtom: (id: SurfaceId) => AtomType.Atom<PresentedRun | null> = Atom.family(
  (id: SurfaceId) =>
    Atom.make((get: AtomType.Context) => {
      const runData: RunData | null = get(surfaceRunDataAtom(id))
      return runData !== null ? presentRun(runData) : null
    })
)
