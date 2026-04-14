import type { ReactNode } from "react"

import type { RunControlsViewModel } from "../../../contracts/presentation/run-controls.js"
import type { SurfaceChromeModel } from "../../../contracts/presentation/surface-chrome.js"
import type { RunControlActionKind } from "../../state/run/types.js"

import { ActionLink } from "./ActionControl.js"
import { GitHubStarButton } from "./GitHubStarButton.js"
import { Cluster, Header, Layer } from "./Layout.js"
import { InternalLink } from "./Link.js"
import { RunControlDock } from "./RunControlDock.js"
import { SemanticText } from "./SemanticText.js"
import { app, type Surface } from "./theme/surface.js"
import { ThemeToggle } from "./ThemeToggle.js"
import { TheoriaLogo } from "./TheoriaLogo.js"

export const CompactNav = ({
  chrome,
  controls,
  onRunControlAction,
  projectionMenu,
  theme
}: {
  readonly chrome: SurfaceChromeModel
  readonly controls: RunControlsViewModel
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly projectionMenu: ReactNode
  readonly theme: Surface
}) => (
  <Header className={`${app.compactNav} relative z-20`}>
    <Layer className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:gap-4">
      <Cluster className="items-center gap-3 sm:gap-4 justify-self-start">
        {chrome.backLink.href === null
          ? null
          : (
            <Layer className="shrink-0">
              <ActionLink
                className={theme.backAction}
                href={chrome.backLink.href}
                label={`← ${chrome.backLink.label}`}
                variant="compact"
              />
            </Layer>
          )}
        <Cluster className="flex-nowrap items-center gap-2 sm:gap-3">
          <InternalLink href="/">
            <TheoriaLogo className="shrink-0 text-base sm:text-lg" />
          </InternalLink>
          <Layer aria-hidden className={`hidden h-6 w-px shrink-0 sm:block ${theme.badgeDot}`} />
          <SemanticText
            as="h1"
            className="min-w-0 truncate text-ink-900"
            role="hero-body"
            text={chrome.title}
            variant="compact"
          />
        </Cluster>
      </Cluster>

      <Layer className="justify-self-center">
        <RunControlDock
          controls={controls}
          onRunControlAction={onRunControlAction}
          theme={theme}
          variant="compact"
        />
      </Layer>

      <Cluster className="items-center gap-2 sm:gap-3 justify-self-end">
        {projectionMenu}
        <GitHubStarButton />
        {chrome.themeControl.visible ? <ThemeToggle /> : null}
      </Cluster>
    </Layer>
  </Header>
)
