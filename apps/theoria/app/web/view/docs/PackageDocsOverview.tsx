import type { PackageDocsPageModel } from "../../../contracts/presentation/package-docs.js"
import { ExternalLink, InternalLink } from "../primitives/Link.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { Cluster, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { neutralTone, toneForCard } from "../primitives/theme/tone.js"

const summaryItem = ({
  label,
  value
}: PackageDocsPageModel["summary"][number]) => (
  <Stack className="gap-1" key={label}>
    <SemanticText as="span" className="text-ink-500" role="row-label" text={label} variant="compact" />
    <SemanticText as="span" className="text-ink-900" role="row-value" text={value} variant="expanded" />
  </Stack>
)

const docsLink = ({
  external,
  href,
  label
}: PackageDocsPageModel["links"][number]) =>
  external
    ? (
      <ExternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={href} key={label}>
        <SemanticText as="span" role="row-label" text={label} variant="compact" />
      </ExternalLink>
    )
    : (
      <InternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={href} key={label}>
        <SemanticText as="span" role="row-label" text={label} variant="compact" />
      </InternalLink>
    )

export const PackageDocsOverview = ({ model }: { readonly model: PackageDocsPageModel }) => {
  const tone = model.entryId === null ? neutralTone : toneForCard(model.entryId)

  return (
    <ContentCard className={tone.border} density="standard" shape="left-accent">
      <Stack className="gap-3">
        <Cluster className="items-center justify-between gap-3">
          <Stack className="gap-1">
            <SemanticText as="h1" className="text-ink-900" role="hero-title" text={model.title} variant="expanded" />
            <SemanticText as="p" className="text-ink-700" role="card-summary" text={model.description} variant="expanded" />
          </Stack>
          <SemanticText as="span" className={tone.textStrong} role="tab-label" text={`v${model.version}`} variant="compact" />
        </Cluster>

        <Cluster className="gap-3">
          {model.links.map(docsLink)}
        </Cluster>

        <Cluster className="gap-x-6 gap-y-3">
          {model.summary.map(summaryItem)}
        </Cluster>
      </Stack>
    </ContentCard>
  )
}
