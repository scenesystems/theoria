import { Option } from "effect"
import * as Arr from "effect/Array"

import type { ApiCategory, ApiExport, ApiPage } from "@theoria/docs-model"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { ApiExportView } from "./ApiExportView.js"

export const apiCategoryAnchor = (name: string): string =>
  `category-${name.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "")}`

const exportFor = (page: ApiPage, id: string): Option.Option<ApiExport> =>
  Arr.findFirst(page.exports, (apiExport) => apiExport.id === id)

const ApiCategoryView = ({ category, page }: { readonly category: ApiCategory; readonly page: ApiPage }) => (
  <Section className="scroll-mt-28" id={apiCategoryAnchor(category.name)}>
    <Stack className="gap-8">
      <SemanticText as="h2" className="capitalize text-ink-950" role="section-title" text={category.name} />
      <Stack className="gap-10">
        {Arr.filterMap(category.exportIds, (id) =>
          Option.map(exportFor(page, id), (apiExport) => <ApiExportView apiExport={apiExport} key={apiExport.id} />))}
      </Stack>
    </Stack>
  </Section>
)

export const ApiPageView = ({ page }: { readonly page: ApiPage }) => (
  <Stack className="gap-12 sm:gap-14">
    <Section className="border-b border-stage-200/90 pb-8">
      <Stack className="gap-5">
        <Stack className="gap-3">
          <SemanticText as="code" className="text-ink-500" role="code-meta" text={page.package.name} />
          <SemanticText
            as="h1"
            className="font-light tracking-[-0.04em] text-ink-950"
            role="hero-title"
            text={page.module.name}
          />
          <ApiDocumentationView docs={page.module.docs} />
        </Stack>
        <Cluster className="gap-4">
          <SemanticText as="span" className="text-ink-500" role="status" text={`v${page.package.version}`} />
          <SemanticText
            as="span"
            className="text-ink-400"
            role="code-meta"
            text={`${String(page.exports.length)} exports`}
          />
          <ExternalLink
            className="font-body text-sm font-medium text-ink-700 underline decoration-stage-400 underline-offset-4 hover:text-ink-950"
            href={page.module.sourceUrl}
          >
            Source
          </ExternalLink>
        </Cluster>
      </Stack>
    </Section>
    {Arr.map(page.categories, (category) => <ApiCategoryView category={category} key={category.name} page={page} />)}
  </Stack>
)
