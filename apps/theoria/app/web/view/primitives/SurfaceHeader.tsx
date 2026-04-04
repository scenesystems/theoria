import { Toolbar } from "@base-ui-components/react/toolbar"
import { Match } from "effect"
import * as Option from "effect/Option"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import type { RunControlActionKind } from "../../state/types.js"

import type { RunControlsViewModel } from "../runControlsModel.js"
import type { SurfaceChromeModel } from "../surfaceChromeModel.js"

import { ActionButton, ActionLink } from "./ActionControl.js"
import { badgeThemeFromSurface, type SurfaceTheme } from "./designSystem.js"
import { Cluster, Header, Layer, Stack } from "./Layout.js"
import { PackageBadge } from "./PackageBadge.js"
import { SelectionRail } from "./SelectionLayout.js"
import { SemanticText } from "./SemanticText.js"
import { ThemeToggle } from "./ThemeToggle.js"

const headerClassName = (variant: SurfaceVariant): string =>
  Match.value(variant).pipe(
    Match.when("expanded", () => "flex flex-col gap-3"),
    Match.orElse(() => "flex flex-col gap-3")
  )

const metadataGridClassName = "grid gap-1.5 sm:grid-cols-[auto_1fr] sm:gap-x-3"
const summaryClassName = (_variant: SurfaceVariant): string => "text-ink-700"
const actionToolbarClassName = "w-full lg:w-auto"

const actionRowClassName = (backHref: Option.Option<string>): string =>
  Option.isNone(backHref)
    ? "shrink-0 justify-end gap-2"
    : "shrink-0 justify-between gap-2"

export const SurfaceHeader = ({
  chrome,
  controls,
  onRunControlAction,
  theme,
  variant
}: {
  readonly chrome: SurfaceChromeModel
  readonly controls: RunControlsViewModel
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly theme: SurfaceTheme
  readonly variant: SurfaceVariant
}) => {
  const controlRow = (
    <Cluster className={actionRowClassName(chrome.backLink.href)}>
      {Option.match(chrome.backLink.href, {
        onNone: () => null,
        onSome: (href) => (
          <ActionLink className={theme.backAction} href={href} label={chrome.backLink.label} variant={variant} />
        )
      })}
      <Cluster className="gap-2">
        {chrome.themeControl.visible ? <ThemeToggle /> : null}
        <Toolbar.Root className={actionToolbarClassName} loopFocus>
          <Toolbar.Group className="flex flex-wrap items-center gap-2 lg:justify-end">
            <ActionButton
              className={theme.primaryAction}
              disabled={controls.primary.disabled}
              label={controls.primary.label}
              onClick={() => {
                onRunControlAction(controls.primary.action)
              }}
              variant={variant}
            />
            {Option.match(controls.secondary, {
              onNone: () => null,
              onSome: (secondary) => (
                <ActionButton
                  className={theme.secondaryAction}
                  disabled={secondary.disabled}
                  label={secondary.label}
                  onClick={() => {
                    onRunControlAction(secondary.action)
                  }}
                  variant={variant}
                />
              )
            })}
            {Option.match(chrome.deepDiveLink.href, {
              onNone: () => null,
              onSome: (href) => (
                <ActionLink
                  className={theme.secondaryAction}
                  href={href}
                  label={chrome.deepDiveLink.label}
                  variant={variant}
                />
              )
            })}
          </Toolbar.Group>
        </Toolbar.Root>
      </Cluster>
    </Cluster>
  )

  const metadata = variant === "expanded"
    ? (
      <Layer className={metadataGridClassName}>
        <SemanticText
          as="p"
          className="text-ink-700"
          role="row-label"
          text={chrome.packageMeta.label}
          variant={variant}
        />
        <SemanticText
          as="p"
          className="text-ink-900"
          role="row-value"
          text={chrome.packageMeta.value}
          variant={variant}
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="row-label"
          text={chrome.useCaseMeta.label}
          variant={variant}
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="row-value"
          text={chrome.useCaseMeta.value}
          variant={variant}
        />
      </Layer>
    )
    : chrome.compactPackageValue === null
    ? null
    : (
      <SemanticText
        as="p"
        className="text-ink-700"
        role="row-label"
        text={chrome.compactPackageValue}
        variant={variant}
      />
    )

  return (
    <Header className={headerClassName(variant)}>
      <SelectionRail
        action={controlRow}
        actionBreakpoint="lg"
        actionClassName="col-span-full lg:col-span-1"
        className="gap-y-3"
      >
        <Stack className="min-w-0 flex-1 gap-2">
          {variant === "expanded"
            ? (
              <PackageBadge
                badge={badgeThemeFromSurface(theme)}
                label={chrome.badgeLabel}
                variant={variant}
              />
            )
            : null}
          <Cluster className="items-start gap-2.5">
            {variant === "compact"
              ? (
                <Layer
                  as="span"
                  aria-hidden
                  className={`inline-flex h-2 w-2 shrink-0 rounded-full ${theme.badgeDot}`}
                />
              )
              : null}
            <SemanticText
              as="h2"
              className="min-w-0 flex-1 text-ink-900"
              role="card-title"
              text={chrome.title}
              variant={variant}
              wrapAuthority="effect-text-projected"
            />
          </Cluster>
          {metadata}
          <SemanticText
            as="p"
            className={summaryClassName(variant)}
            role="card-summary"
            text={chrome.summary}
            variant={variant}
          />
        </Stack>
      </SelectionRail>
    </Header>
  )
}
