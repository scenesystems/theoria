import { Button } from "@base-ui/react/button"
import { Popover } from "@base-ui/react/popover"
import { useAtomMount, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Boolean as Bool, Equal, Option } from "effect"
import * as Arr from "effect/Array"
import { type ComponentProps, Fragment, useId, useMemo, useRef } from "react"

import {
  codeSiteCall,
  decodeMark,
  encodeMark,
  type MarkTrigger,
  type PlaceMark,
  type PlaceProvenance as Provenance
} from "../../../contracts/demo/imagined-place-provenance.js"
import { copyDocsCodeAtom, docsCopiedCodeAtom, docsCopyFailedCodeAtom } from "../../atoms/docs.js"
import { observeOnMount } from "../../atoms/element-observation.js"
import {
  answerAfterPress,
  placeAnswerAtom,
  placeAnswerFocusReturnAtom,
  placeAnswerLifetimeAtom,
  placeAnswerOnShowAtom,
  placeGoToSiteAtom,
  placeMarkFocusedAtom,
  placeMarkLeftAtom
} from "../../atoms/imagined-place-experience.js"
import {
  elevationClassName,
  firmUnderPointerClassName,
  focusClassName,
  focusEdgeClassName,
  type InlineStatusTone,
  litMarkClassName,
  markClassName,
  neutralToneClasses,
  respondColorsClassName,
  stillUnderReducedMotion,
  surfaceClassName,
  transitionClassName
} from "../primitives/designSystem.js"
import { InlineStatus } from "../primitives/InlineStatus.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { AnchorLink } from "../primitives/Link.js"
import { PackageName } from "../primitives/PackageName.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { GhostText } from "../primitives/Skeleton.js"

import { howItsBuiltSectionId } from "./HomeHero.js"
import { focusedAttribute } from "./placeViewModel.js"

/**
 * The page has one answer surface. Every mark on it — a disc, a content ID,
 * a signature, a feature's name, a line of prose or of code — is a trigger of
 * this one popover, carrying the mark it stands for as its payload. The
 * overlay is rendered once, by `PlaceProvenanceOverlay`; which mark it
 * answers is read from the trigger that opened it.
 */
const provenanceHandle = Popover.createHandle<PlaceMark>()

/** The attribute a mark is carried on, so the answer and the tests can read it back from the element. */
export const provenanceAttribute = "data-provenance"

/**
 * Something the visitor can press. A click, a tap, or focus-and-Enter opens
 * the answer; the pointer resting on it opens nothing. Renders a button
 * unless `render` says otherwise; a rendered non-button says so with
 * `nativeButton={false}`. While the open answer is about this mark — pressed
 * itself, or made by the line of code pressed — the element says so with
 * `data-place-focused`, so a disc, a line of prose and the code that made
 * them light together from whichever end the visitor starts.
 */
export const ProvenanceMark = ({
  mark,
  nativeButton,
  id,
  render,
  ...props
}: ComponentProps<"button"> & {
  readonly mark: PlaceMark
  readonly nativeButton?: boolean
  readonly render?: Popover.Trigger.Props<PlaceMark>["render"]
}) => {
  const encoded = encodeMark(mark)
  const focused = useAtomValue(placeMarkFocusedAtom(encoded))
  const generatedId = useId()
  const triggerId = Option.getOrElse(Option.fromNullable(id), () => `place-mark-${generatedId}`)
  const markLeft = useAtomSet(placeMarkLeftAtom)
  // The mark says it has left at the commit its element leaves the page, so
  // an answer about it goes with it rather than lingering over nothing.
  const leaving = useMemo(() => observeOnMount<HTMLElement>(() => () => markLeft(triggerId)), [markLeft, triggerId])

  return (
    <Popover.Trigger
      ref={leaving}
      {...props}
      {...{ [provenanceAttribute]: encoded }}
      {...focusedAttribute(focused)}
      handle={provenanceHandle}
      id={triggerId}
      nativeButton={nativeButton}
      payload={mark}
      render={render}
    />
  )
}

/**
 * A mark set in a line of text: the words themselves, on a button that
 * shows itself only when pointed at or answering, so the line still reads as
 * a line. Its padding sits in the negative margins, so its greatest width is
 * the line's plus that room; a plain `100%` would leave a shrink-to-fit
 * heading eight pixels short of its own words and break them.
 */
export const inlineMarkPadding = "px-1 py-0.5"

/**
 * The room a mark in the line takes, without being one: the box a mark's
 * words stand in before the build brings them, so the mark arriving there
 * moves nothing around it.
 */
export const inlineMarkRoomClassName =
  `-mx-1 inline-flex min-w-0 max-w-[calc(100%+0.5rem)] items-center ${inlineMarkPadding}`

export const inlineMarkClassName = `${markClassName} ${litMarkClassName} ${inlineMarkRoomClassName} text-left`

/** A status said in the line that is also a mark: the signature, the version it is in. */
export const StatusMark = ({ className = "", label, mark, tone, ...props }: ComponentProps<"button"> & {
  readonly label: string
  readonly mark: PlaceMark
  readonly tone: InlineStatusTone
}) => (
  <ProvenanceMark {...props} className={`${inlineMarkClassName} ${className}`} mark={mark}>
    <InlineStatus label={label} tone={tone} />
  </ProvenanceMark>
)

/**
 * The room a status mark takes before the build brings the status: its dot
 * and the label's words as ghosts, in the mark's padding, so the status
 * arriving there moves nothing. Not a mark: there is nothing yet to answer.
 */
export const StatusMarkPending = ({ className = "", label, tone }: {
  readonly className?: string
  readonly label: string
  readonly tone: InlineStatusTone
}) => (
  <Layer render={<span />} className={`${inlineMarkRoomClassName} gap-1.5 ${className}`} data-place-status-pending>
    <Layer aria-hidden render={<span />} className={`inline-flex size-1.5 shrink-0 rounded-full ${tone.dot}`} />
    <GhostText as="span" className={tone.text} role="tab-label" text={label} variant="compact" />
  </Layer>
)

/**
 * The positioner's box is frozen to the measured size while the content
 * changes, so the popup can ease between two answers' sizes without
 * re-deciding which side of the mark it is on.
 */
const positionerClassName = `${elevationClassName("answer")} w-(--positioner-width) h-(--positioner-height)`

const popupClassName = Arr.join([
  surfaceClassName("overlay"),
  `w-(--popup-width) h-(--popup-height) max-w-[min(22rem,calc(100vw-1.5rem))] ${focusEdgeClassName}`,
  `origin-(--transform-origin) transition-[opacity,transform,width,height] ${transitionClassName("enter")}`,
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
  stillUnderReducedMotion
], " ")

/**
 * Between two answers the old one fades where it is and the new one fades in
 * over it; the popup's size eases from one to the other underneath.
 */
const viewportClassName = Arr.join([
  "relative overflow-clip",
  "[&>[data-previous]]:inset-0 [&>[data-previous]]:w-(--popup-width) [&>[data-previous]]:h-(--popup-height)",
  "[&>[data-previous]]:transition-opacity [&>[data-previous]]:duration-(--th-motion-duration-respond) [&>[data-previous]]:ease-theme",
  "[&>[data-previous][data-ending-style]]:opacity-0",
  "[&>[data-current]]:transition-opacity [&>[data-current]]:duration-(--th-motion-duration-respond) [&>[data-current]]:ease-theme",
  "[&>[data-current][data-starting-style]]:opacity-0",
  "motion-reduce:[&>[data-current]]:transition-none motion-reduce:[&>[data-previous]]:transition-none"
], " ")

const codeLinkClassName =
  `-mx-1.5 inline-flex min-w-0 items-center rounded-mark px-1.5 py-1 ${respondColorsClassName} ${stillUnderReducedMotion} ${firmUnderPointerClassName} ${focusClassName}`

const copyButtonClassName =
  `-mx-1.5 inline-flex shrink-0 items-center rounded-mark px-1.5 py-1 ${respondColorsClassName} ${firmUnderPointerClassName} ${focusClassName}`

const copyLabel = ({ copied, failed }: { readonly copied: boolean; readonly failed: boolean }): string =>
  Bool.match(copied, {
    onTrue: () => "Copied",
    onFalse: () => Bool.match(failed, { onTrue: () => "Copy failed", onFalse: () => "Copy" })
  })

/**
 * The whole of a value the page shows cut short — a content ID to the last
 * character, broken wherever the answer's width falls — so two can be read
 * against each other here, not only copied.
 */
const WholeValue = ({ value }: { readonly value: string }) => (
  <Layer data-place-provenance-value={value}>
    <SemanticText as="p" className={`break-all ${neutralToneClasses.textStrong}`} role="code-meta" text={value} />
  </Layer>
)

/** Puts the whole value on the clipboard; says whether it got there. */
const CopyValue = ({ value }: { readonly value: string }) => {
  const copy = useAtomSet(copyDocsCodeAtom)
  const copied = Option.contains(useAtomValue(docsCopiedCodeAtom), value)
  const failed = Option.contains(useAtomValue(docsCopyFailedCodeAtom), value)
  return (
    <Button
      aria-label={`${copyLabel({ copied, failed })} ${value}`}
      className={copyButtonClassName}
      data-place-provenance-copy
      onClick={() => {
        copy(value)
      }}
      type="button"
    >
      <SemanticText
        as="span"
        className="text-ink-tertiary"
        role="tab-label"
        text={copyLabel({ copied, failed })}
        variant="compact"
      />
    </Button>
  )
}

/**
 * The answer: what the mark is, its own words if it has any, a fact a line,
 * and the call that made it — a link into the code panel, which opens on
 * that call's step with the line lit.
 */
const Answer = ({ provenance }: { readonly provenance: Provenance }) => {
  const goToSite = useAtomSet(placeGoToSiteAtom)
  return (
    <Stack className="gap-2.5 px-3.5 py-3">
      <Cluster align="baseline" className="justify-between gap-x-3 gap-y-1">
        <Popover.Title render={<Layer className="min-w-0" />}>
          <SemanticText
            as="h3"
            className="text-ink"
            role="selection-title"
            text={provenance.title}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Popover.Title>
        <PackageName id={provenance.site.package} />
      </Cluster>
      {Option.match(provenance.detail, {
        onNone: () => null,
        onSome: (detail) => (
          <Popover.Description render={<Layer />}>
            <SemanticText
              as="p"
              className="text-ink-secondary"
              role="status"
              text={detail}
              variant="compact"
              wrapAuthority="native-browser"
            />
          </Popover.Description>
        )
      })}
      {/* A label is set smaller than its value; they rest on one baseline, not one box's centre. */}
      <Layer render={<dl />} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
        {Arr.map(provenance.facts, (fact) => (
          <Fragment key={fact.label}>
            <SemanticText as="dt" className="text-ink-tertiary" role="row-label" text={fact.label} variant="compact" />
            <SemanticText
              as="dd"
              className="min-w-0 break-words text-ink"
              role="row-value"
              text={fact.value}
              variant="compact"
              wrapAuthority="native-browser"
            />
          </Fragment>
        ))}
      </Layer>
      {Option.match(provenance.copy, {
        onNone: () => null,
        onSome: (value) => <WholeValue value={value} />
      })}
      <Cluster align="baseline" className="justify-between gap-x-3 gap-y-1 border-t border-hairline pt-2">
        <AnchorLink
          className={codeLinkClassName}
          data-place-provenance-code={provenance.site.id}
          href={`#${howItsBuiltSectionId}`}
          onClick={(event) => {
            event.preventDefault()
            goToSite(provenance.site.id)
          }}
        >
          <SemanticText
            as="code"
            className="truncate text-ink-secondary"
            role="code-meta"
            text={`${codeSiteCall(provenance.site)}()`}
          />
        </AnchorLink>
        {Option.match(provenance.copy, {
          onNone: () => null,
          onSome: (value) => <CopyValue value={value} />
        })}
      </Cluster>
    </Stack>
  )
}

/** The mark a press landed on, read back from the trigger the popover names. */
const pressOn = (details: Popover.Root.ChangeEventDetails): Option.Option<MarkTrigger> =>
  Option.flatMap(Option.fromNullable(details.trigger), (trigger) =>
    Option.all({
      triggerId: Option.some(trigger.id),
      mark: decodeMark(trigger.getAttribute(provenanceAttribute))
    }))

/**
 * Mounted once, beside the demonstration. The answer is owned here, in
 * `placeAnswerAtom`: a press on a mark opens its answer, or closes the one
 * open on that mark, or moves the answer to the mark pressed; a dismissal —
 * Escape, a press outside, focus leaving — closes whatever is open. The
 * popover is told what is open and by which trigger; the pointer alone
 * changes nothing.
 *
 * An answer takes focus and hands it back to its mark, unless the mark left
 * the page or the answer routed the reader to a line of code meanwhile — or
 * the dismissal was a press on a control, which took focus for itself before
 * the answer closed, and keeps it: the visitor put it there.
 * Where focus goes, and what the answer was saying, are known after the
 * answer itself is gone, from `placeAnswerFocusReturnAtom` and
 * `placeAnswerOnShowAtom`, so the popup closes as it was rather than emptied.
 */
export const PlaceProvenanceOverlay = () => {
  useAtomMount(placeAnswerLifetimeAtom)
  const answer = useAtomValue(placeAnswerAtom)
  const onShow = useAtomValue(placeAnswerOnShowAtom)
  const focusReturn = useAtomValue(placeAnswerFocusReturnAtom)
  const setAnswer = useAtomSet(placeAnswerAtom)
  const triggerId = Option.match(answer, { onNone: () => null, onSome: (current) => current.triggerId })
  // Focus is handed back only once the answer has closed. The popover asks
  // this whenever its trigger changes hands as well — the answer moving from
  // one mark to the next — and, told anything but no, would hand focus back
  // to the mark just left while the answer stands open on the next.
  const finalFocus = () => Bool.and(Option.isNone(answer), Bool.not(Equal.equals(focusReturn, "stays")))
  // Opened from the keyboard, the answer itself takes focus, and Tab reaches
  // its marks. The default would focus the first mark inside — and a line of
  // the prose, a composite item, presses when Space goes down, so the key
  // would come up on that mark and press it too, opening a preview beside the
  // answer. Opened by a pointer, the default stands.
  const popupRef = useRef<HTMLDivElement>(null)

  const onOpenChange = (open: boolean, details: Popover.Root.ChangeEventDetails) => {
    Option.match(
      Bool.match(Equal.equals(details.reason, "trigger-press"), {
        onTrue: () => pressOn(details),
        onFalse: () => Option.none()
      }),
      {
        onSome: (pressed) => setAnswer(answerAfterPress({ opening: open, pressed })),
        onNone: () => Bool.match(open, { onTrue: () => undefined, onFalse: () => setAnswer(Option.none()) })
      }
    )
  }

  return (
    <Popover.Root
      handle={provenanceHandle}
      modal={false}
      open={Option.isSome(answer)}
      onOpenChange={onOpenChange}
      triggerId={triggerId}
    >
      {() => (
        <Popover.Portal>
          <Popover.Positioner
            align="center"
            className={positionerClassName}
            collisionPadding={12}
            side="top"
            sideOffset={8}
          >
            <Popover.Popup
              ref={popupRef}
              className={popupClassName}
              data-place-provenance
              initialFocus={(openType) =>
                Bool.match(Equal.equals(openType, "keyboard"), { onTrue: () => popupRef.current, onFalse: () => true })}
              finalFocus={finalFocus}
            >
              <Popover.Viewport className={viewportClassName}>
                {Option.match(onShow, {
                  onNone: () => null,
                  onSome: (provenance) => <Answer provenance={provenance} />
                })}
              </Popover.Viewport>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      )}
    </Popover.Root>
  )
}
