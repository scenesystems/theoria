import { Separator } from "@base-ui-components/react/separator"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"

import type { Card } from "../../../contracts/card.js"
import type { GroupTheme } from "../../../contracts/theme.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { Cluster, Layer } from "../primitives/Layout.js"
import { CardLink, ExternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const InstrumentCard = ({
  card,
  theme
}: {
  readonly card: Card
  readonly theme: GroupTheme
}) => (
  <ContentCard className={`relative border-l-[3px] ${theme.accentBorder}`} density="standard">
    <Cluster className="items-start justify-between gap-3">
      <CardLink className="min-w-0 flex-1" href={card.deepDivePath}>
        <SemanticText as="h3" className="text-ink-900" role="card-title" text={card.title} variant="compact" />
      </CardLink>
      {card.interactiveLabel !== undefined
        ? (
          <Layer
            as="span"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-150 ${theme.versionBg} ${theme.versionText}`}
          >
            <SemanticText as="span" role="tab-label" text="Live Demo" variant="compact" />
            <ArrowTopRightOnSquareIcon aria-hidden className="h-3 w-3 shrink-0" />
          </Layer>
        )
        : (
          <Layer
            as="span"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stage-200/90 px-2.5 py-1 text-ink-500"
          >
            <SemanticText as="span" role="tab-label" text="Coming Soon" variant="compact" />
          </Layer>
        )}
    </Cluster>

    <SemanticText
      as="p"
      className="line-clamp-2 min-w-0 flex-1 text-ink-700"
      role="card-summary"
      text={card.useCase}
      variant="compact"
    />

    <Separator className="h-px bg-stage-200/80" />

    <Cluster className="relative z-10 flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <ExternalLink
        className="inline-flex items-baseline text-ink-700 transition-colors hover:text-ink-900"
        href={card.npmUrl}
      >
        <SemanticText as="span" role="row-label" text={`npm@${card.version}`} variant="compact" />
      </ExternalLink>
      <SemanticText as="span" className="text-ink-400" role="row-label" text="·" variant="compact" />
      <ExternalLink
        className="inline-flex items-baseline text-ink-700 transition-colors hover:text-ink-900"
        href={card.repoUrl}
      >
        <SemanticText as="span" role="row-label" text="Source" variant="compact" />
      </ExternalLink>
      <SemanticText as="span" className="text-ink-400" role="row-label" text="·" variant="compact" />
      <SemanticText as="span" className="text-ink-700" role="row-label" text={card.license} variant="compact" />
    </Cluster>
  </ContentCard>
)
