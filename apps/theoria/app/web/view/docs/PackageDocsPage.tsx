import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import type { PackageName } from "@theoria/source-proof"
import { Match, Option } from "effect"

import { cards } from "../../../contracts/card.js"
import { metadataForPackageDocs } from "../../../contracts/metadata.js"
import { packageDocsPagePath } from "../../../contracts/package-docs.js"
import { packageDocsBundleAtom, packageDocsCatalogAtom } from "../../atoms/package-docs.js"
import { appTheme, neutralToneClasses, toneClassesForCard } from "../primitives/designSystem.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { ExternalLink, InternalLink } from "../primitives/Link.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { HighlightedCode } from "../primitives/code/HighlightedCode.js"
import { FailureState, RunningState } from "../primitives/Skeleton.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"

import { packageDocsPageModel } from "../packageDocsModel.js"

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

const PackageDocsLoaded = ({ packageId }: { readonly packageId: PackageName | null }) => {
  const catalogResult = useAtomValue(packageDocsCatalogAtom)
  const requestedBundleResult = useAtomValue(packageDocsBundleAtom(packageId))
  const fallbackPackageId = Result.match(catalogResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (success) => success.value[0]?.packageId ?? null
  })
  const fallbackBundleResult = useAtomValue(packageDocsBundleAtom(fallbackPackageId))
  const selectedPackageId = packageId ?? fallbackPackageId

  return Result.match(catalogResult, {
    onInitial: () => <RunningState text="Loading package docs catalog…" />,
    onFailure: (failure) => <FailureState description={failure.cause.toString()} />,
    onSuccess: (catalogSuccess) => {
      const bundleResult = packageId === null ? fallbackBundleResult : requestedBundleResult

      return Result.match(bundleResult, {
        onInitial: () => <RunningState text="Loading package docs bundle…" />,
        onFailure: (failure) => (
          <Stack className="gap-6">
            <ContentCard density="standard">
              <Stack className="gap-3">
                <SemanticText as="h2" className="text-ink-900" role="section-title" text="Packages" variant="expanded" />
                <Stack className="gap-2">
                  {catalogSuccess.value.map((entry) => (
                    <InternalLink
                      className="text-ink-700 underline decoration-stage-300 underline-offset-4"
                      href={packageDocsPagePath(entry.packageId)}
                      key={entry.packageId}
                    >
                      <SemanticText as="span" role="row-value" text={entry.packageId} variant="expanded" />
                    </InternalLink>
                  ))}
                </Stack>
              </Stack>
            </ContentCard>
            <FailureState description={failure.cause.toString()} />
          </Stack>
        ),
        onSuccess: (bundleSuccess) =>
          Option.match(bundleSuccess.value, {
            onNone: () => <RunningState text="Preparing package docs bundle…" />,
            onSome: (bundle) => {
              const model = packageDocsPageModel({
                bundle,
                catalog: catalogSuccess.value,
                selectedPackageId: selectedPackageId ?? bundle.packageId
              })
              const card = cards.find((candidate) => candidate.packageName === model.packageId)
              const tone = card === undefined ? neutralToneClasses : toneClassesForCard(card.id)

              return (
                <Stack className="gap-6">
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
                        {model.links.map((link) =>
                          link.external
                            ? (
                              <ExternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={link.href} key={link.label}>
                                <SemanticText as="span" role="row-label" text={link.label} variant="compact" />
                              </ExternalLink>
                            )
                            : (
                              <InternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={link.href} key={link.label}>
                                <SemanticText as="span" role="row-label" text={link.label} variant="compact" />
                              </InternalLink>
                            ))}
                      </Cluster>

                      <Cluster className="gap-x-6 gap-y-3">
                        {model.summary.map(([label, value]) => (
                          <Stack className="gap-1" key={label}>
                            <SemanticText as="span" className="text-ink-500" role="row-label" text={label} variant="compact" />
                            <SemanticText as="span" className="text-ink-900" role="row-value" text={value} variant="expanded" />
                          </Stack>
                        ))}
                      </Cluster>
                    </Stack>
                  </ContentCard>

                  <Section>
                    <Stack className="gap-3">
                      <SemanticText as="h2" className="text-ink-900" role="section-title" text="Packages" variant="expanded" />
                      <Cluster className="gap-2">
                        {model.navigation.map((item) => (
                          <InternalLink
                            className={item.selected
                              ? "rounded-full border border-stage-300 bg-stage-0/98 px-3 py-2 text-ink-900"
                              : "rounded-full border border-stage-200/90 bg-stage-0/88 px-3 py-2 text-ink-700"}
                            href={item.href}
                            key={item.packageId}
                          >
                            <SemanticText as="span" role="tab-label" text={item.label} variant="compact" />
                          </InternalLink>
                        ))}
                      </Cluster>
                    </Stack>
                  </Section>

                  {model.groups.map((group) => (
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
            }
          })
      })
    }
  })
}

export const PackageDocsPage = ({ packageId }: { readonly packageId: PackageName | null }) => (
  <>
    <DocumentHead metadata={metadataForPackageDocs(packageId)} />

    <Layer as="main" className={appTheme.root}>
      <Layer aria-hidden className={appTheme.atmosphericGlowA} />
      <Layer aria-hidden className={appTheme.atmosphericGlowB} />

      <Layer className={appTheme.content}>
        <SiteHeader />
        <PackageDocsLoaded packageId={packageId} />
        <SiteFooter />
      </Layer>
    </Layer>
  </>
)
