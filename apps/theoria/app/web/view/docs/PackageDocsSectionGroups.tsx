import { useAtom } from "@effect-atom/atom-react"
import * as Arr from "effect/Array"
import { useRef } from "react"

import type { PackageDocsGroup } from "../../../contracts/presentation/package-docs.js"
import { packageDocsActiveGroupAtom } from "../../atoms/package-docs-group.js"
import { UnderlineTabs } from "../../ui/components/navigation/UnderlineTabs.js"
import { Box } from "../../ui/structure/Box.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

import {
  nonEmptyPackageDocsSections,
  PackageDocsGroupPanel,
  warmPackageDocsSection
} from "./PackageDocsSectionPanels.js"

const currentPackageDocsFragment = (): string => {
  const hash = globalThis.window?.location?.hash ?? ""

  return hash.startsWith("#") ? hash.slice(1) : hash
}

const groupWithFragment = (
  groups: ReadonlyArray<PackageDocsGroup>,
  fragmentId: string
): PackageDocsGroup | null =>
  groups.find((group) => group.sections.some((section) => section.fragmentId === fragmentId)) ?? null

const tabLabel = (group: PackageDocsGroup): string =>
  (group.title === "README" || group.title === "Release History")
    ? group.title
    : `${group.title} (${String(group.sections.length)})`

const groupTab = (
  group: PackageDocsGroup
) => (
  <UnderlineTabs.Tab
    className="py-2"
    key={group.title}
    value={group.title}
  >
    <SemanticText as="span" role="tab">{tabLabel(group)}</SemanticText>
  </UnderlineTabs.Tab>
)

const activeGroup = (
  groups: ReadonlyArray<PackageDocsGroup>,
  activeTitle: string
): PackageDocsGroup | null => {
  const fragmentId = currentPackageDocsFragment()
  const fragmentGroup = fragmentId.length === 0 ? null : groupWithFragment(groups, fragmentId)

  if (activeTitle.length === 0 && fragmentGroup !== null) {
    return fragmentGroup
  }

  const found = Arr.findFirst(groups, (g) => g.title === activeTitle)

  return found._tag === "Some" ? found.value : groups[0] ?? null
}

const requestIdleWork = (work: () => void): () => void => {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => {
      work()
    })

    return () => {
      window.cancelIdleCallback(id)
    }
  }

  const id = globalThis.setTimeout(work, 80)

  return () => {
    globalThis.clearTimeout(id)
  }
}

const nextGroupsToWarm = (input: {
  readonly currentTitle: string
  readonly groups: ReadonlyArray<PackageDocsGroup>
  readonly visitedTitles: ReadonlyArray<string>
}): ReadonlyArray<PackageDocsGroup> => {
  const currentIndex = input.groups.findIndex((group) => group.title === input.currentTitle)
  const orderedGroups = currentIndex === -1
    ? input.groups
    : [
      ...input.groups.slice(currentIndex + 1),
      ...input.groups.slice(0, currentIndex)
    ]

  return orderedGroups
    .filter((group) => !input.visitedTitles.includes(group.title))
    .slice(0, 2)
}

export const PackageDocsSectionGroups = ({ groups }: { readonly groups: ReadonlyArray<PackageDocsGroup> }) => {
  const [activeGroupTitle, setActiveGroupTitle] = useAtom(packageDocsActiveGroupAtom)
  const current = activeGroup(groups, activeGroupTitle)
  const currentTitle = current?.title ?? groups[0]?.title ?? ""
  const visitedGroupsRef = useRef<ReadonlyArray<string>>(currentTitle.length === 0 ? [] : [currentTitle])

  if (currentTitle.length > 0 && !visitedGroupsRef.current.includes(currentTitle)) {
    visitedGroupsRef.current = [...visitedGroupsRef.current, currentTitle]
  }

  const visitedGroups = groups.filter((group) => visitedGroupsRef.current.includes(group.title))

  return (
    <UnderlineTabs.Root
      onValueChange={(value) => {
        setActiveGroupTitle(value)
      }}
      value={currentTitle}
    >
      <Stack className="gap-3">
        <UnderlineTabs.List
          aria-label="Package documentation groups"
          className="sticky top-0 z-20 max-w-[52rem] gap-6 bg-stage-50/96 backdrop-blur-md sm:gap-8"
        >
          {groups.map(groupTab)}
        </UnderlineTabs.List>

        {visitedGroups.map((group) => (
          <UnderlineTabs.Panel
            className="border-none bg-transparent p-0 shadow-none"
            keepMounted
            key={group.title}
            value={group.title}
          >
            <Box
              as="section"
              ref={group.title === currentTitle
                ? () =>
                  requestIdleWork(() => {
                    Arr.forEach(
                      nextGroupsToWarm({
                        currentTitle,
                        groups,
                        visitedTitles: visitedGroupsRef.current
                      }),
                      (candidate) => {
                        Arr.forEach(nonEmptyPackageDocsSections(candidate.sections), warmPackageDocsSection)
                      }
                    )
                  })
                : undefined}
            >
              <PackageDocsGroupPanel active={group.title === currentTitle} group={group} />
            </Box>
          </UnderlineTabs.Panel>
        ))}
      </Stack>
    </UnderlineTabs.Root>
  )
}
