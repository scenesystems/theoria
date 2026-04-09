import type { PackageDocsNavigationItem } from "../../../contracts/presentation/package-docs.js"
import { InternalLink } from "../primitives/Link.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

const navigationItem = ({
  href,
  label,
  packageId,
  selected
}: PackageDocsNavigationItem) => (
  <InternalLink
    className={selected
      ? "rounded-full border border-stage-300 bg-stage-0/98 px-3 py-2 text-ink-900"
      : "rounded-full border border-stage-200/90 bg-stage-0/88 px-3 py-2 text-ink-700"}
    href={href}
    key={packageId}
  >
    <SemanticText as="span" role="tab-label" text={label} variant="compact" />
  </InternalLink>
)

export const PackageDocsCatalogNavigation = ({
  items,
  title
}: {
  readonly items: ReadonlyArray<PackageDocsNavigationItem>
  readonly title: string
}) => (
  <Section>
    <Stack className="gap-3">
      <SemanticText as="h2" className="text-ink-900" role="section-title" text={title} variant="expanded" />
      <Cluster className="gap-2">
        {items.map(navigationItem)}
      </Cluster>
    </Stack>
  </Section>
)
