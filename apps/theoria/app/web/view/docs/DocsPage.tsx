import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsManifestAtom } from "../../atoms/docs-data.js"
import { docsKeyboardShortcutsAtom } from "../../atoms/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Main, Section, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsHeader } from "./DocsHeader.js"
import { docsApiModuleFor, docsGuideFor, docsPackageFor } from "./docsModel.js"
import { ApiResource, GuideResource } from "./DocsResourceView.js"
import { DocsSearchDialog } from "./DocsSearchDialog.js"
import { DocsStatus } from "./DocsStatus.js"

const PackageIndex = ({ manifest }: { readonly manifest: DocsManifest }) => (
  <Layer className={docsTheme.root}>
    <DocsHeader activePackage={null} packages={manifest.packages} />
    <Main className="mx-auto w-full max-w-[82rem] px-5 py-10 sm:px-8 sm:py-14">
      <Stack className="gap-8">
        <SemanticText as="h1" className="text-ink-950" role="hero-title" text="Packages" />
        <Layer className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Arr.map(
            manifest.packages,
            (docsPackage) => (
              <Section
                className="group rounded-2xl border border-stage-200/90 bg-stage-0/78 p-5 shadow-chip transition-colors hover:border-stage-300"
                key={docsPackage.slug}
              >
                <Stack className="h-full gap-5">
                  <Stack className="gap-2">
                    <InternalLink
                      className="outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"
                      href={docsPackage.overview.path}
                    >
                      <SemanticText
                        as="h2"
                        className="text-ink-950 group-hover:text-ink-700"
                        role="card-title"
                        text={docsPackage.name}
                      />
                    </InternalLink>
                    <SemanticText as="p" className="text-ink-600" role="card-summary" text={docsPackage.description} />
                  </Stack>
                  <SemanticText
                    as="span"
                    className="mt-auto text-ink-400"
                    role="code-meta"
                    text={`v${docsPackage.version}`}
                  />
                </Stack>
              </Section>
            )
          )}
        </Layer>
      </Stack>
    </Main>
    <DocsSearchDialog activePackageSlug={null} manifest={manifest} />
  </Layer>
)

const MissingRoute = ({ manifest }: { readonly manifest: DocsManifest }) => (
  <Layer className={docsTheme.root}>
    <DocsHeader activePackage={null} packages={manifest.packages} />
    <Main className="mx-auto w-full max-w-3xl px-5 py-20">
      <DocsStatus retry={() => undefined} state="not-found" />
    </Main>
    <DocsSearchDialog activePackageSlug={null} manifest={manifest} />
  </Layer>
)

const ResolvedDocsRoute = ({ manifest, route }: { readonly manifest: DocsManifest; readonly route: DocsRoute }) =>
  Match.value(route).pipe(
    Match.tag("DocsIndexRoute", () => <PackageIndex manifest={manifest} />),
    Match.tag("DocsNotFoundRoute", () => <MissingRoute manifest={manifest} />),
    Match.orElse((packageRoute) =>
      Option.match(docsPackageFor(manifest, packageRoute), {
        onNone: () => <MissingRoute manifest={manifest} />,
        onSome: (docsPackage) =>
          Match.value(packageRoute).pipe(
            Match.tags({
              DocsOverviewRoute: (guideRoute) =>
                Option.match(docsGuideFor(docsPackage, guideRoute), {
                  onNone: () => <MissingRoute manifest={manifest} />,
                  onSome: (guide) => (
                    <GuideResource
                      asset={guide.asset}
                      docsPackage={docsPackage}
                      manifest={manifest}
                      route={guideRoute}
                    />
                  )
                }),
              DocsGuideRoute: (guideRoute) =>
                Option.match(docsGuideFor(docsPackage, guideRoute), {
                  onNone: () => <MissingRoute manifest={manifest} />,
                  onSome: (guide) => (
                    <GuideResource
                      asset={guide.asset}
                      docsPackage={docsPackage}
                      manifest={manifest}
                      route={guideRoute}
                    />
                  )
                }),
              DocsApiRoute: (apiRoute) =>
                Option.match(docsApiModuleFor(docsPackage, apiRoute), {
                  onNone: () => <MissingRoute manifest={manifest} />,
                  onSome: (module) => (
                    <ApiResource asset={module.asset} docsPackage={docsPackage} manifest={manifest} route={apiRoute} />
                  )
                })
            }),
            Match.exhaustive
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
        <Main className="mx-auto max-w-3xl px-5 py-20">
          <DocsStatus retry={refresh} state="loading" />
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
