import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { memo, useCallback, useRef } from "react"

import { segmentProgress, setWordmarkMountedAtom, wordmarkFrameAtom } from "../../atoms/wordmark.js"

/**
 * Semantic character units: 7 Latin chars → 6 Greek chars in 6 positions.
 *
 * Each entry maps a Latin segment to its Greek counterpart. The segments
 * are used to build inline `<span>` wrappers within two complete text
 * layers so that per-character opacity can be driven independently while
 * preserving natural kerning within each language's text run.
 */
const SEGMENTS: ReadonlyArray<{ readonly en: string; readonly gr: string }> = [
  { en: "Th", gr: "θ" },
  { en: "e", gr: "ε" },
  { en: "o", gr: "ω" },
  { en: "r", gr: "ρ" },
  { en: "i", gr: "ί" },
  { en: "a", gr: "α" }
]

/**
 * A single text layer rendered as a continuous text run.
 *
 * Each segment is wrapped in an inline `<span>` whose opacity is driven
 * by the animation frame. Because `<span>` elements stay in the inline
 * formatting context, the browser applies correct kerning and shaping
 * across the entire run — identical to plain "Theoria" or "θεωρία".
 *
 * The layer is positioned at `col-start-1 row-start-1` in the parent
 * grid so both layers stack on top of each other.
 */
const TextLayer = memo(({
  face,
  frame
}: {
  readonly face: "en" | "gr"
  readonly frame: number
}) => (
  <span className="col-start-1 row-start-1">
    {SEGMENTS.map((seg, i) => {
      const p = segmentProgress(frame, i)
      const opacity = face === "en" ? 1 - p : p
      return (
        <span key={i} style={{ opacity }}>
          {seg[face]}
        </span>
      )
    })}
  </span>
))

/**
 * Invisible measure layer that sizes the grid cell.
 *
 * Renders whichever text run is wider (in this case "Theoria" since Latin
 * glyphs at the same font-size are typically wider than their Greek
 * counterparts in Figtree). Both visible layers stack on top of this
 * sizing reference so the container never changes size.
 */
const MeasureLayer = memo(() => (
  <span aria-hidden className="col-start-1 row-start-1 invisible">
    Theoria
  </span>
))

/**
 * Animated wordmark — crossfades per-character between "Theoria" and "θεωρία".
 *
 * Two complete text layers are stacked in a CSS grid cell (col-1 row-1).
 * Each layer is a full text run with natural kerning. An invisible measure
 * layer ensures stable sizing. Within each layer, inline `<span>` wrappers
 * receive per-segment opacity to create a staggered left-to-right crossfade.
 *
 * - **State**: `wordmarkFrameAtom` (writable counter, `keepAlive`)
 * - **Loop**: shared loop stays active while any wordmark is mounted
 * - **Trigger**: React 19 ref cleanup registers mount/unmount ownership
 * - **Render**: `segmentProgress` → per-segment 0–1 opacity crossfade
 *
 * @since 0.1.0
 */
export const WordmarkMorph = () => {
  const frame = useAtomValue(wordmarkFrameAtom)
  const setMounted = useAtomSet(setWordmarkMountedAtom)
  const setMountedRef = useRef(setMounted)

  setMountedRef.current = setMounted

  const refCallback = useCallback((el: HTMLSpanElement | null) => {
    if (el === null) {
      return
    }

    setMountedRef.current(true)

    return () => {
      setMountedRef.current(false)
    }
  }, [])

  return (
    <span
      aria-hidden
      className="inline-grid items-baseline text-ink-900"
      ref={refCallback}
    >
      <MeasureLayer />
      <TextLayer face="en" frame={frame} />
      <TextLayer face="gr" frame={frame} />
    </span>
  )
}
