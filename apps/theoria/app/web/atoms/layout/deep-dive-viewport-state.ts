import { Atom } from "@effect-atom/atom"

import {
  deepDiveWorkspaceWidthDefaultPx,
  maxProjectedSurfaceCountForWorkspaceWidth
} from "../../../contracts/presentation/deep-dive-projection-order-state.js"

export const deepDiveWorkspaceWidthAtom = Atom.make<number>(deepDiveWorkspaceWidthDefaultPx).pipe(Atom.keepAlive)

export const deepDiveMaxProjectedSurfaceCountAtom = Atom.make((get) =>
  maxProjectedSurfaceCountForWorkspaceWidth(get(deepDiveWorkspaceWidthAtom))
)
