import type { ApiDocumentation, ApiExport, DocsApiExportPage, DocsApiModuleIndex } from "@theoria/docs-model"
import { Option } from "effect"

import { apiPageFixture } from "./docs-fixtures.js"

const packageRoot = `/docs-data/0123456789abcdef0123456789abcdef01234567/packages/effect-search`
const fixtureSourceUrl = "https://github.com/scenesystems/theoria/blob/0123456789abcdef/src/Distribution.ts"

const emptyDocumentation: ApiDocumentation = {
  summary: [],
  remarks: [],
  examples: [],
  deprecated: Option.none(),
  see: []
}

const sharedOverloadDocumentation: ApiDocumentation = {
  ...emptyDocumentation,
  summary: [{ kind: "text", text: "Captures a replay snapshot." }]
}

export const declarationDocumentedApiExportFixture: ApiExport = {
  id: "effect-math/Distribution#betaQuantile",
  name: "betaQuantile",
  anchor: "api-betaQuantile",
  importKind: "value",
  category: "distributions",
  since: "1.0.0",
  summary: "Computes a beta quantile.",
  facets: [{
    kind: "function",
    declaration: "betaQuantile(p: number, alpha: number, beta: number): number",
    type: Option.none(),
    typeParameters: [],
    extends: [],
    implements: [],
    docs: {
      ...emptyDocumentation,
      summary: [{ kind: "text", text: "Computes a beta quantile with safeguarded Newton refinement." }],
      remarks: [{
        kind: "text",
        text: "Endpoint probabilities return exact support endpoints while interior estimates remain bracketed."
      }]
    },
    signatures: [{
      kind: "call",
      code: "betaQuantile(p: number, alpha: number, beta: number): number",
      typeParameters: [],
      parameters: [],
      returns: { type: "number", description: [] },
      docs: emptyDocumentation,
      sourceUrl: `${fixtureSourceUrl}#L10`
    }],
    members: [],
    sourceUrl: `${fixtureSourceUrl}#L10`
  }]
}

export const overloadedApiExportFixture: ApiExport = {
  id: "effect-search/Optimization#snapshot",
  name: "snapshot",
  anchor: "api-snapshot",
  importKind: "value",
  category: "snapshots",
  since: "1.0.0",
  summary: "Captures a snapshot.",
  facets: [{
    kind: "function",
    declaration: "snapshot(result: Result): Snapshot\nsnapshot(active: Active): Snapshot",
    type: Option.none(),
    typeParameters: [],
    extends: [],
    implements: [],
    docs: sharedOverloadDocumentation,
    signatures: [{
      kind: "call",
      code: "snapshot(result: Result): Snapshot",
      typeParameters: [],
      parameters: [],
      returns: { type: "Snapshot", description: [] },
      docs: {
        ...emptyDocumentation,
        summary: [{ kind: "text", text: "Captures a replay snapshot." }]
      },
      sourceUrl: `${fixtureSourceUrl}#L20`
    }, {
      kind: "call",
      code: "snapshot(active: Active): Snapshot",
      typeParameters: [],
      parameters: [],
      returns: { type: "Snapshot", description: [] },
      docs: {
        ...emptyDocumentation,
        summary: [{ kind: "text", text: "Captures the current state of an active optimization." }],
        remarks: [{ kind: "text", text: "The active overload retains resumable state." }]
      },
      sourceUrl: `${fixtureSourceUrl}#L21`
    }],
    members: [],
    sourceUrl: `${fixtureSourceUrl}#L20`
  }]
}

export const callableMemberApiExportFixture: ApiExport = {
  id: "effect-search/Optimization#Runner",
  name: "Runner",
  anchor: "api-Runner",
  importKind: "type",
  category: "models",
  since: "1.0.0",
  summary: "Runs an optimization.",
  facets: [{
    kind: "interface",
    declaration: "interface Runner",
    type: Option.none(),
    typeParameters: [],
    extends: [],
    implements: [],
    docs: emptyDocumentation,
    signatures: [],
    members: [{
      name: "run",
      anchor: "api-Runner-run",
      kind: "method",
      declaration: "run(input: Input): Result",
      type: Option.none(),
      optional: false,
      readonly: false,
      static: false,
      inherited: false,
      docs: {
        ...emptyDocumentation,
        summary: [{ kind: "text", text: "Runs one optimization from the supplied input." }]
      },
      signatures: [{
        kind: "call",
        code: "run(input: Input): Result",
        typeParameters: [],
        parameters: [],
        returns: { type: "Result", description: [] },
        docs: emptyDocumentation,
        sourceUrl: `${fixtureSourceUrl}#L30`
      }],
      sourceUrl: `${fixtureSourceUrl}#L30`
    }],
    sourceUrl: `${fixtureSourceUrl}#L25`
  }]
}

export const docsApiModuleIndexFixture: DocsApiModuleIndex = {
  schemaVersion: 2,
  kind: "api-module-index",
  path: apiPageFixture.path,
  canonical: apiPageFixture.canonical,
  canonicalPath: apiPageFixture.canonicalPath,
  aliases: apiPageFixture.aliases,
  package: apiPageFixture.package,
  module: apiPageFixture.module,
  categories: apiPageFixture.categories,
  exports: apiPageFixture.exports.map(({ anchor, category, id, importKind, name, since, summary }) => ({
    id,
    name,
    anchor,
    importKind,
    category,
    since,
    summary,
    asset: `${packageRoot}/pages/Study/${anchor}.json`
  }))
}

export const docsApiExportPageFixture = (index: number): DocsApiExportPage => ({
  schemaVersion: 1,
  kind: "api-export",
  export: Option.getOrThrow(Option.fromNullable(apiPageFixture.exports[index]))
})
