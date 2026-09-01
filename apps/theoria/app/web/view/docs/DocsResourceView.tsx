import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { DocsApiExportSummary, DocsApiModuleIndex, GuidePage } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsApiExportAtom, docsApiModuleIndexAtom, docsGuidePageAtom } from "../../atoms/docs-data.js"
import { docsLocationHashAtom, docsLocationHashMountAtom } from "../../atoms/docs.js"
import { apiCategoryAnchor, ApiPageView } from "./ApiPageView.js"
import { apiExportForHash } from "./docsModel.js"
import type { DocsPageAnchor } from "./DocsOnThisPage.js"
import { DocsStatus } from "./DocsStatus.js"
import { DocsResourceFrame } from "./DocsWorkbench.js"
import { GuidePageView } from "./GuidePageView.js"

const guideAnchors = (page: GuidePage): ReadonlyArray<DocsPageAnchor> =>
  Arr.map(page.anchors, (anchor): DocsPageAnchor => [anchor.id, anchor.label])

const apiAnchors = (page: DocsApiModuleIndex, hash: string): ReadonlyArray<DocsPageAnchor> =>
  Option.match(apiExportForHash(page, hash), {
    onNone: () =>
      Arr.map(page.categories, (category): DocsPageAnchor => [apiCategoryAnchor(category.name), category.name]),
    onSome: (apiExport) => [[apiExport.anchor, apiExport.name]]
  })

const FocusedApiExportResource = ({
  page,
  route,
  summary
}: {
  readonly page: DocsApiModuleIndex
  readonly route: DocsRoute
  readonly summary: DocsApiExportSummary
}) => {
  const atom = docsApiExportAtom(summary.asset)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)
  const anchors: ReadonlyArray<DocsPageAnchor> = [[summary.anchor, summary.name]]

  return Result.match(result, {
    onInitial: () => (
      <DocsResourceFrame anchors={anchors} route={route}>
        <DocsStatus kind="api" state="loading" />
      </DocsResourceFrame>
    ),
    onFailure: () => (
      <DocsResourceFrame anchors={anchors} route={route}>
        <DocsStatus retry={refresh} state="failure" />
      </DocsResourceFrame>
    ),
    onSuccess: ({ value }) => (
      <DocsResourceFrame anchors={anchors} route={route}>
        <ApiPageView page={page} selectedExport={Option.some(value.export)} />
      </DocsResourceFrame>
    )
  })
}

const ApiModuleIndexResource = ({
  hash,
  page,
  route
}: {
  readonly hash: string
  readonly page: DocsApiModuleIndex
  readonly route: DocsRoute
}) =>
  Option.match(apiExportForHash(page, hash), {
    onNone: () => (
      <DocsResourceFrame anchors={apiAnchors(page, hash)} route={route}>
        <ApiPageView page={page} />
      </DocsResourceFrame>
    ),
    onSome: (summary) => <FocusedApiExportResource page={page} route={route} summary={summary} />
  })

export const GuideResource = ({
  asset,
  route
}: {
  readonly asset: string
  readonly route: DocsRoute
}) => {
  const atom = docsGuidePageAtom(asset)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.match(result, {
    onInitial: () => (
      <DocsResourceFrame anchors={[]} route={route}>
        <DocsStatus kind="guide" state="loading" />
      </DocsResourceFrame>
    ),
    onFailure: () => (
      <DocsResourceFrame anchors={[]} route={route}>
        <DocsStatus retry={refresh} state="failure" />
      </DocsResourceFrame>
    ),
    onSuccess: ({ value }) => (
      <DocsResourceFrame anchors={guideAnchors(value)} route={route}>
        <GuidePageView page={value} />
      </DocsResourceFrame>
    )
  })
}

export const ApiResource = ({
  asset,
  route
}: {
  readonly asset: string
  readonly route: DocsRoute
}) => {
  useAtomValue(docsLocationHashMountAtom)
  const hash = useAtomValue(docsLocationHashAtom)
  const atom = docsApiModuleIndexAtom(asset)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.match(result, {
    onInitial: () => (
      <DocsResourceFrame anchors={[]} route={route}>
        <DocsStatus kind="api" state="loading" />
      </DocsResourceFrame>
    ),
    onFailure: () => (
      <DocsResourceFrame anchors={[]} route={route}>
        <DocsStatus retry={refresh} state="failure" />
      </DocsResourceFrame>
    ),
    onSuccess: ({ value }) => <ApiModuleIndexResource hash={hash} page={value} route={route} />
  })
}
