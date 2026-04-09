import { Atom } from "@effect-atom/atom"

import {
  deepDiveWorkspaceWidthDefaultPx,
  maxProjectedSurfaceCountForWorkspaceWidth
} from "../../state/surface/deep-dive-lane-model.js"

export const deepDiveWorkspaceWidthAtom = Atom.make<number>(deepDiveWorkspaceWidthDefaultPx).pipe(Atom.keepAlive)

export const deepDiveMaxProjectedSurfaceCountAtom = Atom.make((get) =>
  maxProjectedSurfaceCountForWorkspaceWidth(get(deepDiveWorkspaceWidthAtom))
)
