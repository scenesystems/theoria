import { Atom } from "@effect-atom/atom"

import { clearDeepDiveDraggedSurfaceAtom } from "./deep-dive-layout.js"

export const deepDiveProjectionMenuOpenAtom = Atom.make(false).pipe(Atom.keepAlive)

export const setDeepDiveProjectionMenuOpenAtom = Atom.fnSync<boolean>()(
  (open, ctx) => {
    ctx.set(deepDiveProjectionMenuOpenAtom, open)

    if (!open) {
      ctx.set(clearDeepDiveDraggedSurfaceAtom, undefined)
    }
  }
)
