import { Option } from "effect"
import * as Arr from "effect/Array"

import type { ApiCategory, ApiExport, DocsApiExportSummary, DocsApiModuleIndex } from "@theoria/docs-model"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { AnchorLink, ExternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { ApiExportView } from "./ApiExportView.js"
import { apiCategoryAnchor } from "./docsModel.js"

const exportFor = (page: DocsApiModuleIndex, id: string): Option.Option<DocsApiExportSummary> =>
  Arr.findFirst(page.exports, (apiExport) => apiExport.id === id)

const ApiExportIndexItem = ({ apiExport }: { readonly apiExport: DocsApiExportSummary }) => (
  <li>
    <AnchorLink
      className="group block rounded-xl px-3 py-4 outline-none transition-colors hover:bg-stage-0/72 focus-visible:bg-stage-0/72 focus-visible:ring-2 focus-visible:ring-ink-900/20 sm:px-4"
      href={`#${apiExport.anchor}`}
    >
      <Stack className="gap-1.5">
        <Cluster className="gap-2.5">
          <SemanticText
            as="h3"
            className="break-words text-ink-950 group-hover:text-ink-700"
            role="selection-title"
            text={apiExport.name}
          />
          <SemanticText as="span" className="text-ink-400" role="row-label" text={apiExport.importKind} />
        </Cluster>
        <SemanticText as="p" className="text-ink-600" role="row-value" text={apiExport.summary} />
      </Stack>
    </AnchorLink>
  </li>
)

const ApiCategoryIndex = ({
  category,
  page
}: {
  readonly category: ApiCategory
  readonly page: DocsApiModuleIndex
}) => (
  <Section className="scroll-mt-28" id={apiCategoryAnchor(category.name)}>
    <Stack className="gap-4">
      <SemanticText as="h2" className="capitalize text-ink-950" role="section-title" text={category.name} />
      <Stack as="ul" className="divide-y divide-stage-200/80 border-y border-stage-200/80 py-1">
        {Arr.filterMap(category.exportIds, (id) =>
          Option.map(
            exportFor(page, id),
            (apiExport) => <ApiExportIndexItem apiExport={apiExport} key={apiExport.id} />
          ))}
      </Stack>
    </Stack>
  </Section>
)

const ApiModuleHeader = ({ page }: { readonly page: DocsApiModuleIndex }) => (
  <Section className="scroll-mt-28 border-b border-stage-200/90 pb-8" id="module">
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
          className="text-ink-500"
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
)

const SelectedApiExport = ({
  apiExport,
  page
}: {
  readonly apiExport: ApiExport
  readonly page: DocsApiModuleIndex
}) => (
  <Stack className="gap-6">
    <Stack className="gap-2">
      <SemanticText as="code" className="text-ink-500" role="code-meta" text={page.package.name} />
      <AnchorLink
        className="w-fit font-body text-sm font-medium text-ink-600 outline-none hover:text-ink-950 focus-visible:ring-2 focus-visible:ring-ink-900/20"
        href="#module"
      >
        ← {page.module.name}
      </AnchorLink>
    </Stack>
    <ApiExportView apiExport={apiExport} />
  </Stack>
)

export const ApiPageView = ({
  page,
  selectedExport = Option.none()
}: {
  readonly page: DocsApiModuleIndex
  readonly selectedExport?: Option.Option<ApiExport>
}) => (
  Option.match(selectedExport, {
    onNone: () => (
      <Stack className="gap-12 sm:gap-14">
        <ApiModuleHeader page={page} />
        {Arr.map(
          page.categories,
          (category) => <ApiCategoryIndex category={category} key={category.name} page={page} />
        )}
      </Stack>
    ),
    onSome: (apiExport) => <SelectedApiExport apiExport={apiExport} page={page} />
  })
)
