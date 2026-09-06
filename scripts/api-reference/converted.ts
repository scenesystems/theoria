import { Data } from "effect"
import type { Application, Comment, DeclarationReflection, ProjectReflection } from "typedoc"

import { type ConvertedRoute } from "./conversion.js"
import { type ApiSourceModule, type ApiSourcePackage } from "./source.js"

// Conversion output, alive only inside the process that converted the
// package. Everything TypeDoc needs the TypeScript program for happens there:
// public exports are read from the reflections and each source file with its
// own page is converted as an entrypoint of its own. The projects are then
// serialized (see ./conversion.ts) and the program is gone with the process.

export class ApiSourceProject extends Data.Class<{
  readonly source: string
  readonly project: ProjectReflection
}> {}

export class ApiModuleConversion extends Data.Class<{
  readonly source: ApiSourceModule
  readonly project: ProjectReflection
  readonly routes: ReadonlyArray<ConvertedRoute>
  readonly sourceProjects: ReadonlyArray<ApiSourceProject>
}> {}

export class ApiPackageConversion extends Data.Class<{
  readonly app: Application
  readonly sourcePackage: ApiSourcePackage
  readonly modules: ReadonlyArray<ApiModuleConversion>
}> {}

// A module revived from its serialized projects in the generator, one at a
// time while its pages are written. Cross-package `{@link}` resolution needs
// the public exports of every module first; those travel in the summaries,
// so no reflection has to be alive before its own pages are generated.

export class ApiSourceComment extends Data.Class<{
  readonly source: string
  readonly comment: Comment
}> {}

export class ApiConvertedModule extends Data.Class<{
  readonly source: ApiSourceModule
  readonly project: ProjectReflection
  readonly reflection: DeclarationReflection
  readonly routes: ReadonlyArray<ConvertedRoute>
  readonly sourceComments: ReadonlyArray<ApiSourceComment>
}> {}
