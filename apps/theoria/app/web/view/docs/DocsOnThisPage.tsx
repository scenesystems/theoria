import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Arr from "effect/Array"

import { activeAnchorAtom } from "../../atoms/element-observation.js"
import { Nav, Stack } from "../primitives/Layout.js"
import { AnchorLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

export type DocsPageAnchor = readonly [id: string, label: string]

export const DocsOnThisPage = ({ anchors }: { readonly anchors: ReadonlyArray<DocsPageAnchor> }) => {
  const anchorKey = Arr.map(anchors, ([id]) => id).join("\u0000")
  const activeAnchor = Result.getOrElse(useAtomValue(activeAnchorAtom(anchorKey)), () => "")

  return anchors.length === 0
    ? null
    : (
      <Nav aria-label="On this page">
        <Stack className="gap-3 border-l border-stage-300/80 pl-4">
          <SemanticText as="h2" className="text-ink-900" role="row-label" text="On this page" />
          <Stack className="gap-2">
            {Arr.map(anchors, ([id, label]) => (
              <AnchorLink
                aria-current={activeAnchor === id ? "location" : undefined}
                className={activeAnchor === id
                  ? "text-ink-950 outline-none transition-colors"
                  : "text-ink-500 outline-none transition-colors hover:text-ink-900 focus-visible:text-ink-900"}
                href={`#${id}`}
                key={id}
              >
                <SemanticText as="span" className="text-inherit" role="status" text={label} variant="compact" />
              </AnchorLink>
            ))}
          </Stack>
        </Stack>
      </Nav>
    )
}
