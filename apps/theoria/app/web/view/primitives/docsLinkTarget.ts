import { Boolean as Bool, Equal, Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Str from "effect/String"

import type {
  DocsApiModuleIndex,
  DocsApiModuleSummary,
  DocsGuideSummary,
  DocsManifest,
  DocsPackageSummary
} from "@theoria/docs-model"

/**
 * Where a documentation link goes, read from the manifest: a package's
 * overview, one of its guides, or an API module — with the export the hash
 * names, when it names one.
 */
export type DocsLinkTarget =
  | { readonly _tag: "Package"; readonly docsPackage: DocsPackageSummary }
  | { readonly _tag: "Guide"; readonly docsPackage: DocsPackageSummary; readonly guide: DocsGuideSummary }
  | {
    readonly _tag: "Module"
    readonly docsPackage: DocsPackageSummary
    readonly module: DocsApiModuleSummary
    readonly anchor: Option.Option<string>
  }

const splitHash = (href: string): { readonly path: string; readonly anchor: Option.Option<string> } => {
  const index = Str.indexOf("#")(href)
  return Option.match(index, {
    onNone: () => ({ path: href, anchor: Option.none() }),
    onSome: (at) => ({ path: Str.slice(0, at)(href), anchor: Option.some(Str.slice(Num.increment(at))(href)) })
  })
}

const packageTarget = (docsPackage: DocsPackageSummary, path: string): Option.Option<DocsLinkTarget> =>
  Bool.match(Bool.or(Equal.equals(path, docsPackage.overview.path), Equal.equals(path, `/docs/${docsPackage.slug}`)), {
    onTrue: () => Option.some({ _tag: "Package", docsPackage }),
    onFalse: Option.none
  })

const guideTarget = (docsPackage: DocsPackageSummary, path: string): Option.Option<DocsLinkTarget> =>
  Option.map(
    Arr.findFirst(docsPackage.guides, (guide) => Equal.equals(guide.path, path)),
    (guide): DocsLinkTarget => ({ _tag: "Guide", docsPackage, guide })
  )

const moduleTarget = (
  docsPackage: DocsPackageSummary,
  path: string,
  anchor: Option.Option<string>
): Option.Option<DocsLinkTarget> =>
  Option.map(
    Arr.findFirst(docsPackage.apiModules, (module) =>
      Bool.or(Equal.equals(module.path, path), Arr.contains(module.aliases, path))),
    (module): DocsLinkTarget => ({ _tag: "Module", docsPackage, module, anchor })
  )

const targetIn = (docsPackage: DocsPackageSummary, path: string, anchor: Option.Option<string>) =>
  packageTarget(docsPackage, path).pipe(
    Option.orElse(() => guideTarget(docsPackage, path)),
    Option.orElse(() => moduleTarget(docsPackage, path, anchor))
  )

/** `None` when the manifest has no page at `href`; the link then behaves as an ordinary link. */
export const docsLinkTarget = (manifest: DocsManifest, href: string): Option.Option<DocsLinkTarget> => {
  const { anchor, path } = splitHash(href)
  return Arr.findFirst(manifest.packages, (docsPackage) => targetIn(docsPackage, path, anchor))
}

/**
 * The preview's heading. A package is headed by its published name, which the
 * eyebrow's slug does not already say; a guide by its own title; an export or
 * module by the text the link showed, since that is how the visitor knows it.
 */
export const docsLinkTitle = (target: DocsLinkTarget, linkText: string): string =>
  Match.value(target).pipe(
    Match.tag("Package", ({ docsPackage }) => docsPackage.name),
    Match.tag("Guide", ({ guide }) => guide.title),
    Match.tag("Module", () => linkText),
    Match.exhaustive
  )

/** The page the link opens, as the address bar will show it: `docs/effect-text/api/Text`. */
export const docsLinkPath = (target: DocsLinkTarget): string =>
  Str.slice(1)(
    Match.value(target).pipe(
      Match.tag("Package", ({ docsPackage }) => docsPackage.overview.path),
      Match.tag("Guide", ({ guide }) => guide.path),
      Match.tag("Module", ({ module }) => module.path),
      Match.exhaustive
    )
  )

/**
 * One line about the destination, from the documentation itself. An export's
 * summary needs its module index; until that has loaded there is nothing to
 * say about the export, so nothing is said.
 */
export const docsLinkSummary = (
  target: DocsLinkTarget,
  moduleIndex: Option.Option<DocsApiModuleIndex>
): Option.Option<string> =>
  Match.value(target).pipe(
    Match.tag("Package", ({ docsPackage }) => Option.some(docsPackage.description)),
    Match.tag("Guide", ({ guide }) => Option.some(guide.summary)),
    Match.tag("Module", ({ anchor, module }) =>
      Option.match(anchor, {
        onNone: () => Option.some(module.summary),
        onSome: (name) =>
          Option.flatMap(moduleIndex, (page) =>
            Option.map(
              Arr.findFirst(page.exports, (apiExport) => Equal.equals(apiExport.anchor, name)),
              (apiExport) => apiExport.summary
            ))
      })),
    Match.exhaustive
  )

/** The module index an export summary needs, when the target names an export. */
export const docsLinkModuleAsset = (target: DocsLinkTarget): Option.Option<string> =>
  Match.value(target).pipe(
    Match.tag("Module", ({ anchor, module }) => Option.map(anchor, () => module.asset)),
    Match.orElse(() => Option.none<string>())
  )
