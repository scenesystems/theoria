import { Data } from "effect"
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { createContext, useContext } from "react"

/**
 * A pointer region is the set of surfaces a hover-opened popup treats as
 * "still here": its own popup and any popup opened from inside it. Popups
 * render through portals, so a plain ancestor `pointerleave` fires when the
 * pointer crosses into one of them. The owner provides the region; a
 * descendant popup joins it by forwarding its own pointer enter and leave, and
 * the owner decides what those mean.
 *
 * Touch does not hover; touch pointers are not forwarded.
 */
export class PointerRegion extends Data.Class<{
  readonly enter: () => void
  readonly leave: () => void
}> {}

const nowhere = new PointerRegion({ enter: () => {}, leave: () => {} })

const PointerRegionContext = createContext<PointerRegion>(nowhere)

export const PointerRegionProvider = ({ children, region }: {
  readonly children: ReactNode
  readonly region: PointerRegion
}) => <PointerRegionContext.Provider value={region}>{children}</PointerRegionContext.Provider>

/** The two pointer handlers that make an element part of a region. */
export class PointerRegionHandlers extends Data.Class<{
  readonly onPointerEnter: (event: ReactPointerEvent<Element>) => void
  readonly onPointerLeave: (event: ReactPointerEvent<Element>) => void
}> {}

/** Pointer handlers that make an element part of `region`. */
export const pointerRegionHandlers = (region: PointerRegion): PointerRegionHandlers =>
  new PointerRegionHandlers({
    onPointerEnter: (event) => {
      if (event.pointerType !== "touch") region.enter()
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== "touch") region.leave()
    }
  })

/** Pointer handlers that make an element part of the surrounding region; a no-op outside any region. */
export const usePointerRegionHandlers = (): PointerRegionHandlers =>
  pointerRegionHandlers(useContext(PointerRegionContext))
