import { Button } from "@base-ui/react/button"
import { Popover } from "@base-ui/react/popover"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"
import { type ComponentProps, Fragment } from "react"

import {
  codeSiteCall,
  decodeMark,
  encodeMark,
  markOpenDelayMs,
  type PlaceMark,
  type PlaceProvenance as Provenance
} from "../../../contracts/demo/imagined-place-provenance.js"
import { copyDocsCodeAtom, docsCopiedCodeAtom, docsCopyFailedCodeAtom } from "../../atoms/docs.js"
import { placeFocusAtom, placeMarkFocusedAtom, placeOnPageAtom } from "../../atoms/imagined-place-experience.js"
import { placeStepAtom } from "../../atoms/imagined-place.js"
import { type InlineStatusTone, surfaceClassName, toneClassesFor } from "../primitives/designSystem.js"
import { InlineStatus } from "../primitives/InlineStatus.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { AnchorLink } from "../primitives/Link.js"
import { PackageName } from "../primitives/PackageName.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { howItsBuiltSectionId } from "./HomeHero.js"
import { provenanceFor } from "./placeProvenance.js"

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
  render,
  ...props
}: ComponentProps<"button"> & {
  readonly mark: PlaceMark
  readonly nativeButton?: boolean
  readonly render?: Popover.Trigger.Props<PlaceMark>["render"]
}) => {
  const encoded = encodeMark(mark)
  const focused = useAtomValue(placeMarkFocusedAtom(encoded))

  return (
    <Popover.Trigger
      {...props}
      {...{ [provenanceAttribute]: encoded }}
      closeDelay={80}
      data-place-focused={focused ? "" : undefined}
      delay={markOpenDelayMs(mark)}
      handle={provenanceHandle}
      nativeButton={nativeButton}
      openOnHover
      payload={mark}
      render={render}
    />
  )
}

/**
 * A mark set in a line of text: the words themselves, on a button that
 * shows itself only when pointed at or answering, so the line still reads as
 * a line.
 */
export const inlineMarkClassName =
  "-mx-1 inline-flex min-w-0 max-w-full cursor-default items-center rounded-md px-1 py-0.5 text-left transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 data-[place-focused]:bg-stage-100/80 data-[popup-open]:bg-stage-100/80"

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
/** Above the band, which is above the page. */
const positionerClassName = "z-20 w-(--positioner-width) h-(--positioner-height)"

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
  "-mx-1.5 inline-flex min-w-0 items-center rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

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
  const setStep = useAtomSet(placeStepAtom)
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
          data-place-provenance-code={provenance.site.match}
          href={`#${howItsBuiltSectionId}`}
          onClick={() => {
            setStep(provenance.site.step)
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

/** The answer for the mark that opened the overlay, from what is on the page this instant. */
const Answered = ({ mark }: { readonly mark: PlaceMark }) => {
  const page = useAtomValue(placeOnPageAtom)
  return Option.match(provenanceFor(mark, page), {
    onNone: () => null,
    onSome: (provenance) => <Answer provenance={provenance} />
  })
}

/**
 * Pressing a digest copies it. While its answer is already open the press
 * changes nothing about the answer — it neither closes it nor pins it open
 * the way a press otherwise would — so the answer stays as the pointer
 * opened it, says "Copied", and leaves with the pointer. From closed, as on
 * a touch screen, the press opens the answer as any press does.
 */
const pressLeavesAnswerAlone = (
  details: Popover.Root.ChangeEventDetails,
  mark: Option.Option<PlaceMark>,
  answering: Option.Option<PlaceMark>
): boolean =>
  details.reason === "trigger-press"
  && Option.exists(mark, (pressed) => pressed._tag === "Digest")
  && Option.exists(answering, (current) =>
    Option.exists(mark, (pressed) => encodeMark(pressed) === encodeMark(current)))

/**
 * Mounted once, beside the demonstration. Opening writes the mark that opened
 * it to `placeFocusAtom`, read back from the trigger; closing clears it.
 * Moving from one mark to another while open is an opening by the new mark.
 */
export const PlaceProvenanceOverlay = () => {
  const focus = useAtomValue(placeFocusAtom)
  const setFocus = useAtomSet(placeFocusAtom)
  return (
    <Popover.Root
      handle={provenanceHandle}
      modal={false}
      onOpenChange={(open, details) => {
        const mark = decodeMark(details.trigger?.getAttribute(provenanceAttribute))
        if (pressLeavesAnswerAlone(details, mark, focus)) {
          details.cancel()
          return
        }
        setFocus(open ? mark : Option.none())
      }}
    >
      {({ payload }) => (
        <Popover.Portal>
          <Popover.Positioner
            align="center"
            className={positionerClassName}
            collisionPadding={12}
            side="top"
            sideOffset={8}
          >
            <Popover.Popup className={popupClassName} data-place-provenance>
              <Popover.Viewport className={viewportClassName}>
                {Option.match(Option.fromNullable(payload), {
                  onNone: () => null,
                  onSome: (mark) => <Answered mark={mark} />
                })}
              </Popover.Viewport>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      )}
    </Popover.Root>
  )
}
