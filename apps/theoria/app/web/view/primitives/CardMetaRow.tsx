import * as Arr from "effect/Array"

import { Cluster } from "./Layout.js"
import { ExternalLink, InternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"

/**
 * A single metadata item displayed in the card footer row.
 *
 * - `external-link`: cross-origin link with hover styling (e.g. npm, source)
 * - `internal-link`: same-origin link (e.g. package docs)
 * - `text`: plain label (e.g. license)
 */
export type MetaItem =
  | { readonly _tag: "external-link"; readonly label: string; readonly href: string }
  | { readonly _tag: "internal-link"; readonly label: string; readonly href: string }
  | { readonly _tag: "text"; readonly label: string }

const metaLinkClassName = "inline-flex items-baseline text-ink-700 transition-colors hover:text-ink-900"

/**
 * Dot-separated metadata row for card footers.
 *
 * Renders an array of `MetaItem` entries separated by `·` with consistent
 * link styling and baseline alignment. Use inside `ContentCard` below a
 * `Separator`.
 *
 * @since 0.1.0
 */
export const CardMetaRow = ({
  className,
  items
}: {
  readonly className?: string
  readonly items: ReadonlyArray<MetaItem>
}) => (
  <Cluster className={`flex-wrap items-baseline gap-x-2.5 gap-y-1 ${className ?? ""}`}>
    {Arr.flatMap(items, (item, index) => {
      const element = item._tag === "external-link"
        ? (
          <ExternalLink className={metaLinkClassName} href={item.href} key={`item-${index}`}>
            <SemanticText as="span" role="row-label" text={item.label} variant="compact" />
          </ExternalLink>
        )
        : item._tag === "internal-link"
        ? (
          <InternalLink className={metaLinkClassName} href={item.href} key={`item-${index}`}>
            <SemanticText as="span" role="row-label" text={item.label} variant="compact" />
          </InternalLink>
        )
        : (
          <SemanticText
            as="span"
            className="text-ink-700"
            key={`item-${index}`}
            role="row-label"
            text={item.label}
            variant="compact"
          />
        )

      return index === 0
        ? [element]
        : [
          <SemanticText
            as="span"
            className="text-ink-400"
            key={`sep-${index}`}
            role="row-label"
            text="·"
            variant="compact"
          />,
          element
        ]
    })}
  </Cluster>
)
