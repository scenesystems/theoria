import { Collapsible } from "@base-ui-components/react/collapsible"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"

import { placeStepAtom } from "../../atoms/imagined-place.js"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { TabBar, TabButton } from "../primitives/TabBar.js"

import { placeStepAt, placeStepDefinition, placeStepDefinitions, placeStepIndex } from "./placeSteps.js"

const triggerClassName =
  "group inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stage-300/90 bg-stage-0/88 px-3 py-1.5 text-ink-900 shadow-chip transition-colors hover:border-ink-400 hover:bg-stage-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const panelClassName =
  "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height,opacity] duration-200 ease-out data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"

/**
 * The code behind the step the visitor chose. The tabs and the spine on the
 * left are the same choice: pick a step here and its card is marked; pick a
 * card and this shows its code.
 */
const StepCode = () => {
  const step = useAtomValue(placeStepAtom)
  const setStep = useAtomSet(placeStepAtom)
  const definition = placeStepDefinition(step)

  return (
    <Stack className="gap-4 pt-5">
      <Layer className="overflow-x-auto">
        <TabBar className="w-max">
          {Arr.map(placeStepDefinitions, (candidate, index) => (
            <TabButton
              active={candidate.id === step}
              key={candidate.id}
              label={candidate.name}
              onClick={() => {
                setStep(placeStepAt(index))
              }}
            />
          ))}
        </TabBar>
      </Layer>
      <Layer data-place-code-step={step} key={placeStepIndex(step)}>
        <CodeBlock label={`${definition.name} · ${Arr.join(definition.packages, ", ")}`} source={definition.code} />
      </Layer>
    </Stack>
  )
}

/** The pipeline, one step at a time, behind a single disclosure. */
export const PlaceHowItsBuilt = () => (
  <Collapsible.Root>
    <Layer className="flex">
      <Collapsible.Trigger className={triggerClassName}>
        <SemanticText as="span" role="button-label" text="How it's built" />
        <ChevronRightIcon
          aria-hidden
          className="size-4 text-ink-500 transition-transform duration-150 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
      </Collapsible.Trigger>
    </Layer>
    <Collapsible.Panel className={panelClassName}>
      <StepCode />
    </Collapsible.Panel>
  </Collapsible.Root>
)
