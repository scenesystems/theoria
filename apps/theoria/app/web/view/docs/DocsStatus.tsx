import { Schema } from "effect"
import * as Arr from "effect/Array"

import { ActionButton, ActionLink } from "../primitives/ActionControl.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { PulseLayer, ShimmerLine } from "../primitives/Skeleton.js"

export const DocsLoadingKind = Schema.Literal("index", "guide", "api")
export type DocsLoadingKind = typeof DocsLoadingKind.Type

const IndexSkeleton = () => (
  <Stack className="gap-12">
    <Stack className="max-w-3xl gap-5">
      <ShimmerLine className="h-10" width="w-64" />
      <ShimmerLine width="w-full max-w-2xl" />
    </Stack>
    <Layer className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Arr.map(
        Arr.range(0, 5),
        (index) => (
          <Stack className="min-h-44 gap-5 rounded-2xl border border-stage-200/80 bg-stage-0/72 p-5" key={index}>
            <ShimmerLine className="h-5" width="w-2/3" />
            <Stack className="gap-3">
              <ShimmerLine width="w-full" />
              <ShimmerLine width="w-5/6" />
            </Stack>
            <ShimmerLine className="mt-auto h-4" width="w-20" />
          </Stack>
        )
      )}
    </Layer>
  </Stack>
)

const GuideSkeleton = () => (
  <Stack className="gap-9">
    <Stack className="gap-5 border-b border-stage-200/80 pb-8">
      <ShimmerLine width="w-24" />
      <ShimmerLine className="h-10" width="w-3/4" />
      <ShimmerLine width="w-full" />
      <ShimmerLine width="w-4/5" />
    </Stack>
    <Stack className="gap-4">
      <ShimmerLine className="h-7" width="w-2/5" />
      <ShimmerLine width="w-full" />
      <ShimmerLine width="w-11/12" />
      <PulseLayer className="mt-2 h-52 rounded-2xl border border-stage-300/70 bg-ink-950/90" />
    </Stack>
  </Stack>
)

const ApiSkeleton = () => (
  <Stack className="gap-8">
    <Stack className="gap-5 border-b border-stage-200/80 pb-8">
      <ShimmerLine width="w-28" />
      <ShimmerLine className="h-10" width="w-3/5" />
      <ShimmerLine width="w-4/5" />
    </Stack>
    {Arr.map(
      Arr.range(0, 2),
      (index) => (
        <Stack className="gap-4 rounded-2xl border border-stage-200/80 bg-stage-0/70 p-5" key={index}>
          <ShimmerLine className="h-6" width="w-1/3" />
          <PulseLayer className="h-24 rounded-xl bg-ink-950/90" />
          <ShimmerLine width="w-5/6" />
        </Stack>
      )
    )}
  </Stack>
)

export const DocsLoadingSkeleton = ({ kind }: { readonly kind: DocsLoadingKind }) => (
  <Stack aria-busy="true" className="w-full" data-docs-skeleton={kind}>
    <SemanticText as="p" className="sr-only" role="status" text="Loading" />
    {kind === "index" ? <IndexSkeleton /> : kind === "guide" ? <GuideSkeleton /> : <ApiSkeleton />}
  </Stack>
)

export const DocsStatus = (
  props:
    | { readonly kind?: DocsLoadingKind; readonly state: "loading" }
    | { readonly state: "not-found" }
    | { readonly retry: () => void; readonly state: "failure" }
) => {
  if (props.state === "loading") {
    return <DocsLoadingSkeleton kind={props.kind ?? "guide"} />
  }

  return (
    <Stack className="items-start gap-3 py-16">
      <SemanticText
        as="h1"
        className="text-ink-950"
        role="section-title"
        text={props.state === "failure" ? "Documentation unavailable" : "Not found"}
      />
      {props.state === "failure" ?
        (
          <ActionButton
            className={docsTheme.secondaryAction}
            disabled={false}
            label="Try again"
            onClick={props.retry}
            variant="expanded"
          />
        ) :
        <ActionLink className={docsTheme.secondaryAction} href="/docs" label="View packages" variant="expanded" />}
    </Stack>
  )
}
