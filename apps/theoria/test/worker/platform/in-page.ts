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
 * Where every horizontal scroller inside `region` stands: whether it has been
 * scrolled to its end and whether the region stays inside the viewport. A
 * scroller is an element a visitor can scroll sideways, so `overflow-x:
 * hidden` does not count. Reads only; the test scrolls the way a visitor does.
 * An empty result means nothing inside the region scrolls.
 */
export const horizontalScrollers = (
  region: Element
): ReadonlyArray<{ readonly atEnd: boolean; readonly contained: boolean }> =>
  [...region.querySelectorAll<HTMLElement>("*")]
    .filter(
      (element) =>
        element.scrollWidth > element.clientWidth
        && ["auto", "scroll"].includes(getComputedStyle(element).overflowX)
    )
    .map((scroller) => ({
      atEnd: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1,
      contained: region.getBoundingClientRect().right <= document.documentElement.clientWidth
    }))

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

/**
 * The drawn stage's width against the frame and column it is drawn into. The
 * frame's inner width (`clientWidth`, which excludes its border) is what the
 * stage has to draw in, and the frame must never be wider than the column.
 */
export const stageAndColumnWidths = () => {
  const column = document.querySelector("[data-place-stage='column']")
  const frame = column?.querySelector("[data-artifact-stage='frame']")
  const content = document.querySelector("[data-place-stage='content']")
  return {
    column: column?.clientWidth ?? -1,
    drawable: frame?.clientWidth ?? -1,
    frame: frame?.getBoundingClientRect().width ?? -1,
    stage: Number(content?.getAttribute("data-place-stage-width") ?? -1)
  }
}

/** The sheet's height and the trace's top edge: the geometry that must not move while trials are swapped. */
export const stageLayout = () => {
  const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
  const sheet = rect("[data-place-stage='paper']")
  const trace = rect("[data-place-trace]")
  return `${String(Math.round(sheet?.height ?? -1))} ${String(Math.round(trace?.top ?? -1))}`
}

/**
 * Records the paper at every change to the document, from before its first
 * script runs: the paper's `data-place-stage-height` (`-` before there is a
 * paper) and the trace's `data-place-render-phase` (`-` before the first
 * trial is in), one `height phase` line per change, on the root element as
 * `data-paper-frames`. A mutation observer sees each committed state of the
 * document, so no state is lost between samples; installed as an init script,
 * so the navigation that starts the document cannot interrupt it. Read back
 * with `recordedPaperFrames`. Self-contained: an init script is serialised,
 * so it can call nothing else in this module.
 */
export const recordPaperFrames = () => {
  const record = () => {
    const paper = document.querySelector("[data-place-stage='paper']")?.getAttribute("data-place-stage-height")
    const phase = document.querySelector("[data-place-trace]")?.getAttribute("data-place-render-phase")
    const frame = `${paper ?? "-"} ${phase ?? "-"}`
    const seen = (document.documentElement.dataset["paperFrames"] ?? "").split("\n").filter((line) => line.length > 0)
    if (seen.at(-1) === frame) return
    document.documentElement.dataset["paperFrames"] = [...seen, frame].join("\n")
  }
  new MutationObserver(record).observe(document, {
    attributeFilter: ["data-place-stage-height", "data-place-render-phase"],
    attributes: true,
    childList: true,
    subtree: true
  })
}

/** The states `recordPaperFrames` has recorded so far, one `height phase` line each. */
export const recordedPaperFrames = () => document.documentElement.dataset["paperFrames"] ?? ""

/**
 * One frame of the stage in `region` during a merge. `places`: where the
 * feature `name` is painted — its ring (`data-place-marker-arriving`) while
 * the search makes room for it, its disc (`data-place-marker`) once the
 * search has settled; each is placed by `translate`, so two elements at one
 * `translate` stand in one place, and a disc with no `transform` is filled in
 * and at rest. `overlaps`: every line of prose painted over any disc or ring,
 * as line index and feature name — the lines are flowed around the discs as
 * drawn, so every line's box must clear every circle at every frame. A line
 * is painted at its own opacity times its lines container's: a set of lines
 * that has finished leaving stands at opacity 0 for the frame before the
 * next set mounts, and nothing at opacity 0 is painted.
 */
export const mergeFrame = (
  region: Element,
  name: string
): {
  readonly places: ReadonlyArray<
    { readonly kind: "ring" | "disc"; readonly translate: string; readonly transform: string }
  >
  readonly overlaps: ReadonlyArray<string>
} => {
  const place = (kind: "ring" | "disc") => (element: Element) => ({
    kind,
    translate: getComputedStyle(element).translate,
    transform: getComputedStyle(element).transform
  })
  const opacity = (element: Element): number => Number(getComputedStyle(element).opacity)
  const painted = (line: Element): boolean => {
    const container = line.closest("[data-place-lines]")
    return opacity(line) * (container ? opacity(container) : 1) > 0
  }
  const lines = [...region.querySelectorAll("[data-place-line]")]
    .filter(painted)
    .map((element) => ({
      index: element.getAttribute("data-place-line") ?? "",
      rect: element.getBoundingClientRect()
    }))
  const discs = [...region.querySelectorAll("[data-place-marker], [data-place-marker-arriving]")].map((element) => {
    const rect = element.getBoundingClientRect()
    return {
      name: element.getAttribute("data-place-marker") ?? element.getAttribute("data-place-marker-arriving") ?? "",
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      radius: rect.width / 2
    }
  })
  const clamp = (low: number, high: number, value: number) => Math.min(high, Math.max(low, value))
  return {
    places: [
      ...[...region.querySelectorAll(`[data-place-marker-arriving="${name}"]`)].map(place("ring")),
      ...[...region.querySelectorAll(`[data-place-marker="${name}"]`)].map(place("disc"))
    ],
    overlaps: lines.flatMap((line) =>
      discs.flatMap((disc) => {
        // The circle meets the box when the box's nearest point to the centre is within the radius.
        const dx = clamp(line.rect.left, line.rect.right, disc.x) - disc.x
        const dy = clamp(line.rect.top, line.rect.bottom, disc.y) - disc.y
        return line.rect.width > 0 && dx * dx + dy * dy < disc.radius * disc.radius
          ? [`line ${line.index} over ${disc.name}`]
          : []
      })
    )
  }
}

/** Every disc on the stage in `region` is filled in and at rest: none is still arriving or leaving. */
export const discsAtRest = (region: Element): boolean =>
  [...region.querySelectorAll("[data-place-marker]")].every((element) => getComputedStyle(element).transform === "none")

/** Where the band's discs are drawn this frame: each disc's name at its centre, as one string. */
export const bandDiscCentres = (band: Element): string =>
  [...band.querySelectorAll("[data-place-band-disc]")]
    .map((disc) => `${disc.getAttribute("data-place-band-disc") ?? ""}@${disc.getAttribute("cx") ?? ""}`)
    .join(" ")

/** The band draws the disc named, and the paper's drawing is the kept one: a merge has landed in the band. */
export const bandShowsKept = (band: Element, name: string): boolean =>
  [...band.querySelectorAll("[data-place-band-disc]")].filter((disc) =>
      disc.getAttribute("data-place-band-disc") === name
    )
      .length === 1 &&
  document.querySelector("[data-place-stage='paper']")?.getAttribute("data-place-drawn") === "kept"

/** The element's right edge is inside the viewport. */
export const insideViewportRight = (element: Element) => element.getBoundingClientRect().right <= window.innerWidth

/** The element has keyboard focus. */
export const isActiveElement = (element: Element) => element === document.activeElement

/**
 * What keyboard focus rests on, as a visitor's assistive technology would
 * name it: its ARIA role, else its tag. Empty when nothing in the page has focus.
 */
export const activeElementRole = (): string => {
  const element = document.activeElement
  return element instanceof Element && element !== document.body
    ? element.getAttribute("role") ?? element.tagName.toLowerCase()
    : ""
}

/** Keyboard focus is on an element marked `data-docs-link-open`. */
export const activeElementOpensDocsLink = () => document.activeElement?.hasAttribute("data-docs-link-open") ?? false

/** The current path and fragment. */
export const currentLocation = () => location.pathname + location.hash

/**
 * How an element's surface is drawn: its border widths, corner radii and
 * shadow, as the browser computed them. Content on the canvas has none of
 * the three; this is how a test tells a canvas from a card.
 */
export const surfaceStyle = (element: Element) => {
  const style = getComputedStyle(element)
  return {
    border: `${style.borderTopWidth} ${style.borderRightWidth} ${style.borderBottomWidth} ${style.borderLeftWidth}`,
    radius: style.borderRadius,
    shadow: style.boxShadow
  }
}

/**
 * Whether the element's top edge is inside the viewport as it stands, with
 * no scrolling: the question "is this on the first screen?".
 */
export const topEdgeInViewport = (element: Element) => {
  const rect = element.getBoundingClientRect()
  return rect.top >= 0 && rect.top < window.innerHeight && rect.height > 0
}

/** Back to the top of the document, as a fresh load would be. */
export const scrollToTop = () => window.scrollTo(0, 0)

/** Scrolls so the element's top edge stands at the given share of the viewport's height. */
export const scrollElementTo = (element: Element, share: number) => {
  window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight * share)
}

/** Scrolls until the element's bottom edge is just above the viewport: read past. */
export const scrollPast = (element: Element) => {
  window.scrollBy(0, element.getBoundingClientRect().bottom + 1)
}

/** The element's top edge in the document, which scrolling cannot move: where it stands in the flow. */
export const documentTop = (element: Element) => Math.round(element.getBoundingClientRect().top + window.scrollY)

/** The world the root carries, or the empty string off the home page. */
export const rootWorld = () => document.documentElement.dataset["world"] ?? ""

/**
 * The page canvas colour as the visitor sees it: the background of the
 * topmost element painted at the page's left margin, halfway down the
 * viewport, where nothing but the canvas stands. An element that paints no
 * colour of its own lets the one beneath it through, so a root that covered
 * the body with its own colour would be reported, not the body.
 */
export const canvasColour = () => {
  const painted = document.elementsFromPoint(2, window.innerHeight / 2)
    .map((element) => getComputedStyle(element).backgroundColor)
    .find((colour) => colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent")
  return painted ?? "none"
}

/** The element's text colour, as painted. */
export const textColour = (element: Element) => getComputedStyle(element).color

/**
 * The lowest WCAG contrast ratio between the prose on the paper and the two
 * colours the paper is painted with, `--th-world-paper` and
 * `--th-world-paper-edge`, in the world and mode the root is in now. The
 * paper is a gradient between the two, so the prose must read against both.
 * Colours are read as the browser paints them: a probe element takes each
 * variable as its background and reports the computed `rgb(...)`.
 */
export const paperProseContrast = (): number => {
  const channel = (value: number): number => {
    const share = value / 255
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4
  }
  const luminance = (rgb: string): number => {
    const [r = 0, g = 0, b = 0] = (rgb.match(/[\d.]+/gu) ?? []).map(Number)
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (a: string, b: string): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
  }
  const painted = (variable: string): string => {
    const probe = document.body.appendChild(document.createElement("div"))
    probe.style.backgroundColor = `var(${variable})`
    const colour = getComputedStyle(probe).backgroundColor
    probe.remove()
    return colour
  }
  const papers = [painted("--th-world-paper"), painted("--th-world-paper-edge")]
  const ratios = [...document.querySelectorAll("[data-place-line] span")].flatMap((line) => {
    const ink = getComputedStyle(line).color
    return papers.map((paper) => contrast(ink, paper))
  })
  return ratios.length > 0 ? Math.min(...ratios) : 0
}
