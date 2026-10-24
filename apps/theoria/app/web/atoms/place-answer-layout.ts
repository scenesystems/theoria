import { RegistryContext } from "@effect/atom-react"
import { Equal } from "effect"
import { Atom } from "effect/reactivity"
import { useContext, useMemo } from "react"

import { placements } from "../platform/PlaceAnswerLayout.js"
import { observeOnMount } from "./element-observation.js"
import { appRuntime } from "./runtime.js"

const layout = Atom.family((element: HTMLElement) => appRuntime.atom(placements(element)).pipe(Atom.setIdleTTL(0)))

/** Ref cleanup interrupts observation immediately; no detached popup is retained. */
export const usePlaceAnswerLayout = () => {
  const registry = useContext(RegistryContext)
  return useMemo(
    () => observeOnMount<HTMLDivElement>((element) => registry.mount(layout(Equal.byReferenceUnsafe(element)))),
    [registry]
  )
}
