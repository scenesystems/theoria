import type { ReactNode } from "react"

import { Box, mergeClassNames } from "../structure/Box.js"
import { Cluster } from "../structure/Cluster.js"
import { SemanticText } from "../structure/SemanticText.js"
import { Stack } from "../structure/Stack.js"

type SiteFooterProps = {
  readonly brand?: ReactNode
  readonly className?: string
  readonly legal?: ReactNode
  readonly links?: ReactNode
  readonly summary?: ReactNode
}

const renderSummary = (summary: ReactNode): ReactNode =>
  typeof summary === "string" ? <SemanticText role="body-sm">{summary}</SemanticText> : summary

const renderLegal = (legal: ReactNode): ReactNode =>
  typeof legal === "string" ? <SemanticText role="status" tone="subtle">{legal}</SemanticText> : legal

export const SiteFooter = ({ brand, className, legal, links, summary }: SiteFooterProps) => (
  <Box
    as="footer"
    className={mergeClassNames("border-t border-stage-200/90 bg-stage-0/62 backdrop-blur-sm", className)}
  >
    <Box className="w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
      <Stack gap="md">
        <Cluster className="items-start gap-x-6 gap-y-3" justify="between">
          <Stack className="flex-1" gap="sm">
            {brand}
            {summary === undefined ? null : renderSummary(summary)}
          </Stack>
          {links === undefined ? null : <Box className="min-w-0">{links}</Box>}
        </Cluster>
        {legal === undefined ? null : <Box>{renderLegal(legal)}</Box>}
      </Stack>
    </Box>
  </Box>
)
