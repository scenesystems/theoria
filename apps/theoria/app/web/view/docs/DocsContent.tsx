import { ArrowRightIcon, BeakerIcon, BoltIcon, CubeTransparentIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"
import type { ReactNode } from "react"

import type { Card } from "../../../contracts/card.js"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsCodeExplorer } from "./DocsCodeExplorer.js"
import { DocsHero } from "./DocsHero.js"
import type { DocsPageCopy } from "./docsModel.js"

const Foundation = ({
  description,
  icon,
  title
}: {
  readonly description: string
  readonly icon: ReactNode
  readonly title: string
}) => (
  <Section className={`${docsTheme.softSurface} min-w-0 flex-1 px-5 py-5`}>
    <Stack className="gap-3">
      <Cluster className="h-9 w-9 justify-center rounded-xl border border-stage-200 bg-stage-50 text-ink-700">
        {icon}
      </Cluster>
      <SemanticText
        as="h3"
        className="text-ink-900"
        role="card-title"
        text={title}
        variant="expanded"
      />
      <SemanticText
        as="p"
        className="text-ink-600"
        role="card-summary"
        text={description}
        variant="expanded"
        wrapAuthority="native-browser"
      />
    </Stack>
  </Section>
)

const effectDescriptionFor = (card: Card): string =>
  card.id === "effect-search"
    ? "Objectives may use any Effect services and typed failures. Seeded samplers make runs reproducible, while each trial retains its configuration and lifecycle state."
    : `Use ${card.packageName} inside Effect programs with typed failures, services, and resource ownership.`

const PackageOverview = ({ card }: { readonly card: Card }) => (
  <>
    <Section id="at-a-glance">
      <Stack className="gap-6">
        <SemanticText
          as="h2"
          className="text-ink-950"
          role="section-title"
          text="At a glance"
          variant="expanded"
        />
        <Cluster className="items-stretch gap-3 max-md:flex-col">
          <Foundation
            description={card.useCase}
            icon={<BoltIcon aria-hidden className="h-5 w-5" />}
            title="Best for"
          />
          <Foundation
            description={card.description}
            icon={<CubeTransparentIcon aria-hidden className="h-5 w-5" />}
            title="What it does"
          />
          <Foundation
            description={card.summary}
            icon={<BeakerIcon aria-hidden className="h-5 w-5" />}
            title="Try it"
          />
        </Cluster>
      </Stack>
    </Section>

    <Section className={`${docsTheme.softSurface} px-5 py-6 sm:px-7`} id="use-with-effect">
      <Cluster className="items-start justify-between gap-5 max-sm:flex-col">
        <Stack className="max-w-[39rem] gap-2">
          <SemanticText
            as="h2"
            className="text-ink-950"
            role="section-title"
            text="Use with Effect"
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-600"
            role="card-summary"
            text={effectDescriptionFor(card)}
            variant="expanded"
            wrapAuthority="native-browser"
          />
        </Stack>
        <ArrowRightIcon aria-hidden className="mt-1 h-5 w-5 shrink-0 text-ink-500" />
      </Cluster>
    </Section>

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
      Match.tag("DocsOverviewRoute", () => <PackageOverview card={card} />),
      Match.tag("DocsGettingStartedRoute", () => card.id === "effect-search" ? <DocsCodeExplorer /> : null),
      Match.tag("DocsApiRoute", () => null),
      Match.exhaustive
    )}
  </Stack>
)
