import type { Application, Comment, DeclarationReflection, ProjectReflection } from "typedoc"

import { type PackagePublicExport } from "./public-exports.js"
import { type ApiSourceModule, type ApiSourcePackage, type PackagePublicEntrypoint } from "./source.js"

// Output of the conversion phase. Every package is converted before any page
// is emitted because cross-package `{@link}` resolution needs the public
// exports of every module first. Everything TypeDoc needs the TypeScript
// program for happens here, so the programs of all packages never have to be
// alive at once while pages are written.

export type ApiConvertedRoute = {
  readonly entrypoint: PackagePublicEntrypoint
  readonly publicExports: ReadonlyArray<PackagePublicExport>
}

// Leading module comment of a source file that gets its own documentation
// page (see `hasSourceDocumentationPages`).
export type ApiSourceComment = {
  readonly source: string
  readonly comment: Comment
}

export type ApiConvertedModule = {
  readonly source: ApiSourceModule
  readonly project: ProjectReflection
  readonly reflection: DeclarationReflection
  readonly routes: ReadonlyArray<ApiConvertedRoute>
  readonly sourceComments: ReadonlyArray<ApiSourceComment>
}

export type ApiConvertedPackage = {
  readonly app: Application
  readonly sourcePackage: ApiSourcePackage
  readonly modules: ReadonlyArray<ApiConvertedModule>
}
