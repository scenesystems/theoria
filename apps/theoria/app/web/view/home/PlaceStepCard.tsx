import { Button } from "@base-ui/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Boolean as Bool, Equal, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import { cards } from "../../../contracts/card.js"
import { PlaceAct } from "../../../contracts/demo/imagined-place-provenance.js"
import type { Id as CardId } from "../../../contracts/id.js"
import type { StepSpine } from "../../../contracts/layout.js"
import { placeActAttribute } from "../../atoms/imagined-place-experience.js"
import { placeStepAtom } from "../../atoms/imagined-place.js"
import {
  litMarkClassName,
  markClassName,
  respondColorsClassName,
  stillUnderReducedMotion
} from "../primitives/designSystem.js"
import { Cluster, Layer } from "../primitives/Layout.js"
import { PackageName } from "../primitives/PackageName.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { type PlaceStep, placeStepDefinition } from "./placeSteps.js"

/** Only packages in the docs manifest are named, so a typo here cannot produce a dead link. */
const packageNames = (ids: ReadonlyArray<CardId>): ReadonlyArray<ReactNode> =>
  Arr.filterMap(ids, (id) =>
    Option.map(
      Arr.findFirst(cards, (card) => Equal.equals(card.id, id)),
      (card) => <PackageName id={card.id} key={card.id} />
    ))

const nameButtonClassName = `${markClassName} ${litMarkClassName} -mx-1.5 -my-1 cursor-pointer px-1.5 py-1 text-left`

/**
 * The dot on the spine, in the header's row and centred on it, so the dot
 * sits level with the step's name whatever the name's line height. The dot
 * is positioned so it paints over the spine's line: an open ring is open.
 */
const spineDot = (active: boolean) => (
  <Layer aria-hidden className="relative hidden w-3 justify-center self-center lg:col-start-1 lg:row-start-1 lg:flex">
    <Layer
      render={<span />}
      className={`inline-flex size-2.5 shrink-0 rounded-full border ${respondColorsClassName} ${stillUnderReducedMotion} ${
        Bool.match(active, {
          onTrue: () =>
            "border-emphasis bg-emphasis",
          onFalse: () =>
            "border-accent bg-paper"
        })
      }`}
      data-place-spine-dot
    />
  </Layer>
)

const cardClassName = (spine: StepSpine): string =>
  Match.value(spine).pipe(
    Match.when(
      "spine",
      () =>
        "grid grid-cols-1 gap-y-3.5 lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-3.5"
    ),
    Match.when("none", () => "grid grid-cols-1 gap-y-3.5"),
    Match.exhaustive
  )

/**
 * The step's name is set small in capitals, its packages in monospace: two
 * faces at two sizes, which read as one line only when they rest on one
 * baseline. Centring their boxes would set the capitals a pixel or two above
 * the names.
 */
const headerClassName = (spine: StepSpine): string =>
  Match.value(spine).pipe(
    Match.when("spine", () => "gap-x-2.5 gap-y-1.5 lg:col-start-2 lg:row-start-1"),
    Match.when("none", () => "gap-x-2.5 gap-y-1.5"),
    Match.exhaustive
  )

const bodyClassName = (spine: StepSpine): string =>
  Match.value(spine).pipe(
    Match.when("spine", () => "min-w-0 lg:col-start-2 lg:row-start-2"),
    Match.when("none", () => "min-w-0"),
    Match.exhaustive
  )

const actOf = Schema.decodeUnknownOption(PlaceAct)

/**
 * A step on the spine is an act of the story: a landmark the stage answers
 * when it is read. The stage's own step is not an act; it is what answers.
 */
const landmark = (spine: StepSpine, step: PlaceStep): { readonly [placeActAttribute]?: PlaceAct } =>
  Match.value(spine).pipe(
    Match.when(
      "spine",
      () => Option.match(actOf(step), { onNone: () => ({}), onSome: (act) => ({ [placeActAttribute]: act }) })
    ),
    Match.when("none", () => ({})),
    Match.exhaustive
  )

/**
 * One step of the story: its name, the packages that do the work, and the
 * live object the step produced. Choosing a step points the code panel at it;
 * on the spine, the dot marks the chosen one.
 */
export const PlaceStepCard = (
  { children, spine, step }: { readonly children: ReactNode; readonly spine: StepSpine; readonly step: PlaceStep }
) => {
  const active = Equal.equals(useAtomValue(placeStepAtom), step)
  const setStep = useAtomSet(placeStepAtom)
  const definition = placeStepDefinition(step)

  return (
    <Layer
      render={<article />}
      className={cardClassName(spine)}
      data-place-step={step}
      data-place-step-active={Bool.match(active, { onTrue: () => "true", onFalse: () => "false" })}
      {...landmark(spine, step)}
    >
      {Match.value(spine).pipe(
        Match.when("spine", () => spineDot(active)),
        Match.when("none", () => null),
        Match.exhaustive
      )}
      <Cluster align="baseline" className={headerClassName(spine)} data-place-step-header>
        <Button
          aria-pressed={active}
          className={nameButtonClassName}
          onClick={() => {
            setStep(step)
          }}
          type="button"
        >
          <SemanticText
            as="span"
            className={Bool.match(active, { onTrue: () => "text-ink", onFalse: () => "text-ink-secondary" })}
            role="row-label"
            text={definition.name}
            variant="compact"
          />
        </Button>
        <Cluster align="baseline" className="gap-x-2.5 gap-y-1">{packageNames(definition.packages)}</Cluster>
      </Cluster>
      <Layer className={bodyClassName(spine)}>{children}</Layer>
    </Layer>
  )
}
