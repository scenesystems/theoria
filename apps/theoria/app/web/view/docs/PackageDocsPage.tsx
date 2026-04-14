import { useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"

import { homeFooterCopyright, homeFooterSlogan } from "../../../contracts/presentation/home.js"
import type { PageMetadata } from "../../../contracts/presentation/metadata.js"
import type { PackageDocsPageRoute } from "../../../contracts/presentation/package-docs.js"
import {
  packageDocsLibraryMenuOpenAtom,
  packageDocsPageScrollBodyId,
  packageDocsPageScrolledAtom
} from "../../atoms/package-docs-page.js"
import { packageDocsCurrentRouteKeyAtom, packageDocsSearchPanelOpenAtom } from "../../atoms/package-docs.js"
import { AppShell } from "../../ui/chrome/AppShell.js"
import { GitHubStarButton } from "../../ui/chrome/GitHubStarButton.js"
import { SiteFooter } from "../../ui/chrome/SiteFooter.js"
import { SiteHeader } from "../../ui/chrome/SiteHeader.js"
import { ThemeToggle } from "../../ui/chrome/ThemeToggle.js"
import { TheoriaBrand } from "../../ui/chrome/TheoriaBrand.js"
import { Box } from "../../ui/structure/Box.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { Link } from "../../ui/structure/Link.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { DocumentHead } from "../primitives/DocumentHead.js"

import { PackageDocsHeaderControls } from "./PackageDocsHeaderControls.js"
import { PackageDocsPageSections } from "./PackageDocsPageSections.js"
import { PackageDocsScrollChrome } from "./PackageDocsScrollChrome.js"

const FooterLink = ({ href, label }: { readonly href: string; readonly label: string }) => (
  <Link
    className="inline-flex min-w-0 items-center gap-1.5 transition-colors duration-150 hover:text-content-primary"
    href={href}
    rel="noopener noreferrer"
    target="_blank"
    tone="muted"
  >
    <SemanticText as="span" role="status" tone="inherit">{label}</SemanticText>
    <ArrowTopRightOnSquareIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-content-subtle" />
  </Link>
)

export const PackageDocsPage = ({
  metadata
}: {
  readonly metadata: PageMetadata
  readonly route: PackageDocsPageRoute
}) => {
  const routeKey = useAtomValue(packageDocsCurrentRouteKeyAtom)
  const openSearch = useAtomSet(packageDocsSearchPanelOpenAtom(routeKey))
  const openLibraryMenu = useAtomSet(packageDocsLibraryMenuOpenAtom(routeKey))
  const [scrolled, setScrolled] = useAtom(packageDocsPageScrolledAtom(routeKey))

  return (
    <>
      <DocumentHead metadata={metadata} />

      <AppShell
        footer={
          <SiteFooter
            brand={<TheoriaBrand animation="glossary" />}
            legal={homeFooterCopyright}
            links={
              <Cluster gap="md">
                <FooterLink href="https://github.com/scenesystems/theoria" label="GitHub" />
                <FooterLink href="https://scenesystems.io" label="scenesystems.io" />
                <FooterLink href="https://x.com/scenesystems" label="@scenesystems" />
              </Cluster>
            }
            summary={homeFooterSlogan}
          />
        }
        header={
          <SiteHeader
            actions={
              <Cluster gap="sm">
                <GitHubStarButton />
                <ThemeToggle />
              </Cluster>
            }
            brand={
              <Link href="/" tone="inherit">
                <TheoriaBrand animation="glossary" className="text-2xl" />
              </Link>
            }
            center={<PackageDocsHeaderControls />}
            density={scrolled ? "compact" : "default"}
          />
        }
        bodyId={packageDocsPageScrollBodyId}
        onKeyDownCapture={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.altKey === false && event.key.toLowerCase() === "k") {
            event.preventDefault()
            openLibraryMenu(false)
            openSearch(true)
          }
        }}
        onScrollBody={(event) => {
          setScrolled(event.currentTarget.scrollTop > 24)
        }}
        scrollMode="body"
        mainClassName="flex min-h-full flex-1 flex-col py-0 sm:py-0"
        width="reading"
      >
        <PackageDocsScrollChrome />
        <Box className="flex min-h-0 flex-1 flex-col">
          <PackageDocsPageSections />
        </Box>
      </AppShell>
    </>
  )
}
