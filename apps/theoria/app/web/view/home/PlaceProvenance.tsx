import { Button } from "@base-ui/react/button"
import { Popover } from "@base-ui/react/popover"
import { useAtomMount, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import * as Arr from "effect/Array"
import { type ComponentProps, Fragment, useId } from "react"

import {
  codeSiteCall,
  decodeMark,
  encodeMark,
  type MarkTrigger,
  type PlaceMark,
  type PlaceProvenance as Provenance
} from "../../../contracts/demo/imagined-place-provenance.js"
import { copyDocsCodeAtom, docsCopiedCodeAtom, docsCopyFailedCodeAtom } from "../../atoms/docs.js"
import {
  answerAfterPress,
  placeAnswerAtom,
  placeAnswerFocusReturnAtom,
  placeAnswerLifetimeAtom,
  placeAnswerOnShowAtom,
  placeGoToSiteAtom,
  placeHoverIntentAtom,
  placeMarkFocusedAtom,
  placePointerOverAtom
} from "../../atoms/imagined-place-experience.js"
import {
  elevationClassName,
  type InlineStatusTone,
  litMarkClassName,
  markClassName,
  surfaceClassName,
  toneClassesFor
} from "../primitives/designSystem.js"
import { InlineStatus } from "../primitives/InlineStatus.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { AnchorLink } from "../primitives/Link.js"
import { PackageName } from "../primitives/PackageName.js"
import { PointerRegion, pointerRegionHandlers, PointerRegionProvider } from "../primitives/PointerRegion.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { howItsBuiltSectionId } from "./HomeHero.js"

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
 * Something the visitor can point at. Hover, focus-and-press or tap opens the
 * answer; the pointer resting on prose waits longer than on a disc. Renders a
 * button unless `render` says otherwise; a rendered non-button says so with
 * `nativeButton={false}`. While the open answer is about this mark — pointed
 * at itself, or made by the line of code pointed at — the element says so
 * with `data-place-focused`, so a disc, a line of prose and the code that
 * made them light together from whichever end the visitor starts.
 */
export const ProvenanceMark = ({
  mark,
  nativeButton,
  id,
  onPointerEnter,
  onPointerLeave,
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
  const triggerId = id ?? `place-mark-${generatedId}`
  const setPointerOver = useAtomSet(placePointerOverAtom)
  // The pointer over a mark is the beginning of that mark's answer; its delay counts from entry.
  const pointed = pointerRegionHandlers(
    new PointerRegion({
      enter: () => setPointerOver(Option.some({ _tag: "Mark", triggerId, mark })),
      leave: () => setPointerOver(Option.none())
    })
  )

  return (
    <Popover.Trigger
      {...props}
      {...{ [provenanceAttribute]: encoded }}
      data-place-focused={focused ? "" : undefined}
      handle={provenanceHandle}
      id={triggerId}
      nativeButton={nativeButton}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        pointed.onPointerEnter(event)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        pointed.onPointerLeave(event)
      }}
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
export const inlineMarkClassName =
  `${markClassName} ${litMarkClassName} -mx-1 inline-flex min-w-0 max-w-[calc(100%+0.5rem)] items-center px-1 py-0.5 text-left`

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
 * The positioner's box is frozen to the measured size while the content
 * changes, so the popup can ease between two answers' sizes without
 * re-deciding which side of the mark it is on.
 */
const positionerClassName = `${elevationClassName("answer")} w-(--positioner-width) h-(--positioner-height)`

const popupClassName = [
  surfaceClassName("overlay"),
  "w-(--popup-width) h-(--popup-height) max-w-[min(22rem,calc(100vw-1.5rem))] outline-none",
  "origin-(--transform-origin) transition-[opacity,transform,width,height] duration-150 ease-theme",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
  "motion-reduce:transition-none"
].join(" ")

/**
 * Between two answers the old one fades where it is and the new one fades in
 * over it; the popup's size eases from one to the other underneath.
 */
const viewportClassName = [
  "relative overflow-clip",
  "[&>[data-previous]]:inset-0 [&>[data-previous]]:w-(--popup-width) [&>[data-previous]]:h-(--popup-height)",
  "[&>[data-previous]]:transition-opacity [&>[data-previous]]:duration-150 [&>[data-previous]]:ease-theme",
  "[&>[data-previous][data-ending-style]]:opacity-0",
  "[&>[data-current]]:transition-opacity [&>[data-current]]:duration-150 [&>[data-current]]:ease-theme",
  "[&>[data-current][data-starting-style]]:opacity-0",
  "motion-reduce:[&>[data-current]]:transition-none motion-reduce:[&>[data-previous]]:transition-none"
].join(" ")

const codeLinkClassName =
  "-mx-1.5 inline-flex min-w-0 items-center rounded-md px-1.5 py-1 transition-colors duration-150 motion-reduce:transition-none hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const copyButtonClassName =
  "-mx-1.5 inline-flex shrink-0 items-center rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const digestTone = toneClassesFor("digest")

const copyLabel = ({ copied, failed }: { readonly copied: boolean; readonly failed: boolean }): string =>
  copied ? "Copied" : failed ? "Copy failed" : "Copy"

/**
 * The whole of a value the page shows cut short — a content ID to the last
 * character, broken wherever the answer's width falls — so two can be read
 * against each other here, not only copied.
 */
const WholeValue = ({ value }: { readonly value: string }) => (
  <Layer data-place-provenance-value={value}>
    <SemanticText as="p" className={`break-all ${digestTone.textStrong}`} role="code-meta" text={value} />
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
        className="text-ink-600"
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
      <Cluster className="items-baseline justify-between gap-x-3 gap-y-1">
        <Popover.Title render={<Layer className="min-w-0" />}>
          <SemanticText
            as="h3"
            className="text-ink-900"
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
              className="text-ink-700"
              role="status"
              text={detail}
              variant="compact"
              wrapAuthority="native-browser"
            />
          </Popover.Description>
        )
      })}
      <Layer render={<dl />} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {Arr.map(provenance.facts, (fact) => (
          <Fragment key={fact.label}>
            <SemanticText as="dt" className="text-ink-500" role="row-label" text={fact.label} variant="compact" />
            <SemanticText
              as="dd"
              className="min-w-0 break-words text-ink-800"
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
      <Cluster className="items-center justify-between gap-x-3 gap-y-1 border-t border-rule pt-2">
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
            className="truncate text-ink-700"
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
  Option.all({
    triggerId: Option.fromNullable(details.trigger?.id),
    mark: decodeMark(details.trigger?.getAttribute(provenanceAttribute))
  })

/**
 * Mounted once, beside the demonstration. The answer is owned here, in
 * `placeAnswerAtom`: the pointer's intent opens and closes hover answers
 * through `placeHoverIntentAtom`; a press opens a pinned answer, or pins a
 * hover one; a dismissal — Escape, a press outside, focus leaving — closes
 * whatever is open and forgets where the pointer was, so nothing pending
 * opens afterwards. The popover is told what is open and by which trigger.
 *
 * A hover answer never takes or returns focus; a pressed one takes it and
 * hands it back to its mark. Which of the two is leaving, and what it was
 * saying, are known after the answer itself is gone, from
 * `placeAnswerFocusReturnAtom` and `placeAnswerOnShowAtom`, so the popup
 * closes as it was rather than emptied.
 *
 * The popup and any preview opened from inside it are one pointer region:
 * crossing between them is not leaving.
 */
export const PlaceProvenanceOverlay = () => {
  useAtomMount(placeHoverIntentAtom)
  useAtomMount(placeAnswerLifetimeAtom)
  const answer = useAtomValue(placeAnswerAtom)
  const onShow = useAtomValue(placeAnswerOnShowAtom)
  const focusReturn = useAtomValue(placeAnswerFocusReturnAtom)
  const setAnswer = useAtomSet(placeAnswerAtom)
  const setPointerOver = useAtomSet(placePointerOverAtom)
  const triggerId = Option.match(answer, { onNone: () => null, onSome: (current) => current.triggerId })
  const region = new PointerRegion({
    enter: () => setPointerOver(Option.some({ _tag: "Answer" })),
    leave: () => setPointerOver(Option.none())
  })
  const regionHandlers = pointerRegionHandlers(region)
  const initialFocus = () => Option.exists(answer, (current) => current.opening === "hover") ? false : undefined
  const finalFocus = () => focusReturn === "stays" ? false : undefined

  const onOpenChange = (open: boolean, details: Popover.Root.ChangeEventDetails) => {
    Option.match(
      details.reason === "trigger-press" ? pressOn(details) : Option.none(),
      {
        onSome: (pressed) =>
          Match.value(answerAfterPress(answer, { opening: open, pressed })).pipe(
            Match.tag("Leave", () => details.cancel()),
            Match.tag("Pin", ({ answer: pinned }) => {
              details.cancel()
              setAnswer(Option.some(pinned))
            }),
            Match.tag("Answer", ({ answer: next }) => setAnswer(next)),
            Match.exhaustive
          ),
        onNone: () => {
          if (!open) {
            setAnswer(Option.none())
            setPointerOver(Option.none())
          }
        }
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
            <PointerRegionProvider region={region}>
              <Popover.Popup
                className={popupClassName}
                data-place-provenance
                finalFocus={finalFocus}
                initialFocus={initialFocus}
                onPointerEnter={regionHandlers.onPointerEnter}
                onPointerLeave={regionHandlers.onPointerLeave}
              >
                <Popover.Viewport className={viewportClassName}>
                  {Option.match(onShow, {
                    onNone: () => null,
                    onSome: (provenance) => <Answer provenance={provenance} />
                  })}
                </Popover.Viewport>
              </Popover.Popup>
            </PointerRegionProvider>
          </Popover.Positioner>
        </Popover.Portal>
      )}
    </Popover.Root>
  )
}
