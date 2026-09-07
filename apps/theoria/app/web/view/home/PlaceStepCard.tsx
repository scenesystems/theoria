import { Button } from "@base-ui/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option, Schema } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import { cards } from "../../../contracts/card.js"
import { PlaceAct } from "../../../contracts/demo/imagined-place-provenance.js"
import type { Id as CardId } from "../../../contracts/id.js"
import type { StepSpine } from "../../../contracts/layout.js"
import { placeActAttribute } from "../../atoms/imagined-place-experience.js"
import { placeStepAtom } from "../../atoms/imagined-place.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { PackageName } from "../primitives/PackageName.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { type PlaceStep, placeStepDefinition } from "./placeSteps.js"

/** Only packages in the docs manifest are named, so a typo here cannot produce a dead link. */
const packageNames = (ids: ReadonlyArray<CardId>): ReadonlyArray<ReactNode> =>
  Arr.filterMap(ids, (id) =>
    Option.map(
      Arr.findFirst(cards, (card) => card.id === id),
      (card) => <PackageName id={card.id} key={card.id} />
    ))

const nameButtonClassName =
  "-mx-1.5 -my-1 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const spineDot = (active: boolean) => (
  <Layer aria-hidden className="hidden w-3 justify-center pt-2 lg:flex">
    <Layer
      render={<span />}
      className={`inline-flex size-2.5 shrink-0 rounded-full border transition-colors duration-150 ${
        active ? "border-ink-900 bg-ink-900" : "border-stage-400 bg-stage-0"
      }`}
    />
  </Layer>
)

const actOf = Schema.decodeUnknownOption(PlaceAct)

/**
 * A step on the spine is an act of the story: a landmark the stage answers
 * when it is read. The stage's own step is not an act; it is what answers.
 */
const landmark = (spine: StepSpine, step: PlaceStep): { readonly [placeActAttribute]?: PlaceAct } =>
  spine === "spine"
    ? Option.match(actOf(step), { onNone: () => ({}), onSome: (act) => ({ [placeActAttribute]: act }) })
    : {}

/**
 * One step of the story: its name, the packages that do the work, and the
 * live object the step produced. Choosing a step points the code panel at it;
 * on the spine, the dot marks the chosen one.
 */
export const PlaceStepCard = (
  { children, spine, step }: { readonly children: ReactNode; readonly spine: StepSpine; readonly step: PlaceStep }
) => {
  const active = useAtomValue(placeStepAtom) === step
  const setStep = useAtomSet(placeStepAtom)
  const definition = placeStepDefinition(step)

  return (
    <Layer
      render={<article />}
      className={spine === "spine"
        ? "grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-x-3.5"
        : "grid grid-cols-1"}
      data-place-step={step}
      data-place-step-active={active ? "true" : "false"}
      {...landmark(spine, step)}
    >
      {spine === "spine" ? spineDot(active) : null}
      <Stack className="min-w-0 gap-3.5">
        <Cluster className="items-baseline gap-x-2.5 gap-y-1.5">
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
              className={active ? "text-ink-900" : "text-ink-700"}
              role="row-label"
              text={definition.name}
              variant="compact"
            />
          </Button>
          <Cluster className="gap-x-2.5 gap-y-1">{packageNames(definition.packages)}</Cluster>
        </Cluster>
        {children}
      </Stack>
    </Layer>
  )
}
