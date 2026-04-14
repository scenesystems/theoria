import { useAtom, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import { useMemo } from "react"

import type { PackageDocsGroup, PackageDocsSection } from "../../../contracts/presentation/package-docs.js"
import {
  initialPackageDocsVisibleSectionCount,
  packageDocsVisibleSectionCountAtom,
  packageDocsVisibleSectionCountStep
} from "../../atoms/package-docs-group.js"
import { packageDocsCurrentRouteKeyAtom } from "../../atoms/package-docs.js"
import { Button } from "../../ui/components/action/Button.js"
import { warmHighlightedCode } from "../../ui/components/surface/code-highlighter.js"
import { HighlightedCode } from "../../ui/components/surface/HighlightedCode.js"
import { Box } from "../../ui/structure/Box.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

import { PackageDocsInlineContent, PackageDocsMarkdownBody } from "./PackageDocsMarkdown.js"

const isDocumentGroup = (title: string): boolean => title === "README" || title === "Release History"

const currentPackageDocsFragment = (): string => {
  const hash = globalThis.window?.location?.hash ?? ""

  return hash.startsWith("#") ? hash.slice(1) : hash
}

const nextVisibleSectionCount = (currentCount: number, totalCount: number): number =>
  Math.min(totalCount, currentCount + packageDocsVisibleSectionCountStep)

const minimumVisibleSectionCount = (sections: ReadonlyArray<PackageDocsSection>): number => {
  const fragmentId = currentPackageDocsFragment()
  const fragmentIndex = sections.findIndex((section) => section.fragmentId === fragmentId)

  return fragmentIndex === -1
    ? initialPackageDocsVisibleSectionCount
    : Math.max(initialPackageDocsVisibleSectionCount, fragmentIndex + 1)
}

const sectionArticle = (input: {
  readonly bordered: boolean
  readonly groupTitle: string
  readonly index: number
  readonly section: PackageDocsSection
}) =>
  Match.value(input.section).pipe(
    Match.tag("prose", ({ content, fragmentId, title, titleDocument }) => (
      <Box
        as="article"
        {...(input.bordered ? { className: "scroll-mt-6 border-b border-stage-200/40 pb-6" } : {})}
        id={fragmentId}
        key={`${input.groupTitle}:${String(input.index)}`}
      >
        <Stack className="gap-3">
          {title.length > 0
            ? (
              <SemanticText as="h3" className="text-ink-900" role="display">
                <PackageDocsInlineContent document={titleDocument} />
              </SemanticText>
            )
            : null}
          <PackageDocsMarkdownBody document={content} />
        </Stack>
      </Box>
    )),
    Match.tag("code", ({ content, fragmentId, language, titleDocument }) => (
      <Box
        as="article"
        {...(input.bordered ? { className: "scroll-mt-6 border-b border-stage-200/40 pb-6" } : {})}
        id={fragmentId}
        key={`${input.groupTitle}:${String(input.index)}`}
      >
        <Stack className="gap-3">
          <SemanticText as="h3" className="text-ink-900" role="display">
            <PackageDocsInlineContent document={titleDocument} />
          </SemanticText>
          <HighlightedCode code={content} language={language} />
        </Stack>
      </Box>
    )),
    Match.exhaustive
  )

export const nonEmptyPackageDocsSections = (
  sections: ReadonlyArray<PackageDocsSection>
): ReadonlyArray<PackageDocsSection> =>
  sections.filter((section) =>
    Match.value(section).pipe(
      Match.tag("code", ({ content }) => content.trim().length > 0),
      Match.tag("prose", ({ content }) => content.children.length > 0),
      Match.exhaustive
    )
  )

export const warmPackageDocsSection = (section: PackageDocsSection): void => {
  Match.value(section).pipe(
    Match.tag("prose", () => undefined),
    Match.tag("code", ({ content, language }) => {
      warmHighlightedCode({ language, source: content })
    }),
    Match.exhaustive
  )
}

export const PackageDocsGroupPanel = ({
  active,
  group
}: {
  readonly active: boolean
  readonly group: PackageDocsGroup
}) => {
  const routeKey = useAtomValue(packageDocsCurrentRouteKeyAtom)
  const [visibleCount, setVisibleCount] = useAtom(packageDocsVisibleSectionCountAtom(`${routeKey}:${group.title}`))
  const sections = nonEmptyPackageDocsSections(group.sections)
  const renderedCount = Math.min(sections.length, Math.max(visibleCount, minimumVisibleSectionCount(sections)))
  const visibleSections = sections.slice(0, renderedCount)
  const hasMoreSections = renderedCount < sections.length
  const loadMoreSections = () => {
    setVisibleCount(nextVisibleSectionCount(renderedCount, sections.length))
  }
  const loadMoreRef = useMemo(
    () => (element: HTMLDivElement | null) => {
      if (
        active === false
        || element === null
        || hasMoreSections === false
        || typeof window === "undefined"
        || typeof window.IntersectionObserver !== "function"
      ) {
        return
      }

      const observer = new window.IntersectionObserver((entries) => {
        const entry = entries[0]

        if (entry?.isIntersecting === true) {
          loadMoreSections()
        }
      }, { rootMargin: "320px 0px" })

      observer.observe(element)

      return () => {
        observer.disconnect()
      }
    },
    [active, hasMoreSections, renderedCount, sections.length, setVisibleCount]
  )

  return isDocumentGroup(group.title)
    ? (
      <Stack className="max-w-[52rem] gap-6">
        {visibleSections.map((section, index) =>
          sectionArticle({ bordered: false, groupTitle: group.title, index, section })
        )}
        {hasMoreSections
          ? (
            <Stack className="gap-3 rounded-lg border border-stage-200/70 bg-stage-0/70 px-4 py-3">
              <Box className="h-px w-full opacity-0" ref={loadMoreRef} />
              <SemanticText as="p" className="text-ink-500" role="body-sm">
                {`${String(renderedCount)} of ${String(sections.length)} sections loaded`}
              </SemanticText>
              <Button onClick={loadMoreSections} size="sm" tone="neutral">
                {`Load ${
                  String(Math.min(packageDocsVisibleSectionCountStep, sections.length - renderedCount))
                } more sections`}
              </Button>
            </Stack>
          )
          : null}
      </Stack>
    )
    : (
      <Stack className="max-w-[52rem] gap-8">
        {visibleSections.map((section, index) =>
          sectionArticle({ bordered: true, groupTitle: group.title, index, section })
        )}
        {hasMoreSections
          ? (
            <Stack className="gap-3 rounded-lg border border-stage-200/70 bg-stage-0/70 px-4 py-3">
              <Box className="h-px w-full opacity-0" ref={loadMoreRef} />
              <SemanticText as="p" className="text-ink-500" role="body-sm">
                {`${String(renderedCount)} of ${String(sections.length)} sections loaded`}
              </SemanticText>
              <Button onClick={loadMoreSections} size="sm" tone="neutral">
                {`Load ${
                  String(Math.min(packageDocsVisibleSectionCountStep, sections.length - renderedCount))
                } more sections`}
              </Button>
            </Stack>
          )
          : null}
      </Stack>
    )
}
