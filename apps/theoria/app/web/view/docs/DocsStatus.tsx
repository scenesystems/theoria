import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import { ActionButton, ActionLink } from "../primitives/ActionControl.js"
import { secondaryActionClassName } from "../primitives/designSystem.js"
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
          <Stack
            className="min-h-44 gap-5 rounded-instrument border border-hairline-glass bg-paper-glass p-5"
            key={index}
          >
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
    <Stack className="gap-5 border-b border-hairline-glass pb-8">
      <ShimmerLine width="w-24" />
      <ShimmerLine className="h-10" width="w-3/4" />
      <ShimmerLine width="w-full" />
      <ShimmerLine width="w-4/5" />
    </Stack>
    <Stack className="gap-4">
      <ShimmerLine className="h-7" width="w-2/5" />
      <ShimmerLine width="w-full" />
      <ShimmerLine width="w-11/12" />
      <PulseLayer className="mt-2 h-52 rounded-instrument border border-hairline-strong-glass bg-ink-strong-veil" />
    </Stack>
  </Stack>
)

const ApiSkeleton = () => (
  <Stack className="gap-8">
    <Stack className="gap-5 border-b border-hairline-glass pb-8">
      <ShimmerLine width="w-28" />
      <ShimmerLine className="h-10" width="w-3/5" />
      <ShimmerLine width="w-4/5" />
    </Stack>
    {Arr.map(
      Arr.range(0, 2),
      (index) => (
        <Stack className="gap-4 rounded-instrument border border-hairline-glass bg-paper-glass p-5" key={index}>
          <ShimmerLine className="h-6" width="w-1/3" />
          <PulseLayer className="h-24 rounded-control bg-ink-strong-veil" />
          <ShimmerLine width="w-5/6" />
        </Stack>
      )
    )}
  </Stack>
)

export const DocsLoadingSkeleton = ({ kind }: { readonly kind: DocsLoadingKind }) => (
  <Stack aria-busy="true" className="w-full" data-docs-skeleton={kind}>
    <SemanticText as="p" className="sr-only" role="status" text="Loading" />
    {Match.value(kind).pipe(
      Match.when("index", () => <IndexSkeleton />),
      Match.when("guide", () => <GuideSkeleton />),
      Match.when("api", () => <ApiSkeleton />),
      Match.exhaustive
    )}
  </Stack>
)

const Notice = ({ action, title }: { readonly action: ReactNode; readonly title: string }) => (
  <Stack className="items-start gap-3 py-16">
    <SemanticText as="h1" className="text-ink-strong" role="section-title" text={title} />
    {action}
  </Stack>
)

export const DocsStatus = (
  props:
    | { readonly kind?: DocsLoadingKind; readonly state: "loading" }
    | { readonly state: "not-found" }
    | { readonly retry: () => void; readonly state: "failure" }
) =>
  Match.value(props).pipe(
    Match.when(
      { state: "loading" },
      ({ kind }) => <DocsLoadingSkeleton kind={Option.getOrElse(Option.fromNullable(kind), () => "guide")} />
    ),
    Match.when({ state: "not-found" }, () => (
      <Notice
        action={
          <ActionLink className={secondaryActionClassName} href="/docs" label="View packages" variant="expanded" />
        }
        title="Not found"
      />
    )),
    Match.when({ state: "failure" }, ({ retry }) => (
      <Notice
        action={
          <ActionButton
            className={secondaryActionClassName}
            disabled={false}
            label="Try again"
            onClick={retry}
            variant="expanded"
          />
        }
        title="Documentation unavailable"
      />
    )),
    Match.exhaustive
  )
