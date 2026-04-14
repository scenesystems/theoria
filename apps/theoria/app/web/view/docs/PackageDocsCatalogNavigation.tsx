import { useAtomSet } from "@effect-atom/atom-react"
import type { MouseEvent } from "react"

import type { PackageDocsNavigationItem } from "../../../contracts/presentation/package-docs.js"
import { navigateToPackageAtom } from "../../atoms/package-docs-navigation.js"
import { Box } from "../../ui/structure/Box.js"
import { Link } from "../../ui/structure/Link.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

export const PackageDocsCatalogNavigation = ({
  items,
  onNavigate,
  showTitle = true,
  title
}: {
  readonly items: ReadonlyArray<PackageDocsNavigationItem>
  readonly onNavigate?: () => void
  readonly showTitle?: boolean
  readonly title: string
}) => {
  const navigate = useAtomSet(navigateToPackageAtom)

  return (
    <Box as="nav" aria-label={title}>
      <Stack className="gap-0.5">
        {showTitle
          ? (
            <SemanticText
              as="h2"
              className="px-2.5 pb-2 text-ink-500"
              role="label"
            >
              {title}
            </SemanticText>
          )
          : null}
        {items.map((item) => (
          <Link
            aria-current={item.selected ? "page" : undefined}
            className={item.selected
              ? "block border-l-2 border-stage-400 px-3 py-1.5 text-ink-950"
              : "block border-l-2 border-transparent px-3 py-1.5 text-ink-700 hover:border-stage-200 hover:text-ink-950"}
            href={item.href}
            key={item.packageId}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              event.preventDefault()
              navigate(item.packageId)
              onNavigate?.()
            }}
            tone="inherit"
          >
            <SemanticText as="span" className="text-inherit" role="body-sm">{item.label}</SemanticText>
          </Link>
        ))}
      </Stack>
    </Box>
  )
}
