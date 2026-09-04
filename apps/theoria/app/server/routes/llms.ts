import { HttpServerResponse } from "@effect/platform"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest, DocsPackageSummary } from "@theoria/docs-model"
import { fullCanonicalUrl, siteMetadata } from "../../contracts/metadata.js"
import { DocsManifestStore } from "../config/docs-manifest-store.js"

/**
 * `/llms.txt` in the llmstxt.org v2 format: an H1, a blockquote summary,
 * plain paragraphs, then H2 sections whose every entry is
 * `- [name](url): notes`. The file is rendered from the docs manifest so it
 * lists the same packages, versions, and guides the site does.
 *
 * Package entries link each README as raw markdown at the documented
 * revision. That text is what the site renders as the package guides, and
 * agents that do not run JavaScript cannot read the site's own pages.
 */

const rawRepositoryUrl = siteMetadata.repositoryUrl.replace("https://github.com/", "https://raw.githubusercontent.com/")

const entry = (name: string, url: string, notes: string): string => `- [${name}](${url}): ${notes}`

const section = (title: string, entries: ReadonlyArray<string>): ReadonlyArray<string> => [
  "",
  `## ${title}`,
  "",
  ...entries
]

const readmeEntry = (revision: string, docsPackage: DocsPackageSummary): string =>
  entry(
    `${docsPackage.name} ${docsPackage.version}`,
    `${rawRepositoryUrl}/${revision}/packages/${docsPackage.slug}/README.md`,
    docsPackage.overview.summary
  )

// Guide titles can contain commas ("Bytes, streams, and authentication"), so
// the list separator is a semicolon.
const documentationEntry = (docsPackage: DocsPackageSummary): string =>
  entry(
    `${docsPackage.name} documentation`,
    fullCanonicalUrl(docsPackage.overview.path),
    `Guides: ${Arr.join(Arr.map(docsPackage.guides, (guide) => guide.title), "; ")}. `
      + `API reference for ${String(docsPackage.apiModules.length)} modules under ${
        fullCanonicalUrl(`${docsPackage.overview.path}/api`)
      }.`
  )

const npmEntry = (docsPackage: DocsPackageSummary): string =>
  entry(`${docsPackage.name} on npm`, docsPackage.npmUrl, `Published releases and install instructions.`)

const preamble: ReadonlyArray<string> = [
  `# ${siteMetadata.siteName}`,
  "",
  `> ${siteMetadata.tagline}. ${siteMetadata.defaultDescription}`,
  "",
  "Every package is published on npm under the @scenesystems scope, is MIT licensed, and requires Effect 3 as a peer dependency. "
  + "The README linked for each package is the text the documentation site renders as that package's guides, and the API reference is generated from the source at the same revision. "
  + "Documentation pages render in the browser; read the README when you need the text without running JavaScript."
]

const optionalEntries = (packages: ReadonlyArray<DocsPackageSummary>): ReadonlyArray<string> => [
  entry(
    "Source repository",
    siteMetadata.repositoryUrl,
    "Monorepo with every package, its tests, and runnable examples."
  ),
  entry("Documentation index", fullCanonicalUrl("/docs"), "Every package, guide, and API module in one place."),
  entry("Sitemap", fullCanonicalUrl("/sitemap.xml"), "Every indexable page on this site."),
  entry("Scene Systems", "https://scenesystems.io", "The organization that builds and maintains Theoria."),
  ...Arr.map(packages, npmEntry)
]

export const renderLlmsTxt = (manifest: Option.Option<DocsManifest>): string => {
  const packages = Option.match(manifest, {
    onNone: (): ReadonlyArray<DocsPackageSummary> => [],
    onSome: (docsManifest) => docsManifest.packages
  })
  const packageSections = Option.match(manifest, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (docsManifest) => [
      ...section(
        "Packages",
        Arr.map(docsManifest.packages, (docsPackage) => readmeEntry(docsManifest.revision, docsPackage))
      ),
      ...section("Documentation", Arr.map(docsManifest.packages, documentationEntry))
    ]
  })

  return `${Arr.join([...preamble, ...packageSections, ...section("Optional", optionalEntries(packages))], "\n")}\n`
}

export const llmsTxtRoute = Effect.gen(function*() {
  const docsManifestStore = yield* DocsManifestStore
  const docsManifest = yield* Effect.option(docsManifestStore.manifest)

  return HttpServerResponse.text(renderLlmsTxt(docsManifest), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  })
})
