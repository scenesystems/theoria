import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { Id } from "../../../contracts/id.js"
import { docsManifestAtom } from "../../atoms/docs-data.js"
import { docsKeyboardShortcutsAtom } from "../../atoms/docs.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { neutralToneClasses, toneClassesForCard } from "../primitives/designSystem.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Main, Stack } from "../primitives/Layout.js"
import { CardLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsHeader } from "./DocsHeader.js"
import { docsApiModuleFor, docsGuideFor, docsPackageFor } from "./docsModel.js"
import { ApiResource, GuideResource } from "./DocsResourceView.js"
import { DocsSearchDialog } from "./DocsSearchDialog.js"
import { DocsStatus } from "./DocsStatus.js"
import { DocsPackageShell, DocsResourceFrame } from "./DocsWorkbench.js"

const isCardId = Schema.is(Id)

const PackageIndex = ({ manifest }: { readonly manifest: DocsManifest }) => (
  <Layer className={docsTheme.root}>
    <DocsHeader activePackage={Option.none()} packages={manifest.packages} />
    <Main
      className="mx-auto w-full max-w-[82rem] px-5 py-10 outline-none sm:px-8 sm:py-14"
      data-route-focus
      tabIndex={-1}
    >
      <Stack className="docs-route-enter gap-8">
        <SemanticText as="h1" className="text-ink-950" role="hero-title" text="Packages" />
        <Layer className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Arr.map(
            manifest.packages,
            (docsPackage) => {
              const tone = isCardId(docsPackage.slug) ? toneClassesForCard(docsPackage.slug) : neutralToneClasses

              return (
                <ContentCard
                  className={`group relative h-full transition-[border-color,background-color,box-shadow] hover:bg-stage-0/94 hover:shadow-surface ${tone.border}`}
                  data-docs-package={docsPackage.slug}
                  density="standard"
                  key={docsPackage.slug}
                  shape="left-accent"
                >
                  <Stack className="h-full gap-5">
                    <Stack className="gap-2">
                      <CardLink
                        className="outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ink-900/20"
                        href={docsPackage.overview.path}
                      >
                        <SemanticText
                          as="h2"
                          className="text-ink-950 group-hover:text-ink-700"
                          role="card-title"
                          text={docsPackage.name}
                        />
                      </CardLink>
                      <SemanticText
                        as="p"
                        className="text-ink-600"
                        role="card-summary"
                        text={docsPackage.description}
                      />
                    </Stack>
                    <SemanticText
                      as="span"
                      className="mt-auto text-ink-500"
                      role="code-meta"
                      text={`v${docsPackage.version}`}
                    />
                  </Stack>
                </ContentCard>
              )
            }
          )}
        </Layer>
      </Stack>
    </Main>
    <DocsSearchDialog activePackageSlug={Option.none()} manifest={manifest} />
  </Layer>
)

const MissingRoute = ({ manifest }: { readonly manifest: DocsManifest }) => (
  <Layer className={docsTheme.root}>
    <DocsHeader activePackage={Option.none()} packages={manifest.packages} />
    <Main className="mx-auto w-full max-w-3xl px-5 py-20 outline-none" data-route-focus tabIndex={-1}>
      <DocsStatus state="not-found" />
    </Main>
    <DocsSearchDialog activePackageSlug={Option.none()} manifest={manifest} />
  </Layer>
)

const ResolvedDocsRoute = ({ manifest, route }: { readonly manifest: DocsManifest; readonly route: DocsRoute }) =>
  Match.value(route).pipe(
    Match.tag("DocsIndexRoute", () => <PackageIndex manifest={manifest} />),
    Match.tag("DocsNotFoundRoute", () => <MissingRoute manifest={manifest} />),
    Match.orElse((packageRoute) =>
      Option.match(docsPackageFor(manifest, packageRoute), {
        onNone: () => <MissingRoute manifest={manifest} />,
        onSome: (docsPackage) => (
          <DocsPackageShell docsPackage={docsPackage} manifest={manifest} route={packageRoute}>
            {Match.value(packageRoute).pipe(
              Match.tags({
                DocsOverviewRoute: (guideRoute) =>
                  Option.match(docsGuideFor(docsPackage, guideRoute), {
                    onNone: () => (
                      <DocsResourceFrame anchors={[]} route={guideRoute}>
                        <DocsStatus state="not-found" />
                      </DocsResourceFrame>
                    ),
                    onSome: (guide) => <GuideResource asset={guide.asset} route={guideRoute} />
                  }),
                DocsGuideRoute: (guideRoute) =>
                  Option.match(docsGuideFor(docsPackage, guideRoute), {
                    onNone: () => (
                      <DocsResourceFrame anchors={[]} route={guideRoute}>
                        <DocsStatus state="not-found" />
                      </DocsResourceFrame>
                    ),
                    onSome: (guide) => <GuideResource asset={guide.asset} route={guideRoute} />
                  }),
                DocsApiRoute: (apiRoute) =>
                  Option.match(docsApiModuleFor(docsPackage, apiRoute), {
                    onNone: () => (
                      <DocsResourceFrame anchors={[]} route={apiRoute}>
                        <DocsStatus state="not-found" />
                      </DocsResourceFrame>
                    ),
                    onSome: (module) => <ApiResource asset={module.asset} route={apiRoute} />
                  })
              }),
              Match.exhaustive
            )}
          </DocsPackageShell>
        )
      })
    )
  )

export const DocsPage = ({ route }: { readonly route: DocsRoute }) => {
  useAtomValue(docsKeyboardShortcutsAtom)
  const manifest = useAtomValue(docsManifestAtom)
  const refresh = useAtomRefresh(docsManifestAtom)

  return Result.match(manifest, {
    onInitial: () => (
      <Layer className={docsTheme.root}>
        <DocsHeader activePackage={Option.none()} loading packages={[]} />
        <Main className="mx-auto w-full max-w-[82rem] px-5 py-10 sm:px-8 sm:py-14">
          <DocsStatus kind="index" state="loading" />
        </Main>
      </Layer>
    ),
    onFailure: () => (
      <Layer className={docsTheme.root}>
        <Main className="mx-auto max-w-3xl px-5 py-20">
          <DocsStatus retry={refresh} state="failure" />
        </Main>
      </Layer>
    ),
    onSuccess: ({ value }) => <ResolvedDocsRoute manifest={value} route={route} />
  })
}
