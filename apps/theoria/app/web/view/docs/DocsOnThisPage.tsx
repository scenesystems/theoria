import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { Boolean as Bool, Equal } from "effect"
import * as Arr from "effect/Array"

import { activeAnchorAtom } from "../../atoms/element-observation.js"
import { focusClassName } from "../primitives/designSystem.js"
import { Nav, Stack } from "../primitives/Layout.js"
import { AnchorLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

export type DocsPageAnchor = readonly [id: string, label: string]

const anchorClassName =
  `rounded-mark transition-colors ${focusClassName} focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`

export const DocsOnThisPage = ({ anchors }: { readonly anchors: ReadonlyArray<DocsPageAnchor> }) => {
  const anchorKey = Arr.join(Arr.map(anchors, ([id]) => id), "\u0000")
  const activeAnchor = Result.getOrElse(useAtomValue(activeAnchorAtom(anchorKey)), () => "")

  return Arr.match(anchors, {
    onEmpty: () => null,
    onNonEmpty: (present) => (
      <Nav aria-label="On this page">
        <Stack className="gap-3 border-l border-hairline-strong-glass pl-4">
          <SemanticText as="h2" role="row-label" text="On this page" />
          <Stack className="gap-2">
            {Arr.map(present, ([id, label]) => (
              <AnchorLink
                aria-current={Bool.match(Equal.equals(activeAnchor, id), {
                  onTrue: (): "location" => "location",
                  onFalse: () => undefined
                })}
                className={Bool.match(Equal.equals(activeAnchor, id), {
                  onTrue: () => `${anchorClassName} text-ink-strong`,
                  onFalse: () => `${anchorClassName} text-ink-tertiary hover:text-ink focus-visible:text-ink`
                })}
                href={`#${id}`}
                key={id}
              >
                <SemanticText as="span" role="row-value" text={label} variant="compact" />
              </AnchorLink>
            ))}
          </Stack>
        </Stack>
      </Nav>
    )
  })
}
