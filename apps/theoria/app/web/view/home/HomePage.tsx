import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"

import {
  HomeCatalogAvailabilityChecking,
  HomeCatalogAvailabilityResolved,
  HomeCatalogAvailabilityUnavailable,
  HomeCatalogPresentation
} from "../../../contracts/presentation/home-catalog.js"
import { homeFooterCopyright, homeFooterSlogan } from "../../../contracts/presentation/home.js"
import type { PageMetadata } from "../../../contracts/presentation/metadata.js"
import { capabilityAvailabilityAtom } from "../../atoms/capability-availability.js"
import { packageVersionsAtom } from "../../atoms/package-versions.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"
import { AppShell } from "../../ui/chrome/AppShell.js"
import { GitHubStarButton } from "../../ui/chrome/GitHubStarButton.js"
import { SiteFooter } from "../../ui/chrome/SiteFooter.js"
import { SiteHeader } from "../../ui/chrome/SiteHeader.js"
import { ThemeToggle } from "../../ui/chrome/ThemeToggle.js"
import { TheoriaBrand } from "../../ui/chrome/TheoriaBrand.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { Link } from "../../ui/structure/Link.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"
import { DocumentHead } from "../primitives/DocumentHead.js"

import { HomeHero } from "./HomeHero.js"
import { InstrumentSection } from "./InstrumentSection.js"

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

export const HomePage = ({ metadata }: { readonly metadata: PageMetadata }) => {
  const availabilityResult = useAtomValue(capabilityAvailabilityAtom)
  const versionsResult = useAtomValue(packageVersionsAtom)
  const releaseStage = runtimeReleaseStage()
  const catalog = HomeCatalogPresentation.project({
    availability: Result.match(availabilityResult, {
      onInitial: () => HomeCatalogAvailabilityChecking.checking(),
      onFailure: () => HomeCatalogAvailabilityUnavailable.unavailable(),
      onSuccess: (success) => HomeCatalogAvailabilityResolved.fromSnapshot(success.value)
    }),
    packageVersions: Result.match(versionsResult, {
      onInitial: () => null,
      onFailure: () => null,
      onSuccess: (success) => success.value
    }),
    releaseStage
  })

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
          />
        }
        width="reading"
      >
        <Stack as="section" className="gap-14 py-8 sm:gap-16 sm:py-12" id="capability-catalog">
          <HomeHero />
          {catalog.sections.map((section) => <InstrumentSection key={section.group} section={section} />)}
        </Stack>
      </AppShell>
    </>
  )
}
