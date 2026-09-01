import { Match } from "effect"

import type { Card } from "../../../contracts/card.js"
import type { DocsRoute } from "../../../contracts/docs.js"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsCodeExplorer } from "./DocsCodeExplorer.js"
import { DocsHero } from "./DocsHero.js"
import type { DocsPageCopy } from "./docsModel.js"

const PackageInstallation = ({ card }: { readonly card: Card }) => (
  <Section id="install">
    <Stack className="gap-4">
      <SemanticText as="h2" className="text-ink-950" role="section-title" text="Install" variant="expanded" />
      <CodeBlock label="Terminal" language="Shell" source={`bun add ${card.packageName}`} />
    </Stack>
  </Section>
)

const GettingStarted = ({ card }: { readonly card: Card }) => (
  <>
    <PackageInstallation card={card} />
    {card.id === "effect-search" ? <DocsCodeExplorer /> : null}
  </>
)

export const DocsContent = ({
  card,
  copy,
  route
}: {
  readonly card: Card
  readonly copy: DocsPageCopy
  readonly route: DocsRoute
}) => (
  <Stack className="gap-14 sm:gap-16">
    <DocsHero card={card} copy={copy} route={route} />
    {Match.value(route).pipe(
      Match.tag("DocsOverviewRoute", () => card.id === "effect-search" ? <DocsCodeExplorer /> : null),
      Match.tag("DocsGettingStartedRoute", () => <GettingStarted card={card} />),
      Match.tag("DocsApiRoute", () => null),
      Match.exhaustive
    )}
  </Stack>
)
