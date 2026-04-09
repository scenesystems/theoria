import { Atom } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { StageTab } from "../../state/surface/state.js"

import { modifySurface } from "./internal.js"

type StageTabSelection = { readonly id: EntryId; readonly tab: StageTab }

export const selectStageTabAtom = Atom.fnSync<StageTabSelection>()(
  ({ id, tab }, ctx) => {
    modifySurface(ctx.registry, id, (surface) => ({ ...surface, stageTab: tab }))
  }
)
