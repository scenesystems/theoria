import { useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { CSSProperties } from "react"

import type { ProposalRecord } from "../../../contracts/imagined-place-result.js"
import { placeGhostsAtom } from "../../atoms/imagined-place-experience.js"
import { type MotionPreference, motionPreferenceAtom } from "../../atoms/motion.js"
import { focusClassName } from "../primitives/designSystem.js"
import { departed, exitTransition } from "../primitives/motion.js"

import { ProvenanceMark } from "./PlaceProvenance.js"
import { ghostClassName, participantLabel } from "./placeViewModel.js"

/**
 * The ghosts of declined proposals: dashed rings in the proposer's tone, in
 * the paper's right margin, one below another, while the proposing act is
 * read. The margin is the text's, never flowed into, so a ghost is never
 * under a word. Each is a mark: pointing at it says what was offered, by
 * whom, and that it was declined.
 */
const ghostDiameter = 14
const ghostGap = 8

/** Ghosts stand in a column down the margin, one pitch apart: a ghost and the gap after it. */
const ghostPitch = Num.sum(ghostDiameter, ghostGap)

const ghostStyle = (stageWidth: number, padding: number, index: number): CSSProperties => ({
  translate: `${String(Num.subtract(stageWidth, Num.increment(ghostDiameter)))}px ${
    String(Num.sum(padding, Num.multiply(index, ghostPitch)))
  }px`,
  width: `${String(ghostDiameter)}px`,
  height: `${String(ghostDiameter)}px`
})

const ghostBaseClassName =
  `absolute left-0 top-0 rounded-full border-2 border-dashed before:absolute before:-inset-2 before:rounded-full before:content-[''] ${focusClassName} focus-visible:ring-offset-2 focus-visible:ring-offset-paper data-[popup-open]:ring-2 data-[popup-open]:ring-focus data-[popup-open]:ring-offset-2 data-[popup-open]:ring-offset-paper forced-colors:border-[CanvasText]`

const appearedFrom = { opacity: 0, scale: 0.8 }
const appeared = { opacity: 1, scale: 1 }
const leaving = { ...departed, transition: exitTransition }

/** A ghost fades and grows in; under reduced motion it fades alone. */
const appearing = (preference: MotionPreference) =>
  Match.value(preference).pipe(
    Match.when("full", () => ({ initial: appearedFrom, animate: appeared })),
    Match.when("reduced", () => ({ initial: departed, animate: { opacity: 1 } })),
    Match.exhaustive
  )

const Ghost = ({ index, padding, record, stageWidth }: {
  readonly index: number
  readonly padding: number
  readonly record: ProposalRecord
  readonly stageWidth: number
}) => {
  const preference = useAtomValue(motionPreferenceAtom)
  return (
    <ProvenanceMark
      aria-label={`${record.proposal.feature.name}, offered by ${
        participantLabel(record.proposal.proposer).toLocaleLowerCase("en-US")
      }, declined`}
      className={`${ghostBaseClassName} ${ghostClassName(record.proposal.proposer)}`}
      data-place-ghost={record.proposal.proposer}
      mark={{ _tag: "Feature", name: record.proposal.feature.name }}
      render={<m.button exit={leaving} {...appearing(preference)} />}
      style={ghostStyle(stageWidth, padding, index)}
    />
  )
}

export const PlaceGhosts = ({ padding, stageWidth }: { readonly padding: number; readonly stageWidth: number }) => {
  const ghosts = useAtomValue(placeGhostsAtom)
  return (
    <AnimatePresence initial={false}>
      {Arr.map(
        ghosts,
        (record, index) => (
          <Ghost index={index} key={record.contentId} padding={padding} record={record} stageWidth={stageWidth} />
        )
      )}
    </AnimatePresence>
  )
}
