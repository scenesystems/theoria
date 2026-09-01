import { ArrowRightIcon, CodeBracketSquareIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"

import type { Card } from "../../../contracts/card.js"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsGettingStartedRoute, docsPathFor } from "../../../contracts/docs.js"
import { ActionLink, ExternalActionLink } from "../primitives/ActionControl.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import type { DocsPageCopy } from "./docsModel.js"

const primaryActionFor = (route: DocsRoute) =>
  Match.value(route).pipe(
    Match.tag("DocsOverviewRoute", ({ packageSlug }) => ({
      href: docsPathFor(docsGettingStartedRoute(packageSlug)),
      label: "Get started"
    })),
    Match.tag("DocsGettingStartedRoute", () => null),
    Match.tag("DocsApiRoute", () => null),
    Match.exhaustive
  )

export const DocsHero = ({
  card,
  copy,
  route
}: {
  readonly card: Card
  readonly copy: DocsPageCopy
  readonly route: DocsRoute
}) => {
  const primaryAction = primaryActionFor(route)

  return (
    <Section
      className="border-b border-stage-200/90 pb-8 sm:pb-10"
      id="overview"
    >
      <Stack className="gap-6">
        <Stack className="max-w-[46rem] gap-3">
          {copy.context === null
            ? null
            : (
              <SemanticText
                as="code"
                className="text-ink-500"
                role="code-meta"
                text={copy.context}
                variant="expanded"
              />
            )}
          <SemanticText
            as="h1"
            className="font-light tracking-[-0.04em] text-ink-950"
            role="hero-title"
            text={copy.title}
            variant="expanded"
            wrapAuthority="native-browser"
          />
          {copy.description === null
            ? null
            : (
              <SemanticText
                as="p"
                className="max-w-[62ch] text-ink-600"
                role="hero-body"
                text={copy.description}
                variant="expanded"
                wrapAuthority="native-browser"
              />
            )}
        </Stack>
        <Cluster className="gap-3">
          {primaryAction === null
            ? null
            : (
              <ActionLink
                className={docsTheme.primaryAction}
                href={primaryAction.href}
                icon={<ArrowRightIcon aria-hidden className="h-4 w-4" />}
                label={primaryAction.label}
                variant="expanded"
              />
            )}
          <ExternalActionLink
            className={docsTheme.secondaryAction}
            href={card.repoUrl}
            icon={<CodeBracketSquareIcon aria-hidden className="h-4 w-4" />}
            label="Repository"
            variant="expanded"
          />
          <SemanticText
            as="span"
            className="ml-1 text-ink-500"
            role="status"
            text={`v${card.version}`}
            variant="compact"
          />
        </Cluster>
      </Stack>
    </Section>
  )
}
