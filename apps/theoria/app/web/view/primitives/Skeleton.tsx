import { Separator } from "@base-ui-components/react/separator"
import type { ReactNode } from "react"

import { surfaceMaterials, type ToneClasses } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

// ---------------------------------------------------------------------------
// ShimmerLine — the atomic building block for skeleton loading states.
// A single animated bar that mimics a line of content.
// ---------------------------------------------------------------------------

export const ShimmerLine = ({ width }: { readonly width: string }) => (
  <Layer className={`h-3 animate-pulse rounded bg-stage-200/60 ${width}`} />
)

// ---------------------------------------------------------------------------
// SkeletonSection — a composed group of shimmer lines that mimics a content
// block (heading + key-value rows). Used inside loading and empty states.
// ---------------------------------------------------------------------------

export const SkeletonSection = () => (
  <Stack className="gap-3 py-4">
    <ShimmerLine width="w-36" />
    <Stack className="gap-2.5 pl-1">
      <Cluster className="gap-4">
        <ShimmerLine width="w-20" />
        <ShimmerLine width="w-44" />
      </Cluster>
      <Cluster className="gap-4">
        <ShimmerLine width="w-24" />
        <ShimmerLine width="w-32" />
      </Cluster>
      <Cluster className="gap-4">
        <ShimmerLine width="w-16" />
        <ShimmerLine width="w-48" />
      </Cluster>
    </Stack>
  </Stack>
)

// ---------------------------------------------------------------------------
// SkeletonPreview — two skeleton sections separated by a divider.
// The standard preview shape for empty and loading states.
// ---------------------------------------------------------------------------

export const SkeletonPreview = ({ className }: { readonly className?: string }) => (
  <Stack className={className !== undefined ? `gap-0 ${className}` : "gap-0"}>
    <SkeletonSection />
    <Separator className="h-px bg-stage-200/80" />
    <SkeletonSection />
  </Stack>
)

// ---------------------------------------------------------------------------
// ContentPlaceholder — a dashed-border container for content that is
// still preparing/loading. Displays a status message.
// ---------------------------------------------------------------------------

export const ContentPlaceholder = ({ text }: { readonly text: string }) => (
  <Layer className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-stage-200/95 p-4">
    <SemanticText as="span" className="text-ink-700" role="status" text={text} variant="expanded" />
  </Layer>
)

// ---------------------------------------------------------------------------
// LoadingIndicator — a pulsing dot + label for in-progress states.
// Always present in the DOM; toggles visibility to avoid layout shift.
// ---------------------------------------------------------------------------

export const LoadingIndicator = ({
  active,
  text,
  tone
}: {
  readonly active: boolean
  readonly text: string
  readonly tone: ToneClasses
}) => (
  <Cluster className={`gap-1.5 transition-opacity duration-150 ${active ? "opacity-100" : "invisible"}`}>
    <Layer aria-hidden as="span" className={`inline-flex size-1.5 animate-pulse rounded-full ${tone.dot}`} />
    <SemanticText as="span" className="text-ink-700" role="code-meta" text={text} variant="expanded" />
  </Cluster>
)

// ---------------------------------------------------------------------------
// RunningState — animated indicator + skeleton preview for in-progress work.
// ---------------------------------------------------------------------------

export const RunningState = ({ text }: { readonly text?: string }) => (
  <Stack className="gap-4 py-4">
    <Cluster className="gap-2">
      <Layer aria-hidden as="span" className="inline-flex size-2 animate-pulse rounded-full bg-ink-400" />
      <SemanticText
        as="span"
        className="text-ink-600"
        role="status"
        text={text ?? "Generating evidence…"}
        variant="expanded"
      />
    </Cluster>
    <SkeletonPreview />
  </Stack>
)

export const FailureState = ({
  action,
  description
}: {
  readonly action?: ReactNode
  readonly description: string
}) => (
  <Stack className="gap-4 py-4">
    <Layer className={`${surfaceMaterials.calloutError} p-4`}>
      <Stack className="gap-3">
        <Cluster className="gap-2">
          <Layer aria-hidden as="span" className="inline-flex size-2 rounded-full bg-danger-500" />
          <SemanticText as="span" className="text-danger-700" role="status" text={description} variant="expanded" />
        </Cluster>
        {action !== undefined ? action : null}
      </Stack>
    </Layer>
    <SkeletonPreview className="opacity-10" />
  </Stack>
)

// ---------------------------------------------------------------------------
// EmptyState — CTA hero with a low-opacity skeleton preview for context.
// ---------------------------------------------------------------------------

export const EmptyState = ({
  action,
  description
}: {
  readonly action?: ReactNode
  readonly description?: string
}) => (
  <Stack className="relative min-h-full">
    <SkeletonPreview className="pointer-events-none opacity-20" />
    <SkeletonPreview className="pointer-events-none opacity-10" />
    <SkeletonPreview className="pointer-events-none opacity-5" />
    <Stack className="absolute inset-0 items-center justify-center gap-3">
      {action !== undefined ? action : null}
      <SemanticText
        as="span"
        className="text-ink-500"
        role="status"
        text={description ?? "Run the demo to generate reproducible evidence."}
        variant="expanded"
      />
    </Stack>
  </Stack>
)
