import { Match } from "effect"
import * as Arr from "effect/Array"

import type { Card } from "../../../contracts/card.js"
import type { DocsRoute } from "../../../contracts/docs.js"
import { Nav, Stack } from "../primitives/Layout.js"
import { AnchorLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

const anchorsFor = (route: DocsRoute, card: Card) =>
  Match.value(route).pipe(
    Match.tag("DocsOverviewRoute", () => [
      { href: "#overview", label: "Overview" },
      { href: "#at-a-glance", label: "At a glance" },
      { href: "#use-with-effect", label: "Use with Effect" },
      ...(card.id === "effect-search" ? [{ href: "#code-example", label: "Example" }] : [])
    ]),
    Match.tag("DocsGettingStartedRoute", () => [
      { href: "#overview", label: "Getting started" },
      ...(card.id === "effect-search" ? [{ href: "#code-example", label: "Example" }] : [])
    ]),
    Match.tag("DocsApiRoute", () => [{ href: "#overview", label: "API reference" }]),
    Match.exhaustive
  )

export const DocsOnThisPage = ({
  card,
  route
}: {
  readonly card: Card
  readonly route: DocsRoute
}) => (
  <Nav aria-label="On this page">
    <Stack className="gap-3 border-l border-stage-300/80 pl-4">
      <SemanticText
        as="h2"
        className="text-ink-900"
        role="row-label"
        text="On this page"
        variant="expanded"
      />
      <Stack className="gap-2">
        {Arr.map(anchorsFor(route, card), (anchor) => (
          <AnchorLink
            className="text-ink-500 outline-none transition-colors hover:text-ink-900 focus-visible:text-ink-900"
            href={anchor.href}
            key={anchor.href}
          >
            <SemanticText
              as="span"
              className="text-inherit"
              role="status"
              text={anchor.label}
              variant="compact"
            />
          </AnchorLink>
        ))}
      </Stack>
    </Stack>
  </Nav>
)
