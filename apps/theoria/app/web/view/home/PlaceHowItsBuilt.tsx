import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import { toneForCard } from "../../../contracts/theme.js"
import { placeRenderFrameAtom } from "../../atoms/imagined-place-render.js"
import { placeBuildAtom, placeBuildShaAtom, placeStepAtom } from "../../atoms/imagined-place.js"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Rail, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink, InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { TabBar, TabButton } from "../primitives/TabBar.js"

import { placeLiveValues } from "./placeLiveValues.js"
import {
  commitUrl,
  type PlaceReference,
  placeReferences,
  placeSourceFiles,
  referenceLinks,
  sourceLabel,
  sourceRef,
  sourceUrl
} from "./placeReferences.js"
import { type PlaceStep, placeStepAt, placeStepDefinition, placeStepDefinitions, placeStepIndex } from "./placeSteps.js"

const rowLinkClassName =
  "-mx-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const sourceLinkClassName =
  "-mx-2 flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-stage-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const RailGroup = ({ children, title }: { readonly children: ReactNode; readonly title: string }) => (
  <Stack aria-label={title} as="section" className="gap-1.5">
    <SemanticText as="span" className="text-ink-500" role="row-label" text={title} variant="compact" />
    <Stack as="ul" className="gap-0.5">{children}</Stack>
  </Stack>
)

/** One symbol the sample calls, linked to its page in the reference, in its package's tone. */
const ReferenceRow = ({ reference }: { readonly reference: PlaceReference }) => {
  const tone = toneClassesFor(toneForCard(reference.package))
  return (
    <Layer as="li">
      <InternalLink className={rowLinkClassName} data-place-reference={reference.text} href={reference.href}>
        <SemanticText as="code" className="text-ink-900" role="code-meta" text={reference.text} />
        <SemanticText as="span" className={`shrink-0 ${tone.text}`} role="code-meta" text={reference.package} />
      </InternalLink>
    </Layer>
  )
}

/** The file in this repository that does what the sample shows, at the commit the server was built from. */
const SourceRow = ({ path, sha }: { readonly path: string; readonly sha: string }) => (
  <Layer as="li">
    <ExternalLink className={sourceLinkClassName} data-place-source={path} href={sourceUrl(sha, path)}>
      <SemanticText as="code" className="text-ink-800" role="code-meta" text={sourceLabel(path)} />
      <ArrowTopRightOnSquareIcon aria-hidden className="size-3.5 shrink-0 text-ink-400" />
    </ExternalLink>
  </Layer>
)

const commitLabel = (sha: string): string => sourceRef(sha) === "HEAD" ? "Source" : `Source · ${sha.slice(0, 7)}`

const CommitLink = ({ sha }: { readonly sha: string }) => (
  <ExternalLink
    className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-ink-600 transition-colors duration-150 hover:bg-stage-100/80 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"
    data-place-commit={sha}
    href={commitUrl(sha)}
  >
    <SemanticText as="code" className="text-inherit" role="code-meta" text={commitLabel(sha)} />
    <ArrowTopRightOnSquareIcon aria-hidden className="size-3.5 shrink-0 self-center text-ink-400" />
  </ExternalLink>
)

const StepTabs = ({ step }: { readonly step: PlaceStep }) => {
  const setStep = useAtomSet(placeStepAtom)
  return (
    <TabBar className="w-fit max-w-full flex-wrap">
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
  )
}

/**
 * The step's code with two things a listing cannot show: every API name links
 * to its reference page, and beside the lines that produced them are the
 * values from the build on this page. The header names only the step; which
 * package each call comes from is beside that call in the reference rail.
 */
const StepCode = ({ step }: { readonly step: PlaceStep }) => {
  const build = Result.value(useAtomValue(placeBuildAtom))
  const frame = Result.value(useAtomValue(placeRenderFrameAtom))
  const definition = placeStepDefinition(step)

  return (
    <Layer data-place-code-step={step} key={placeStepIndex(step)}>
      <CodeBlock
        annotations={placeLiveValues(step, build, frame)}
        label={definition.name}
        links={referenceLinks(step)}
        source={definition.code}
      />
    </Layer>
  )
}

/** Beside the code on wide screens; two columns under it on narrower ones. */
const StepRail = ({ sha, step }: { readonly sha: string; readonly step: PlaceStep }) => (
  <Layer className="grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-1">
    <RailGroup title="In the reference">
      {Arr.map(placeReferences(step), (reference) => <ReferenceRow key={reference.text} reference={reference} />)}
    </RailGroup>
    <RailGroup title="Source">
      {Arr.map(placeSourceFiles(step), (path) => <SourceRow key={path} path={path} sha={sha} />)}
    </RailGroup>
  </Layer>
)

/**
 * After the walkthrough: the pipeline one step at a time, as code that links
 * into the reference, with the values this page's build produced and the
 * files that run it. The tabs and the step names on the spine are the same
 * choice.
 */
export const PlaceHowItsBuilt = () => {
  const step = useAtomValue(placeStepAtom)
  const sha = Option.getOrElse(useAtomValue(placeBuildShaAtom), () => "dev-local")

  return (
    <Section
      aria-label="How it's built"
      className="scroll-mt-6 border-t border-stage-200/85 pt-6 lg:pt-8"
      data-place-how-its-built
      id="how-its-built"
    >
      <Stack className="gap-5">
        <Cluster className="items-start justify-between gap-x-6 gap-y-3">
          <Stack className="gap-1.5">
            <SemanticText
              as="h3"
              className="text-ink-900"
              role="catalog-title"
              text="How it's built"
              variant="expanded"
            />
            <SemanticText
              as="p"
              className="max-w-[56ch] text-ink-600"
              role="card-summary"
              text="Each step's code, with the values it produced on this page. Every name links to its reference page; every file links to the source that ran."
              variant="compact"
              wrapAuthority="native-browser"
            />
          </Stack>
          <Rail className="-mr-2 shrink-0">
            <CommitLink sha={sha} />
          </Rail>
        </Cluster>

        <StepTabs step={step} />

        <Layer className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-x-8">
          <StepCode step={step} />
          <StepRail sha={sha} step={step} />
        </Layer>
      </Stack>
    </Section>
  )
}
