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

/** The resolved value of a CSS system colour in the page's current colour scheme. */
export const systemColour = (name: string): string => {
  const probe = document.createElement("span")
  probe.style.color = name
  probe.hidden = true
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

/**
 * The edges each element is painted with: its outline, and its left border —
 * the side a rule down an element's edge is drawn on, and the same as every
 * other side for a knot or a disc. For `evaluateAll`, one locator or many.
 */
export const edgesOf = (elements: ReadonlyArray<Element>): ReadonlyArray<{
  readonly outline: { readonly color: string; readonly style: string; readonly width: number }
  readonly border: { readonly color: string; readonly style: string; readonly width: number }
}> =>
  elements.map((element) => {
    const style = getComputedStyle(element)
    return {
      outline: {
        color: style.outlineColor,
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth)
      },
      border: {
        color: style.borderLeftColor,
        style: style.borderLeftStyle,
        width: Number.parseFloat(style.borderLeftWidth)
      }
    }
  })

/** The document does not scroll horizontally at the current viewport. */
export const documentFitsViewport = () => document.documentElement.scrollWidth <= window.innerWidth

/**
 * The painted-surface budget below `root`.
 *
 * An enclosure has a visible computed border of at least 1px on all four sides
 * and a box larger than 24×24px. A drop shadow is a non-inset shadow layer with
 * visible colour and a non-zero offset or blur; spread-only rings do not count.
 * The deepest enclosure chain is each enclosure plus its enclosure ancestors.
 */
export const surfaceBudget = (root: Element) => {
  const elements = [...root.querySelectorAll("*")].filter((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
  })
  const visibleColour = (colour: string) => colour !== "transparent" && !colour.includes(", 0)")
  const enclosed = (element: Element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const sides = ["Top", "Right", "Bottom", "Left"]
    return rect.width > 24 && rect.height > 24 &&
      sides.every((side) =>
        Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 1
        && style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none"
        && visibleColour(style.getPropertyValue(`border-${side.toLowerCase()}-color`))
      )
  }
  const describe = (element: Element) => {
    const attributes = [...element.attributes]
      .filter((attribute) => attribute.name.startsWith("data-") || attribute.name === "aria-label")
      .map((attribute) => `[${attribute.name}='${attribute.value}']`)
      .join("")
    return `${element.tagName.toLowerCase()}${attributes}`
  }
  const enclosureElements = elements.filter(enclosed)
  const hasDropShadow = (element: Element) =>
    getComputedStyle(element).boxShadow
      .split(/,(?![^()]*(?:\)|$))/u)
      .some((layer) => {
        const lengths = [...layer.matchAll(/(-?\d+(?:\.\d+)?)px/gu)].map((match) => Number(match[1]))
        const colour = layer.match(/(?:rgba?|hsla?)\([^)]*\)|#[\da-f]+/iu)?.[0] ?? "transparent"
        return !layer.includes("inset") && visibleColour(colour)
          && ((lengths[0] ?? 0) !== 0 || (lengths[1] ?? 0) !== 0 || (lengths[2] ?? 0) > 0)
      })
  const depth = (element: Element): number => {
    const parent = element.parentElement
    return parent instanceof Element && root.contains(parent) ? (enclosed(parent) ? 1 : 0) + depth(parent) : 1
  }
  return {
    enclosures: enclosureElements.map(describe),
    dropShadows: elements.filter(hasDropShadow).map(describe),
    deepestEnclosureChain: Math.max(0, ...enclosureElements.map(depth))
  }
}

/** Width and line height of a text box. */
export const textBlockMetrics = (element: Element) => ({
  height: element.getBoundingClientRect().height,
  lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight)
})

/** Whether the focused element overlaps the pinned place-band link. */
export const focusedControlIntersectsBand = () => {
  const focused = document.activeElement?.getBoundingClientRect()
  const band = document.querySelector("[data-place-band] a")?.getBoundingClientRect()
  return focused && band
    ? focused.left < band.right && focused.right > band.left && focused.top < band.bottom && focused.bottom > band.top
    : false
}

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
 * Records the footprint of each region of the demonstration — every step card
 * (`step:<step>`) and the stage's column (`stage:column`) — from the frame it
 * is first painted in: a resize observer reports a region's border-box height
 * once per frame it changes in, before that frame is painted, so what is
 * recorded is what was shown. Regions are found as they mount, from before
 * the document's first script runs. One `name height phase` line per report,
 * `phase` the trace's `data-place-render-phase` (`-` before the first trial
 * is in), on the root element as `data-footprints`; read back with
 * `recordedFootprints`. Self-contained, like `recordPaperFrames`.
 */
export const recordFootprints = () => {
  const regions = "[data-place-step],[data-place-stage='column']"
  const named = (element: Element): string =>
    element.matches("[data-place-step]")
      ? `step:${element.getAttribute("data-place-step") ?? ""}`
      : "stage:column"
  const sizes = new ResizeObserver((entries) => {
    const phase = document.querySelector("[data-place-trace]")?.getAttribute("data-place-render-phase") ?? "-"
    const lines = entries.map((entry) =>
      `${named(entry.target)} ${String(Math.round(entry.borderBoxSize[0]?.blockSize ?? 0))} ${phase}`
    )
    const seen = (document.documentElement.dataset["footprints"] ?? "").split("\n").filter((line) => line.length > 0)
    document.documentElement.dataset["footprints"] = [...seen, ...lines].join("\n")
  })
  // Each node is observed as it is added — itself, where it is a region, and every region within it.
  const watch = (records: ReadonlyArray<MutationRecord>) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        const added = node.matches(regions) ? [node] : []
        added.concat([...node.querySelectorAll(regions)]).forEach((element) => {
          sizes.observe(element, { box: "border-box" })
        })
      })
    })
  }
  new MutationObserver(watch).observe(document, { childList: true, subtree: true })
}

/** The footprints `recordFootprints` has recorded so far, one `name height phase` line each. */
export const recordedFootprints = () => document.documentElement.dataset["footprints"] ?? ""

/**
 * Records the page's web vitals from before the document's first script runs.
 * Installed as an init script, when the document has no root element yet, so
 * nothing is written until an observer fires; the first paint always does.
 * Self-contained, like `recordPaperFrames`. Read back with `recordedWebVitals`.
 *
 * What is recorded is what was observed, and nothing stands in for an
 * observation that was not made:
 *
 * - `webVitalLcp`: the largest contentful paint's render time (its load time
 *   for an image whose render time is withheld); empty until one is observed.
 * - `webVitalShiftTotal`: the sum of every layout shift without recent input
 *   over the page's life. Never less than CLS, whose session windows would
 *   only leave shifts out, so a total within the CLS budget is a CLS within
 *   it; it is not CLS and is not named so.
 * - `webVitalInp`: interaction to next paint as defined — each interaction's
 *   duration is the longest of the event entries sharing its `interactionId`,
 *   and the page's INP is the worst interaction until fifty, then one
 *   interaction in fifty is set aside; empty while no interaction has been
 *   reported.
 * - `webVitalEventThreshold`: the least event duration the observer reports,
 *   in milliseconds. An interaction quicker than this leaves no entry, so a
 *   page with interactions and no INP answered every one of them within it.
 * - `webVitalInteractions`: how many discrete interactions the page had —
 *   pointer presses and key presses — counted from the events themselves, so
 *   an INP that is empty is told apart from a page that was never touched.
 */
export const recordWebVitals = () => {
  const eventDurationThresholdMs = 16
  const values: {
    lcp: string
    shiftTotal: number
    interactions: number
    /** Each reported interaction's longest event duration, by `interactionId`. */
    reported: ReadonlyArray<{ readonly id: number; readonly duration: number }>
    shifted: string
  } = { lcp: "", shiftTotal: 0, interactions: 0, reported: [], shifted: "" }
  const interactionToNextPaint = (): string => {
    const durations = values.reported.map((interaction) => interaction.duration).sort((a, b) => b - a)
    const setAside = Math.min(durations.length - 1, Math.floor(durations.length / 50))
    return durations.length === 0 ? "" : String(durations[setAside] ?? "")
  }
  const interactionId = (entry: PerformanceEntry): number =>
    "interactionId" in entry && typeof entry.interactionId === "number" ? entry.interactionId : 0
  // An entry lengthens the interaction it belongs to, or reports a new one; entries of no interaction (`0`) are not INP's.
  const withEntry = (
    reported: ReadonlyArray<{ readonly id: number; readonly duration: number }>,
    entry: PerformanceEntry
  ): ReadonlyArray<{ readonly id: number; readonly duration: number }> => {
    const id = interactionId(entry)
    if (id === 0) return reported
    return reported.some((interaction) => interaction.id === id)
      ? reported.map((interaction) =>
        interaction.id === id ? { id, duration: Math.max(interaction.duration, entry.duration) } : interaction
      )
      : [...reported, { id, duration: entry.duration }]
  }
  const record = () => {
    const data = document.documentElement.dataset
    data["webVitalLcp"] = values.lcp
    data["webVitalShiftTotal"] = String(values.shiftTotal)
    data["webVitalInp"] = interactionToNextPaint()
    data["webVitalEventThreshold"] = String(eventDurationThresholdMs)
    data["webVitalInteractions"] = String(values.interactions)
    data["webVitalInteractionDurations"] = values.reported.map((interaction) => String(interaction.duration)).join(" ")
    data["webVitalShifts"] = values.shifted
  }
  // The demonstration's region a shifted node lies in, named by the nearest
  // region-level `data-place-*` attribute, then the node's own nearest
  // `data-place-*` name (or tag) and how far down it moved, so a failure says
  // what moved and by how much; none for a node outside the demonstration.
  const regions = "[data-place-composition],[data-place-features],[data-place-stage],[data-place-act],[data-place-acts]"
  const parts = "[data-place-step],[data-place-current-version],[data-place-trace],[data-place-legend]"
  const placeName = (element: Element): string =>
    element.getAttributeNames().find((name) => name.startsWith("data-place-")) ?? element.tagName.toLowerCase()
  const demonstrationRegion = (
    source: { readonly node: unknown; readonly previousRect: DOMRectReadOnly; readonly currentRect: DOMRectReadOnly }
  ): ReadonlyArray<string> => {
    if (!(source.node instanceof Element)) return []
    const node = source.node
    const signed = (pixels: number) => `${pixels >= 0 ? "+" : ""}${String(Math.round(pixels))}`
    const moved = `${signed(source.currentRect.x - source.previousRect.x)},${
      signed(source.currentRect.y - source.previousRect.y)
    }/${String(Math.round(source.previousRect.width))}x${String(Math.round(source.previousRect.height))}>${
      String(Math.round(source.currentRect.width))
    }x${String(Math.round(source.currentRect.height))}`
    return [node.closest(regions) ?? []].flat().map((region) =>
      `${placeName(region)}:${placeName(node.closest(`${regions},${parts}`) ?? node)}:${moved}`
    )
  }
  // `LayoutShift.sources` is not in the DOM library yet; each source names the node that moved and its rectangles.
  const isShiftSource = (
    value: unknown
  ): value is {
    readonly node: unknown
    readonly previousRect: DOMRectReadOnly
    readonly currentRect: DOMRectReadOnly
  } =>
    value instanceof Object
    && "node" in value
    && "previousRect" in value && value.previousRect instanceof DOMRectReadOnly
    && "currentRect" in value && value.currentRect instanceof DOMRectReadOnly
  const shiftSources = (entry: PerformanceEntry) =>
    "sources" in entry && entry.sources instanceof Array ? entry.sources.filter(isShiftSource) : []
  const shiftedRegions = (entry: PerformanceEntry): ReadonlyArray<string> =>
    shiftSources(entry).flatMap(demonstrationRegion).map((shift) => `${shift}@${String(Math.round(entry.startTime))}ms`)
  new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      const renderTime = "renderTime" in entry && typeof entry.renderTime === "number" ? entry.renderTime : 0
      const loadTime = "loadTime" in entry && typeof entry.loadTime === "number" ? entry.loadTime : 0
      values.lcp = String(renderTime || loadTime)
    })
    record()
  }).observe({ type: "largest-contentful-paint", buffered: true })
  new PerformanceObserver((list) => {
    const unexpected = list.getEntries().filter((entry) =>
      !("hadRecentInput" in entry && entry.hadRecentInput === true)
    )
    values.shiftTotal += unexpected.reduce(
      (total, entry) => total + ("value" in entry && typeof entry.value === "number" ? entry.value : 0),
      0
    )
    values.shifted = [values.shifted, ...unexpected.flatMap(shiftedRegions)].filter((region) => region.length > 0)
      .join(" ")
    record()
  }).observe({ type: "layout-shift", buffered: true })
  // `durationThreshold` is Event Timing's and not in the DOM library yet; a named object carries it without a cast.
  const eventOptions = { type: "event", buffered: true, durationThreshold: eventDurationThresholdMs }
  new PerformanceObserver((list) => {
    values.reported = list.getEntries().reduce(withEntry, values.reported)
    record()
  }).observe(eventOptions)
  // The interactions themselves, counted as they happen: a press of a pointer or a key is one.
  const interacted = () => {
    values.interactions += 1
    record()
  }
  document.addEventListener("pointerdown", interacted, { capture: true, passive: true })
  document.addEventListener("keydown", interacted, { capture: true, passive: true })
}

/**
 * What `recordWebVitals` has observed so far, as it stands on the root
 * element: every field a string, empty where nothing was observed. Decoded
 * by the test into observations; an absent recorder decodes to nothing, so
 * missing instrumentation is never a passing measurement.
 */
export const recordedWebVitals = () => {
  const data = document.documentElement.dataset
  return {
    lcp: data["webVitalLcp"] ?? "",
    layoutShiftTotal: data["webVitalShiftTotal"] ?? "",
    inp: data["webVitalInp"] ?? "",
    eventThresholdMs: data["webVitalEventThreshold"] ?? "",
    interactions: data["webVitalInteractions"] ?? "",
    interactionDurations: data["webVitalInteractionDurations"] ?? ""
  }
}

/**
 * The demonstration's regions that shifted layout without recent input,
 * recorded by `recordWebVitals`: one `region:part:+pixels` per shifted node,
 * separated by spaces; empty when only the page outside the demonstration
 * shifted, or nothing did.
 */
export const recordedDemonstrationShifts = () => document.documentElement.dataset["webVitalShifts"] ?? ""

/**
 * One frame of the settled drawing's finishing touches. `walk`: how much of
 * the walk through the place is drawn, from 0 (none) to 1 (whole), read from
 * the first value of its mask's `stroke-dasharray`; -1 while there is no walk.
 * `wash`: the opacity of the wash over the current version's changed value,
 * with the change it marks; `changes` is `""` and `opacity` -1 while no value
 * has changed.
 */
export const finishingTouches = (): {
  readonly walk: number
  readonly wash: { readonly changes: string; readonly opacity: number }
} => {
  const mask = document.querySelector("[data-place-walk] mask path")
  const dash = mask?.getAttribute("stroke-dasharray") ?? ""
  const washed = document.querySelector("[data-place-current-version] [data-changes]")
  const wash = washed?.querySelector("[data-place-wash]")
  return {
    walk: dash.length > 0 ? Number.parseFloat(dash) : -1,
    wash: {
      changes: washed?.getAttribute("data-changes") ?? "",
      opacity: wash ? Number.parseFloat(getComputedStyle(wash).opacity) : -1
    }
  }
}

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

/**
 * The stage draws the composition now shown: every feature the composer named
 * has its disc in `region`, filled in and at rest, and the drawing is the kept
 * one. Stories name different features, so this holds only once the drawing
 * is the new story's, not the last one's still standing.
 */
export const storyDrawn = (region: Element): boolean => {
  const named = [...region.querySelectorAll("[data-place-features] [data-provenance]")]
    .map((mark) => mark.textContent ?? "")
  const discs = [...region.querySelectorAll("[data-place-marker]")]
  const drawn = discs.map((disc) => disc.getAttribute("data-place-marker") ?? "")
  return named.length > 0 &&
    named.every((name) => drawn.includes(name)) &&
    document.querySelector("[data-place-stage='paper']")?.getAttribute("data-place-drawn") === "kept" &&
    discs.every((disc) => getComputedStyle(disc).transform === "none")
}

/** Where the band draws the disc named this frame: its `cx` as written, or nothing while it is not drawn. */
export const bandDiscCentre = (band: Element, name: string): string =>
  band.querySelector(`[data-place-band-disc="${name}"]`)?.getAttribute("cx") ?? ""

/** The band draws the disc named, and the paper's drawing is the kept one: a merge has landed in the band. */
export const bandShowsKept = (band: Element, name: string): boolean =>
  [...band.querySelectorAll("[data-place-band-disc]")].filter((disc) =>
      disc.getAttribute("data-place-band-disc") === name
    )
      .length === 1 &&
  document.querySelector("[data-place-stage='paper']")?.getAttribute("data-place-drawn") === "kept"

/**
 * The element's text stands wholly inside the element's own box and the
 * viewport: no glyph runs past its right edge, so none is clipped by an
 * ancestor that clips its overflow. The text's extent is the union of its
 * line boxes, measured as a selection of it would be.
 */
export const textFitsItsBox = (element: Element): boolean => {
  const range = document.createRange()
  range.selectNodeContents(element)
  const text = range.getBoundingClientRect()
  const box = element.getBoundingClientRect()
  return text.right <= box.right + 0.5 && text.right <= window.innerWidth && text.left >= box.left - 0.5
}

/** The element's right edge is inside the viewport. */
export const insideViewportRight = (element: Element) => element.getBoundingClientRect().right <= window.innerWidth

/**
 * Whether the element is what the visitor would touch at its own centre:
 * nothing is painted over it there. An overlay that stands behind another
 * fails this where the two overlap.
 */
export const topmostAtItsCentre = (element: Element): boolean => {
  const box = element.getBoundingClientRect()
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
  return element.contains(hit)
}

/**
 * Whether the element is what the visitor would touch at the point given, in
 * viewport coordinates: a pseudo-element painted over it reports its
 * generating element instead.
 */
export const topmostAt = (element: Element, point: { readonly x: number; readonly y: number }): boolean => {
  const hit = document.elementFromPoint(point.x, point.y)
  return element.contains(hit)
}

/**
 * The centre line of the rule the element draws before its content, in
 * viewport coordinates: its `::before`, positioned from the element's left
 * edge. The spine of the acts is such a rule.
 */
export const beforeRuleCentreX = (element: Element): number => {
  const rule = getComputedStyle(element, "::before")
  return element.getBoundingClientRect().left + parseFloat(rule.left) + parseFloat(rule.width) / 2
}

/** The colour the element paints behind itself, as the browser computed it. */
export const backgroundColour = (element: Element) => getComputedStyle(element).backgroundColor

/** The element has keyboard focus. */
export const isActiveElement = (element: Element) => element === document.activeElement

/**
 * What the element's CSS transitions ease and for how long, as computed. A
 * property of `none` is how a transition is switched off: the duration is
 * still declared, and nothing eases.
 */
export const transitionOf = (element: Element): { readonly property: string; readonly duration: string } => {
  const style = getComputedStyle(element)
  return { property: style.transitionProperty, duration: style.transitionDuration }
}

/**
 * Where keyboard focus has landed after a route to a line of code: which
 * site's gutter mark has it, whether it shows a focus ring, and whether it is
 * wholly inside the viewport — read together, as one moment.
 */
export const focusLanding = (): {
  readonly site: string
  readonly focusVisible: boolean
  readonly inViewport: boolean
} => {
  const element = document.activeElement
  if (!(element instanceof HTMLElement) || element === document.body) {
    return { site: "", focusVisible: false, inViewport: false }
  }
  const rect = element.getBoundingClientRect()
  return {
    site: element.getAttribute("data-place-code-site") ?? "",
    focusVisible: element.matches(":focus-visible"),
    // An element without size is not shown, so it is nowhere in the viewport.
    inViewport: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 &&
      rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
  }
}

/**
 * The answer popups on the page and the title each one currently shows, read
 * in one pass so a sample taken while a popup is leaving never pairs its
 * presence with a heading read a moment later.
 */
export const answerPopupsShowing = (): { readonly popups: number; readonly titles: ReadonlyArray<string> } => {
  const popups = [...document.querySelectorAll("[data-place-provenance]")]
  return {
    popups: popups.length,
    titles: popups.flatMap((popup) =>
      [...popup.querySelectorAll("[data-current] h3")].map((heading) => heading.textContent ?? "")
    )
  }
}

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

/** Whether all of an element is inside the viewport. */
export const fullyInViewport = (element: Element) => {
  const rect = element.getBoundingClientRect()
  return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 0
}

/** The vertical scroll position now. */
export const scrollY = () => window.scrollY

/** Mobile marker legend text and its rendered line metrics. */
export const markerLegendMetrics = (element: Element) => {
  const entries = [...element.children]
  const firstText = entries[0]?.querySelector("span:last-child") ?? element
  const style = getComputedStyle(firstText)
  return {
    entries: entries.map((entry) => entry.textContent?.trim() ?? ""),
    names: entries.map((entry) => entry.lastElementChild?.textContent ?? ""),
    markerLabels: [...document.querySelectorAll("[data-place-marker]")].map(
      (marker) => marker.getAttribute("aria-label") ?? ""
    ),
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(style.lineHeight),
    rowGap: Number.parseFloat(getComputedStyle(element).rowGap)
  }
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

/**
 * How the canvas is lit: what the body itself paints, and the light beneath
 * the page — the body's `::before` — with what fixes it in its own layer. A
 * body that paints the light on its own box puts it on the document's root
 * layer, where every repaint of the page re-shades it; on a fixed layer it is
 * shaded once.
 */
export const canvasLight = () => {
  const light = getComputedStyle(document.body, "::before")
  return {
    bodyImage: getComputedStyle(document.body).backgroundImage,
    light: {
      image: light.backgroundImage,
      position: light.position,
      inset: [light.top, light.right, light.bottom, light.left].join(" "),
      pointerEvents: light.pointerEvents,
      zIndex: light.zIndex
    }
  }
}

/** The element's text colour, as painted. */
export const textColour = (element: Element) => getComputedStyle(element).color

/** The element's painted surface — its background image, gradient stops and all — as one string. */
export const surfacePaint = (element: Element) => getComputedStyle(element).backgroundImage

/**
 * The WCAG contrast of everything visible under `root`, `root` included:
 * every element that holds its own words, as `text`, and every painted SVG
 * shape — a disc, an icon's path — as a `graphic`, each against what it is
 * painted over: its ancestors' backgrounds composited from the nearest opaque
 * one down, and the browser's white canvas when no ancestor paints at all. A
 * translucent colour is composited over that surface before it is measured.
 * Each comes back named — the words, or the shape's `data-place-*` name — so
 * a failure says what, and the test decides what each kind must reach and
 * that anything was measured at all: an empty answer is not a passing one.
 */
export const contrastsWithin = (root: Element): ReadonlyArray<{
  readonly kind: "text" | "graphic"
  readonly ratio: number
  readonly name: string
}> => {
  const channels = (colour: string): ReadonlyArray<number> => {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext("2d")
    if (!context) return [0, 0, 0, 0]
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = colour
    context.fillRect(0, 0, 1, 1)
    const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data
    return [red, green, blue, alpha / 255]
  }
  const over = (colour: string, beneath: string): string => {
    const values = channels(colour)
    const alpha = values[3] ?? 1
    if (alpha >= 1) return colour
    const under = channels(beneath)
    return `rgb(${String((values[0] ?? 0) * alpha + (under[0] ?? 0) * (1 - alpha))} ${
      String((values[1] ?? 0) * alpha + (under[1] ?? 0) * (1 - alpha))
    } ${String((values[2] ?? 0) * alpha + (under[2] ?? 0) * (1 - alpha))})`
  }
  const opaqueBackground = (node: Element): string => {
    const colour = getComputedStyle(node).backgroundColor
    const parent = node.parentElement
    if ((channels(colour)[3] ?? 1) >= 1) return colour
    return over(colour, parent instanceof Element ? opaqueBackground(parent) : "rgb(255 255 255)")
  }
  const channel = (value: number) => {
    const share = value / 255
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4
  }
  const luminance = (colour: string) => {
    const [r = 0, g = 0, b = 0] = channels(colour)
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (paint: string, element: Element) => {
    const beneath = opaqueBackground(element)
    const values = [luminance(over(paint, beneath)), luminance(beneath)].sort((left, right) => right - left)
    return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05)
  }
  const holdsWords = (element: Element) =>
    [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "")
  const shapes = ["circle", "ellipse", "rect", "path", "line", "polyline", "polygon"]
  // What a shape is told apart by: its stroke where one is painted — a painted boundary is what must stand
  // out from the surface (WCAG 1.4.11) — else its fill; nothing where it has neither.
  const shapePaint = (element: Element): string => {
    if (!(element instanceof SVGElement) || !shapes.includes(element.tagName.toLowerCase())) return "none"
    const style = getComputedStyle(element)
    const strokePainted = style.stroke !== "none" && (channels(style.stroke)[3] ?? 0) > 0
      && Number.parseFloat(style.strokeWidth) > 0
    return strokePainted ? style.stroke : style.fill
  }
  const shown = (element: Element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0
  }
  const shapeName = (element: Element): string =>
    element.getAttributeNames()
      .filter((name) => name.startsWith("data-place-"))
      .map((name) => `${name}=${element.getAttribute(name) ?? ""}`)[0] ?? element.tagName.toLowerCase()
  const measurement = (kind: "text" | "graphic", ratio: number, name: string) => ({ kind, ratio, name })
  return [root, ...root.querySelectorAll("*")]
    .filter((element) => shown(element))
    .flatMap((element) => {
      const paint = shapePaint(element)
      if (holdsWords(element)) {
        return [
          measurement(
            "text",
            contrast(getComputedStyle(element).color, element),
            (element.textContent ?? "").trim().slice(0, 40)
          )
        ]
      }
      if (paint !== "none") return [measurement("graphic", contrast(paint, element), shapeName(element))]
      return []
    })
}

/**
 * One frame of the page as motion sees it. `trials`: how many trials the
 * search's trace shows, so a sample can be tied to the drawing it belongs to.
 * `properties`: every property a CSS transition, keyframe animation or WAAPI
 * animation is animating right now. `placed`: where the page's landmarks and
 * every disc stand, each named — the title (`h1`), the step headers by their
 * step, the paper (`paper`) and the discs by their feature — as
 * `[name, rounded "x,y,w,h"]` pairs, so a test can follow each one's own
 * path across sampled frames.
 */
export const motionSample = (): {
  readonly trials: number
  readonly properties: ReadonlyArray<string>
  readonly placed: ReadonlyArray<readonly [string, string]>
} => {
  const omitted = ["offset", "computedOffset", "easing", "composite"]
  const properties = document.getAnimations().flatMap((animation) => {
    if (animation instanceof CSSTransition) return animation.transitionProperty.split(",").map((name) => name.trim())
    return animation.effect instanceof KeyframeEffect ?
      animation.effect.getKeyframes().flatMap((frame) =>
        Reflect.ownKeys(frame).filter((name): name is string => typeof name === "string" && !omitted.includes(name))
      ) :
      []
  })
  // A disc's place is its place on the paper: the drawing's own geometry, apart from wherever the paper stands.
  const paper = document.querySelector("[data-place-stage='paper']")?.getBoundingClientRect() ?? new DOMRect()
  const placed = [
    ...document.querySelectorAll("h1, [data-place-step-header], [data-place-stage='paper'], [data-place-marker]")
  ].map((element): readonly [string, string] => {
    const rect = element.getBoundingClientRect()
    const origin = element.hasAttribute("data-place-marker") ? paper : new DOMRect()
    const name = element.getAttribute("data-place-marker") ?? element.getAttribute("data-place-stage")
      ?? element.closest("[data-place-step]")?.getAttribute("data-place-step") ?? element.tagName.toLowerCase()
    return [
      name,
      `${String(Math.round(rect.x - origin.x))},${String(Math.round(rect.y - origin.y))},${
        String(Math.round(rect.width))
      },${String(Math.round(rect.height))}`
    ]
  })
  return { trials: document.querySelectorAll("[data-place-trial]").length, properties, placed }
}

/**
 * The lowest WCAG contrast ratio between the prose on the paper and the two
 * colours the paper is painted with, `--th-stage-50` and `--th-stage-0`, in
 * the mode the root is in now. The paper is a gradient between the two, so
 * the prose must read against both.
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
  const papers = [painted("--th-stage-50"), painted("--th-stage-0")]
  const ratios = [...document.querySelectorAll("[data-place-line] span")].flatMap((line) => {
    const ink = getComputedStyle(line).color
    return papers.map((paper) => contrast(ink, paper))
  })
  return ratios.length > 0 ? Math.min(...ratios) : 0
}
