import { ArrowRightIcon, CodeBracketSquareIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"

import type { Card } from "../../../contracts/card.js"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsApiRoute, docsGettingStartedRoute, docsPathFor } from "../../../contracts/docs.js"
import { ActionLink, ExternalActionLink } from "../primitives/ActionControl.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import type { DocsPageCopy } from "./docsModel.js"

const primaryActionFor = (route: DocsRoute) =>
  Match.value(route).pipe(
    Match.tag("DocsGettingStartedRoute", ({ packageSlug }) => ({
      href: docsPathFor(docsApiRoute(packageSlug)),
      label: "Browse API"
    })),
    Match.orElse(() => ({
      href: docsPathFor(docsGettingStartedRoute(route.packageSlug)),
      label: "Get started"
    }))
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
      className={`${docsTheme.raisedSurface} relative overflow-hidden px-5 py-7 sm:px-8 sm:py-10`}
      id="overview"
    >
      <Stack className="relative z-10 gap-7">
        <Stack className="max-w-[44rem] gap-4">
          <Cluster className="gap-2">
            <SemanticText
              as="span"
              className="rounded-full border border-stage-300/85 bg-stage-50/78 px-3 py-1 text-ink-700"
              role="status"
              text={copy.eyebrow}
              variant="compact"
            />
            <SemanticText
              as="code"
              className="text-ink-500"
              role="code-meta"
              text={card.packageName}
              variant="expanded"
            />
          </Cluster>
          <SemanticText
            as="h1"
            className="max-w-[18ch] font-light tracking-[-0.04em] text-ink-950"
            role="hero-title"
            text={copy.title}
            variant="expanded"
            wrapAuthority="native-browser"
          />
          <SemanticText
            as="p"
            className="max-w-[62ch] text-ink-600"
            role="hero-body"
            text={copy.description}
            variant="expanded"
            wrapAuthority="native-browser"
          />
        </Stack>
        <Cluster className="gap-3">
          <ActionLink
            className={docsTheme.primaryAction}
            href={primaryAction.href}
            icon={<ArrowRightIcon aria-hidden className="h-4 w-4" />}
            label={primaryAction.label}
            variant="expanded"
          />
          <ExternalActionLink
            className={docsTheme.secondaryAction}
            href={card.repoUrl}
            icon={<CodeBracketSquareIcon aria-hidden className="h-4 w-4" />}
            label="View source"
            variant="expanded"
          />
        </Cluster>
        <Cluster className="gap-x-5 gap-y-2 border-t border-stage-200/82 pt-5">
          <SemanticText
            as="span"
            className="text-ink-700"
            role="status"
            text={`v${card.version}`}
            variant="compact"
          />
          <SemanticText
            as="span"
            className="text-ink-500"
            role="status"
            text={card.license}
            variant="compact"
          />
          <SemanticText
            as="span"
            className="text-ink-500"
            role="status"
            text="TypeScript"
            variant="compact"
          />
        </Cluster>
      </Stack>
      <Stack
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-16 h-64 w-64 rotate-12 gap-3 opacity-65"
      >
        <Section className="h-20 rounded-[1.5rem] border border-tone-math-200/70 bg-tone-math-100/55" />
        <Section className="ml-10 h-20 rounded-[1.5rem] border border-tone-text-200/70 bg-tone-text-100/55" />
      </Stack>
    </Section>
  )
}
