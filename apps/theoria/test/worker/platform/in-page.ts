/**
 * Functions Playwright serialises and runs inside the page.
 *
 * This is the test side of the browser boundary: the one module in test code
 * that names the page's globals, just as `apps/theoria/app/web/platform/` is
 * the one module in shipped code that does. Each function is self-contained,
 * because Playwright sends its source to the browser and nothing from this
 * module's scope travels with it. Pass them to `page.evaluate`,
 * `locator.evaluate`, `locator.evaluateAll` or `page.waitForFunction`.
 */

/** The document does not scroll horizontally at the current viewport. */
export const documentFitsViewport = () => document.documentElement.scrollWidth <= window.innerWidth

/** Every finite animation (CSS and Web Animations) has finished; infinite ones are ignored. */
export const finiteAnimationsFinished = () =>
  document.getAnimations().every((animation) =>
    animation.playState === "finished" || animation.effect?.getComputedTiming().iterations === Infinity
  )

/**
 * Elements painted past the right edge of the viewport, described by tag,
 * classes and right edge. Content inside an ancestor that itself fits and
 * scrolls (code listings, tab strips) or clips (`overflow: clip` decoration)
 * is not painted past the edge, so only the ancestor counts.
 */
export const elementsPastViewport = (): ReadonlyArray<string> => {
  const limit = window.innerWidth + 1
  const clips = (element: Element) => ["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(element).overflowX)
  const clippedByAncestor = (element: Element): boolean => {
    const ancestor = element.parentElement
    return ancestor instanceof Element && ancestor !== document.body &&
      ((clips(ancestor) && ancestor.getBoundingClientRect().right <= limit) || clippedByAncestor(ancestor))
  }
  const describe = (element: Element) =>
    `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}@${
      String(Math.round(element.getBoundingClientRect().right))
    }`
  return [...document.querySelectorAll("body *")]
    .filter((element) => element.getBoundingClientRect().right > limit)
    .filter((element) => !clippedByAncestor(element))
    .map(describe)
}

/** The number of distinct text colours painted inside `root`, root included. */
export const distinctTextColours = (root: Element) =>
  [root, ...root.querySelectorAll("*")]
    .map((element) => getComputedStyle(element).color)
    .filter((colour, index, colours) => colours.indexOf(colour) === index)
    .length

/** The page's clipboard text; needs the `clipboard-read` permission. */
export const clipboardText = () => navigator.clipboard.readText()

/** Sets the root font size, the way a visitor's browser text-size setting does. */
export const setRootFontSize = (size: string) => {
  document.documentElement.style.fontSize = size
}

/**
 * For every horizontal scroller inside `region`, scrolls it to the end and
 * reports whether the end is reachable and the region stays inside the
 * viewport. An empty result means nothing inside the region scrolls.
 */
export const scrollersAtEnd = (
  region: Element
): ReadonlyArray<{ readonly atEnd: boolean; readonly contained: boolean }> =>
  [...region.querySelectorAll<HTMLElement>("*")]
    .filter((element) => element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX !== "visible")
    .map((scroller) => {
      scroller.scrollLeft = scroller.scrollWidth
      return {
        atEnd: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1,
        contained: region.getBoundingClientRect().right <= document.documentElement.clientWidth
      }
    })

/** Every marker's position relative to the place stage, so scrolling cannot move it. */
export const markerPositionsInStage = (markers: ReadonlyArray<Element>) => {
  const stage = document.querySelector("[data-place-stage='content']")?.getBoundingClientRect()
  return markers
    .map((marker) => {
      const rect = marker.getBoundingClientRect()
      return `${String(Math.round(rect.x - (stage?.x ?? 0)))},${String(Math.round(rect.y - (stage?.y ?? 0)))}`
    })
    .join(" ")
}

/** The sheet's height and the trace's top edge: the geometry that must not move while trials are swapped. */
export const stageLayout = () => {
  const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
  const sheet = rect("[data-place-stage='paper']")
  const trace = rect("[data-place-trace]")
  return `${String(Math.round(sheet?.height ?? -1))} ${String(Math.round(trace?.top ?? -1))}`
}

/** The element's right edge is inside the viewport. */
export const insideViewportRight = (element: Element) => element.getBoundingClientRect().right <= window.innerWidth

/** The element has keyboard focus. */
export const isActiveElement = (element: Element) => element === document.activeElement

/** Keyboard focus is on an element marked `data-docs-link-open`. */
export const activeElementOpensDocsLink = () => document.activeElement?.hasAttribute("data-docs-link-open") ?? false

/** The current path and fragment. */
export const currentLocation = () => location.pathname + location.hash
