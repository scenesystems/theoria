import { useAtom, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import type { ChangeEvent } from "react"

import { type PackageDocsPageRoute, PackageDocsSearchModel } from "../../../contracts/presentation/package-docs.js"
import { packageDocsSearchQueryAtom, packageDocsSearchStateAtom } from "../../atoms/package-docs-search.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { Cluster, Stack } from "../primitives/Layout.js"
import { ExternalLink, InternalLink } from "../primitives/Link.js"
import { SearchField } from "../primitives/SearchField.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { FailureState, RunningState } from "../primitives/Skeleton.js"
import { neutralTone } from "../primitives/theme/tone.js"

const searchResultCard = ({
  excerpt,
  href,
  packageId,
  sourceHref,
  sourceLabel,
  title
}: PackageDocsSearchModel["results"][number]) => (
  <ContentCard density="compact" key={`${packageId}:${sourceLabel}:${title}`}>
    <Stack className="gap-2">
      <Cluster className="items-start justify-between gap-3">
        <Stack className="gap-1">
          <InternalLink className="text-ink-900 underline decoration-stage-300 underline-offset-4" href={href}>
            <SemanticText as="span" role="card-title" text={title} variant="expanded" />
          </InternalLink>
          <SemanticText as="span" className="text-ink-500" role="row-label" text={packageId} variant="compact" />
        </Stack>
        <ExternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={sourceHref}>
          <SemanticText as="span" role="row-label" text={sourceLabel} variant="compact" />
        </ExternalLink>
      </Cluster>
      <SemanticText as="p" className="text-ink-700" role="card-summary" text={excerpt} variant="expanded" />
    </Stack>
  </ContentCard>
)

export const PackageDocsSearchPanel = ({ route }: { readonly route: PackageDocsPageRoute }) => {
  const [query, setQuery] = useAtom(packageDocsSearchQueryAtom)
  const state = useAtomValue(packageDocsSearchStateAtom(route))

  return (
    <ContentCard density="standard">
      <Stack className="gap-4">
        <Stack className="gap-1">
          <SemanticText as="h2" className="text-ink-900" role="section-title" text="Search docs" variant="expanded" />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="card-summary"
            text="Search the canonical package-doc corpus without leaving the current docs surface."
            variant="expanded"
          />
        </Stack>

        <SearchField
          active={query.trim().length > 0}
          disabled={false}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value)
          }}
          placeholder="Search README blocks, module docs, examples, snapshots, and proof commands..."
          tone={neutralTone}
          value={query}
        />

        {Match.value(state).pipe(
          Match.tag("IdlePackageDocsSearch", ({ selectedPackageId }) => {
            const model = PackageDocsSearchModel.project({ packageId: selectedPackageId, query: "", results: [] })

            return (
              <Stack className="gap-1">
                <SemanticText
                  as="p"
                  className="text-ink-600"
                  role="row-label"
                  text={model.scopeLabel}
                  variant="compact"
                />
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="status"
                  text={model.scopeDescription}
                  variant="expanded"
                />
              </Stack>
            )
          }),
          Match.tag("LoadingPackageDocsSearch", () => <RunningState text="Searching package docs..." />),
          Match.tag("FailedPackageDocsSearch", ({ description }) => <FailureState description={description} />),
          Match.tag("ReadyPackageDocsSearch", ({ query: readyQuery, results, selectedPackageId }) => {
            const model = PackageDocsSearchModel.project({
              packageId: selectedPackageId,
              query: readyQuery,
              results
            })

            return (
              <Stack className="gap-3">
                <Stack className="gap-1">
                  <SemanticText
                    as="p"
                    className="text-ink-600"
                    role="row-label"
                    text={model.scopeLabel}
                    variant="compact"
                  />
                  <SemanticText
                    as="p"
                    className="text-ink-700"
                    role="status"
                    text={model.resultSummary}
                    variant="expanded"
                  />
                </Stack>
                <Stack className="gap-3">
                  {model.results.map(searchResultCard)}
                </Stack>
              </Stack>
            )
          }),
          Match.exhaustive
        )}
      </Stack>
    </ContentCard>
  )
}
