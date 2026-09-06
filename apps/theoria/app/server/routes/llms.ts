import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest, DocsPackageSummary } from "@theoria/docs-model"
import { fullCanonicalUrl, siteMetadata } from "../../contracts/metadata.js"
import { DocsManifestStore } from "../config/docs-manifest-store.js"
import { textContentType } from "../config/static-store.js"

/**
 * `/llms.txt` in the llmstxt.org v2 format: an H1, a blockquote summary,
 * plain paragraphs, then H2 sections whose every entry is
 * `- [name](url): notes`. The file is rendered from the docs manifest so it
 * lists the same packages and versions the site does. Notes stay to one
 * short sentence per entry; the linked pages carry the detail.
 *
 * Package entries link each README as raw markdown at the documented
 * revision. That text is what the site renders as the package guides, and
 * agents that do not run JavaScript cannot read the site's own pages.
 */

const rawRepositoryUrl = siteMetadata.repositoryUrl.replace("https://github.com/", "https://raw.githubusercontent.com/")

// Package descriptions come from package.json and are written without a
// terminal period; every other note ends with one.
const sentence = (notes: string): string => notes.endsWith(".") ? notes : `${notes}.`

const entry = (name: string, url: string, notes: string): string => `- [${name}](${url}): ${sentence(notes)}`

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
    docsPackage.description
  )

const documentationEntry = (docsPackage: DocsPackageSummary): string =>
  entry(
    `${docsPackage.name} docs`,
    fullCanonicalUrl(docsPackage.overview.path),
    `${String(docsPackage.guides.length)} guides and the API reference for ${
      String(docsPackage.apiModules.length)
    } modules.`
  )

const preamble: ReadonlyArray<string> = [
  `# ${siteMetadata.siteName}`,
  "",
  `> ${siteMetadata.tagline}. ${siteMetadata.defaultDescription}`,
  "",
  "Every package is Effect-native, MIT licensed, and published on npm under the @scenesystems scope. "
  + "Each README below is the source of that package's guides; the documentation pages render in the browser."
]

const optionalEntries: ReadonlyArray<string> = [
  entry("Source repository", siteMetadata.repositoryUrl, "Every package, its tests, and runnable examples."),
  entry("Sitemap", fullCanonicalUrl("/sitemap.xml"), "Every indexable page on this site."),
  entry("Scene Systems", "https://scenesystems.io", "The organization behind Theoria.")
]

export const renderLlmsTxt = (docsManifest: DocsManifest): string =>
  `${
    Arr.join(
      [
        ...preamble,
        ...section(
          "Packages",
          Arr.map(docsManifest.packages, (docsPackage) => readmeEntry(docsManifest.revision, docsPackage))
        ),
        ...section("Documentation", Arr.map(docsManifest.packages, documentationEntry)),
        ...section("Optional", optionalEntries)
      ],
      "\n"
    )
  }\n`

/** The manifest is the source of every package entry; without it there is no llms.txt, and the failure says why. */
export const llmsTxtRoute = Effect.gen(function*() {
  const docsManifestStore = yield* DocsManifestStore

  return HttpServerResponse.text(renderLlmsTxt(yield* docsManifestStore.manifest), {
    status: 200,
    headers: {
      "content-type": textContentType,
      "cache-control": "public, max-age=3600"
    }
  })
})
