import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { memo, useCallback } from "react"

import { segmentProgress, setWordmarkMountedAtom, wordmarkFrameAtom } from "../../atoms/wordmark.js"

const segments: ReadonlyArray<{ readonly en: string; readonly gr: string }> = [
  { en: "Th", gr: "θ" },
  { en: "e", gr: "ε" },
  { en: "o", gr: "ω" },
  { en: "r", gr: "ρ" },
  { en: "i", gr: "ί" },
  { en: "a", gr: "α" }
]

const TextLayer = memo(({
  face,
  frame
}: {
  readonly face: "en" | "gr"
  readonly frame: number
}) => (
  <span className="col-start-1 row-start-1">
    {segments.map((segment, index) => {
      const progress = segmentProgress(frame, index)
      const opacity = face === "en" ? 1 - progress : progress

      return (
        <span key={index} style={{ opacity }}>
          {segment[face]}
        </span>
      )
    })}
  </span>
))

const MeasureLayer = memo(() => (
  <span aria-hidden className="col-start-1 row-start-1 invisible">
    Theoria
  </span>
))

export const WordmarkMorph = () => {
  const frame = useAtomValue(wordmarkFrameAtom)
  const setMounted = useAtomSet(setWordmarkMountedAtom)

  const refCallback = useCallback((element: HTMLSpanElement | null) => {
    if (element === null) {
      return
    }

    setMounted(true)

    return () => {
      setMounted(false)
    }
  }, [setMounted])

  return (
    <span aria-hidden className="inline-grid items-baseline text-inherit" ref={refCallback}>
      <MeasureLayer />
      <TextLayer face="en" frame={frame} />
      <TextLayer face="gr" frame={frame} />
    </span>
  )
}
