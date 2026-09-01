import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { ApiPage, GuidePage } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsApiPageAtom, docsGuidePageAtom } from "../../atoms/docs-data.js"
import { docsLocationHashAtom, docsLocationHashMountAtom } from "../../atoms/docs.js"
import { apiCategoryAnchor, ApiPageView } from "./ApiPageView.js"
import { apiExportForHash } from "./docsModel.js"
import type { DocsPageAnchor } from "./DocsOnThisPage.js"
import { DocsStatus } from "./DocsStatus.js"
import { DocsResourceFrame } from "./DocsWorkbench.js"
import { GuidePageView } from "./GuidePageView.js"

const guideAnchors = (page: GuidePage): ReadonlyArray<DocsPageAnchor> =>
  Arr.map(page.anchors, (anchor): DocsPageAnchor => [anchor.id, anchor.label])

const apiAnchors = (page: ApiPage, hash: string): ReadonlyArray<DocsPageAnchor> =>
  Option.match(apiExportForHash(page, hash), {
    onNone: () =>
      Arr.map(page.categories, (category): DocsPageAnchor => [apiCategoryAnchor(category.name), category.name]),
    onSome: (apiExport) => [[apiExport.anchor, apiExport.name]]
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
        <DocsStatus state="loading" />
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
  const atom = docsApiPageAtom(asset)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.match(result, {
    onInitial: () => (
      <DocsResourceFrame anchors={[]} route={route}>
        <DocsStatus state="loading" />
      </DocsResourceFrame>
    ),
    onFailure: () => (
      <DocsResourceFrame anchors={[]} route={route}>
        <DocsStatus retry={refresh} state="failure" />
      </DocsResourceFrame>
    ),
    onSuccess: ({ value }) => {
      const selectedExport = apiExportForHash(value, hash)

      return (
        <DocsResourceFrame anchors={apiAnchors(value, hash)} route={route}>
          <ApiPageView page={value} selectedExport={selectedExport} />
        </DocsResourceFrame>
      )
    }
  })
}
