import { Match } from "effect"

import type { PackageDocsGroup } from "../../../contracts/presentation/package-docs.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { ExternalLink } from "../primitives/Link.js"
import { Layer, Section, Stack } from "../primitives/Layout.js"
import { HighlightedCode } from "../primitives/code/HighlightedCode.js"
import { SemanticText } from "../primitives/SemanticText.js"

const sectionContent = ({
  content,
  title,
  sourceHref,
  sourceLabel,
  kind
}: {
  readonly content: string
  readonly kind: "code" | "prose"
  readonly sourceHref: string
  readonly sourceLabel: string
  readonly title: string
}) => (
  <ContentCard density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText as="h3" className="text-ink-900" role="card-title" text={title} variant="compact" />
        <ExternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={sourceHref}>
          <SemanticText as="span" role="row-label" text={sourceLabel} variant="compact" />
        </ExternalLink>
      </Stack>

      {kind === "code"
        ? <HighlightedCode source={content} variant="expanded" />
        : <SemanticText as="p" className="text-ink-700" role="card-summary" text={content} variant="expanded" />}
    </Stack>
  </ContentCard>
)

export const PackageDocsSectionGroups = ({ groups }: { readonly groups: ReadonlyArray<PackageDocsGroup> }) => (
  <Stack className="gap-6">
    {groups.map((group) => (
      <Section key={group.title}>
        <Stack className="gap-4">
          <SemanticText as="h2" className="text-ink-900" role="section-title" text={group.title} variant="expanded" />
          <Stack className="gap-3">
            {group.sections.map((section, index) => (
              <Layer key={`${group.title}:${section.id}:${String(index)}`}>
                {Match.value(section).pipe(
                  Match.tag("prose", ({ content, sourceHref, sourceLabel, title }) =>
                    sectionContent({ content, kind: "prose", sourceHref, sourceLabel, title })),
                  Match.tag("code", ({ content, sourceHref, sourceLabel, title }) =>
                    sectionContent({ content, kind: "code", sourceHref, sourceLabel, title })),
                  Match.exhaustive
                )}
              </Layer>
            ))}
          </Stack>
        </Stack>
      </Section>
    ))}
  </Stack>
)
