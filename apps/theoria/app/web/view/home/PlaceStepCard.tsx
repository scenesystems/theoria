import { Button } from "@base-ui/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import { cards } from "../../../contracts/card.js"
import type { Id as CardId } from "../../../contracts/id.js"
import { toneForCard } from "../../../contracts/theme.js"
import { placeStepAtom } from "../../atoms/imagined-place.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { DocsLink } from "../primitives/DocsLink.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { type PlaceStep, placeStepDefinition } from "./placeSteps.js"

const packagePillClassName =
  "inline-flex items-center rounded-md border px-1.5 py-0.5 transition-colors duration-150 hover:bg-stage-0 focus-visible:outline-none focus-visible:ring-2"

/** A package's short name, linked to its docs, in its own tone. */
const PackagePill = ({ id }: { readonly id: CardId }) => {
  const tone = toneClassesFor(toneForCard(id))
  return (
    <DocsLink
      className={`${packagePillClassName} ${tone.borderSubtle} ${tone.bgTinted} ${tone.focusRing}`}
      href={`/docs/${id}`}
      title={id}
    >
      <SemanticText as="span" className={tone.text} role="code-meta" text={id} />
    </DocsLink>
  )
}

/** Only packages in the docs manifest get a pill, so a typo here cannot produce a dead link. */
const packagePills = (ids: ReadonlyArray<CardId>): ReadonlyArray<ReactNode> =>
  Arr.filterMap(ids, (id) =>
    Option.map(
      Arr.findFirst(cards, (card) => card.id === id),
      (card) => <PackagePill id={card.id} key={card.id} />
    ))

const nameButtonClassName =
  "-mx-1.5 -my-1 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

/**
 * One step of the story: its name, the packages that do the work, and the
 * live object the step produced. Choosing a step points the code panel at it;
 * the dot on the spine marks the chosen one.
 */
export const PlaceStepCard = ({ children, step }: { readonly children: ReactNode; readonly step: PlaceStep }) => {
  const active = useAtomValue(placeStepAtom) === step
  const setStep = useAtomSet(placeStepAtom)
  const definition = placeStepDefinition(step)

  return (
    <Layer
      render={<article />}
      className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-x-3.5"
      data-place-step={step}
      data-place-step-active={active ? "true" : "false"}
    >
      <Layer aria-hidden className="hidden w-3 justify-center pt-2 lg:flex">
        <Layer
          render={<span />}
          className={`inline-flex size-2.5 shrink-0 rounded-full border transition-colors duration-150 ${
            active ? "border-ink-900 bg-ink-900" : "border-stage-400 bg-stage-0"
          }`}
        />
      </Layer>
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
          <Cluster className="gap-1.5">{packagePills(definition.packages)}</Cluster>
        </Cluster>
        {children}
      </Stack>
    </Layer>
  )
}
