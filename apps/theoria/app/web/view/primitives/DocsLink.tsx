import { Popover } from "@base-ui/react/popover"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { Match, Option, Schema } from "effect"
import type { ComponentProps, MouseEvent, ReactNode } from "react"
import { useRef } from "react"

import { Id } from "../../../contracts/id.js"
import { docsApiModuleIndexAtom, docsManifestAtom } from "../../atoms/docs-data.js"

import { neutralToneClasses, toneClassesForCard } from "./designSystem.js"
import {
  docsLinkModuleAsset,
  docsLinkPath,
  docsLinkSummary,
  type DocsLinkTarget,
  docsLinkTarget,
  docsLinkTitle
} from "./docsLinkTarget.js"
import { docsTheme } from "./docsSystem.js"
import { Cluster, Layer, Rail, Stack } from "./Layout.js"
import { InternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"

type DocsLinkProps = Omit<ComponentProps<"a">, "href" | "onClick" | "title"> & {
  readonly href: string
  /** The destination as the visitor knows it here: the symbol, the package, the guide. */
  readonly title: string
  readonly children: ReactNode
}

const popupClassName = [
  "w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-stage-200/90 bg-stage-0/97 shadow-chip outline-none backdrop-blur-sm",
  "origin-[var(--transform-origin)] transition-[opacity,transform] duration-150",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
  "motion-reduce:transition-none"
].join(" ")

const openLinkClassName =
  `inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1 ${docsTheme.primaryAction}`

/** A press with a modifier or a non-primary button is the browser's: a new tab, a new window, the context menu. */
const isModifiedPress = (event: Event): boolean =>
  (event instanceof MouseEvent || event instanceof KeyboardEvent) &&
  (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
    (event instanceof MouseEvent && event.button !== 0))

const isCardId = Schema.is(Id)

const toneFor = (slug: string) => isCardId(slug) ? toneClassesForCard(slug) : neutralToneClasses

/** What kind of page opens: the package overview, a guide, or an API module's reference. */
const pageKind = (target: DocsLinkTarget): string =>
  Match.value(target).pipe(
    Match.tag("Package", () => "Overview"),
    Match.tag("Guide", () => "Guide"),
    Match.tag("Module", () => "Reference"),
    Match.exhaustive
  )

const Summary = ({ text }: { readonly text: Option.Option<string> }) =>
  Option.match(text, {
    onNone: () => null,
    onSome: (value) => (
      <Popover.Description render={<Layer />}>
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={value}
          variant="compact"
          wrapAuthority="native-browser"
        />
      </Popover.Description>
    )
  })

/** An export's summary lives in its module index, fetched the first time any link into that module opens. */
const ExportSummary = ({ asset, destination }: { readonly asset: string; readonly destination: DocsLinkTarget }) => {
  const index = Result.value(useAtomValue(docsApiModuleIndexAtom(asset)))
  return <Summary text={docsLinkSummary(destination, index)} />
}

const Preview = ({ destination, href, title }: {
  readonly destination: DocsLinkTarget
  readonly href: string
  readonly title: string
}) => {
  const tone = toneFor(destination.docsPackage.slug)
  const openRef = useRef<HTMLAnchorElement>(null)

  return (
    <Popover.Popup
      className={popupClassName}
      data-docs-link-preview={href}
      initialFocus={(openType) => openType === "keyboard" ? openRef.current : true}
    >
      <Stack className="gap-1.5 px-3.5 pt-3 pb-3">
        <Rail className="justify-between gap-3">
          <Cluster className="items-baseline gap-x-2">
            <SemanticText as="span" className={tone.text} role="row-label" text={destination.docsPackage.slug} />
            <SemanticText
              as="span"
              className="text-ink-500"
              role="code-meta"
              text={`v${destination.docsPackage.version}`}
            />
          </Cluster>
          <SemanticText as="span" className="shrink-0 text-ink-500" role="row-label" text={pageKind(destination)} />
        </Rail>
        <Popover.Title render={<Layer className="min-w-0" />}>
          <SemanticText
            as="code"
            className="block truncate text-ink-900"
            role="selection-title"
            text={docsLinkTitle(destination, title)}
          />
        </Popover.Title>
        {Option.match(docsLinkModuleAsset(destination), {
          onNone: () => <Summary text={docsLinkSummary(destination, Option.none())} />,
          onSome: (asset) => <ExportSummary asset={asset} destination={destination} />
        })}
      </Stack>
      <Rail className="justify-between gap-3 border-t border-stage-200/80 px-3.5 py-2.5">
        <SemanticText
          as="code"
          className="block min-w-0 flex-1 truncate text-ink-500"
          role="code-meta"
          text={docsLinkPath(destination)}
        />
        <InternalLink className={openLinkClassName} data-docs-link-open href={href} ref={openRef}>
          <SemanticText as="span" className="text-stage-0" role="button-label" text="Open" />
          <ArrowRightIcon aria-hidden className="size-4" />
        </InternalLink>
      </Rail>
    </Popover.Popup>
  )
}

const PreviewLink = ({ children, className, destination, href, title, ...props }: DocsLinkProps & {
  readonly destination: DocsLinkTarget
}) => {
  const keepForPreview = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isModifiedPress(event.nativeEvent)) event.preventDefault()
  }

  return (
    <Popover.Root
      modal={false}
      onOpenChange={(open, details) => {
        // Modifier and middle presses keep their native meaning; only a plain press opens the preview.
        if (open && details.reason === "trigger-press" && isModifiedPress(details.event)) details.cancel()
      }}
    >
      <Popover.Trigger
        nativeButton={false}
        render={<a {...props} className={className} href={href} onClick={keepForPreview} />}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" collisionPadding={12} side="bottom" sideOffset={8}>
          <Preview destination={destination} href={href} title={title} />
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * A link into the documentation that shows where it goes before it goes
 * there. A plain press opens a preview — the package and version, the
 * destination's own summary, its path — with the real link inside it, so a
 * visitor mid-walkthrough is never taken off the page by a stray tap.
 * Modifier presses open a new tab as any link would. A destination the
 * manifest does not know, or a manifest not yet loaded, leaves an ordinary
 * link.
 */
export const DocsLink = ({ children, href, title, ...props }: DocsLinkProps) => {
  const manifest = Result.value(useAtomValue(docsManifestAtom))
  const target = Option.flatMap(manifest, (loaded) => docsLinkTarget(loaded, href))

  return Option.match(target, {
    onNone: () => <InternalLink {...props} href={href}>{children}</InternalLink>,
    onSome: (resolved) => (
      <PreviewLink {...props} destination={resolved} href={href} title={title}>
        {children}
      </PreviewLink>
    )
  })
}
