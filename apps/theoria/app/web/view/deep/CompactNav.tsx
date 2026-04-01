import * as Option from "effect/Option"

import type { SurfaceChromeModel } from "../surfaceChromeModel.js"

import { ActionLink } from "../primitives/ActionControl.js"
import { appTheme, neutralBadgeTheme, type SurfaceTheme } from "../primitives/designSystem.js"
import { Cluster, Header, Layer } from "../primitives/Layout.js"
import { PackageBadge } from "../primitives/PackageBadge.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ThemeToggle } from "../primitives/ThemeToggle.js"
import { TheoriaLogo } from "../primitives/TheoriaLogo.js"

export const CompactNav = ({
  chrome,
  theme
}: {
  readonly chrome: SurfaceChromeModel
  readonly theme: SurfaceTheme
}) => (
  <Header className={`${appTheme.compactNav} relative`}>
    <Cluster className="min-w-0 gap-3">
      {Option.match(chrome.backLink.href, {
        onNone: () => null,
        onSome: (href) => (
          <ActionLink className={theme.backAction} href={href} label={`← ${chrome.backLink.label}`} variant="compact" />
        )
      })}
      <TheoriaLogo className="text-base" />
    </Cluster>

    <Layer className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <SemanticText
        as="h1"
        className="pointer-events-auto truncate text-ink-900"
        role="hero-body"
        text={chrome.title}
        variant="compact"
      />
    </Layer>

    <Cluster className="shrink-0 gap-2">
      {chrome.runtimeBadge.visible
        ? (
          <PackageBadge
            badge={neutralBadgeTheme}
            label={chrome.runtimeBadge.label}
            variant="compact"
          />
        )
        : null}
      {chrome.themeControl.visible ? <ThemeToggle /> : null}
    </Cluster>
  </Header>
)
