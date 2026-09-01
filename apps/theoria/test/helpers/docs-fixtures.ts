import type { ApiDocumentation, ApiPage, DocsManifest, DocsSearchIndex, GuidePage } from "@theoria/docs-model"

const revision = "0123456789abcdef0123456789abcdef01234567"
const packageRoot = `/docs-data/${revision}/packages/effect-search`
const sourceUrl = `https://github.com/scenesystems/theoria/blob/${revision}/packages/effect-search/src/index.ts`

export const docsManifestFixture: DocsManifest = {
  schemaVersion: 2,
  revision,
  searchIndexAsset: `/docs-data/${revision}/search-index.json`,
  packages: [{
    name: "@scenesystems/effect-search",
    version: "1.2.3",
    slug: "effect-search",
    description: "Effect-native optimization studies.",
    npmUrl: "https://www.npmjs.com/package/@scenesystems/effect-search",
    repositoryUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-search",
    overview: {
      slug: "",
      title: "@scenesystems/effect-search",
      summary: "Effect-native optimization studies.",
      path: "/docs/effect-search",
      asset: `${packageRoot}/guides/overview.json`
    },
    guides: [{
      slug: "getting-started",
      title: "Getting started",
      summary: "Install and run a study.",
      path: "/docs/effect-search/getting-started",
      asset: `${packageRoot}/guides/getting-started.json`
    }],
    apiModules: [{
      name: "@scenesystems/effect-search",
      subpath: ".",
      slug: "",
      path: "/docs/effect-search/api",
      asset: `${packageRoot}/pages/index.json`,
      aliases: [],
      summary: "Optimization study primitives.",
      since: "1.0.0",
      exportCount: 2,
      categories: ["studies", "models"]
    }, {
      name: "Study",
      subpath: "./Study",
      slug: "Study",
      path: "/docs/effect-search/api/Study",
      asset: `${packageRoot}/pages/Study.json`,
      aliases: ["/docs/effect-search/api/study"],
      summary: "Build and run optimization studies.",
      since: "1.0.0",
      exportCount: 2,
      categories: ["studies", "models"]
    }]
  }]
}

export const guidePageFixture: GuidePage = {
  schemaVersion: 1,
  kind: "guide",
  path: "/docs/effect-search",
  package: {
    name: "@scenesystems/effect-search",
    version: "1.2.3",
    slug: "effect-search",
    description: "Effect-native optimization studies."
  },
  title: "@scenesystems/effect-search",
  summary: "Effect-native optimization studies.",
  sourceUrl,
  blocks: [{
    kind: "paragraph",
    parts: [{ kind: "text", text: "Build reproducible optimization studies with " }, { kind: "code", text: "Effect" }, {
      kind: "text",
      text: "."
    }]
  }, {
    kind: "heading",
    depth: 2,
    id: "install",
    text: "Install"
  }, {
    kind: "code",
    language: "sh",
    source: "bun add @scenesystems/effect-search"
  }],
  anchors: [{ id: "install", label: "Install", depth: 2 }]
}

const emptyDocs: ApiDocumentation = {
  summary: [],
  remarks: [],
  examples: [],
  deprecated: null,
  see: []
}

export const apiPageFixture: ApiPage = {
  schemaVersion: 1,
  kind: "api-module",
  path: "/docs/effect-search/api/Study",
  canonical: true,
  canonicalPath: "/docs/effect-search/api/Study",
  aliases: ["/docs/effect-search/api/study"],
  package: {
    name: "@scenesystems/effect-search",
    version: "1.2.3",
    slug: "effect-search",
    description: "Effect-native optimization studies."
  },
  module: {
    name: "Study",
    subpath: "./Study",
    slug: "Study",
    docs: {
      ...emptyDocs,
      summary: [{ kind: "text", text: "Build and run optimization studies." }]
    },
    since: "1.0.0",
    sourceUrl
  },
  categories: [{ name: "studies", exportIds: ["effect-search/Study#runStudy"] }, {
    name: "models",
    exportIds: ["effect-search/Study#StudyResult"]
  }],
  exports: [{
    id: "effect-search/Study#runStudy",
    name: "runStudy",
    anchor: "api-runStudy",
    importKind: "value",
    category: "studies",
    since: "1.0.0",
    summary: "Run a study.",
    facets: [{
      kind: "function",
      declaration: "runStudy<A>(input: A): Effect<StudyResult<A>>",
      type: null,
      typeParameters: [],
      extends: [],
      implements: [],
      docs: emptyDocs,
      signatures: [{
        kind: "call",
        code: "runStudy<A>(input: A): Effect<StudyResult<A>>",
        typeParameters: [{
          name: "A",
          constraint: null,
          default: null,
          description: [{ kind: "text", text: "Study input." }]
        }],
        parameters: [{
          name: "input",
          type: "A",
          optional: false,
          rest: false,
          defaultValue: null,
          description: [{ kind: "text", text: "Input configuration." }]
        }],
        returns: {
          type: "Effect<StudyResult<A>>",
          description: [{ kind: "text", text: "The completed result." }]
        },
        docs: {
          ...emptyDocs,
          summary: [{ kind: "text", text: "Run a study." }],
          examples: [{ language: "ts", code: "const result = yield* runStudy(input)", parts: [] }]
        },
        sourceUrl: `${sourceUrl}#L20`
      }],
      members: [],
      sourceUrl: `${sourceUrl}#L20`
    }]
  }, {
    id: "effect-search/Study#StudyResult",
    name: "StudyResult",
    anchor: "api-StudyResult",
    importKind: "type",
    category: "models",
    since: "1.0.0",
    summary: "A completed result.",
    facets: [{
      kind: "interface",
      declaration: "interface StudyResult<A>",
      type: null,
      typeParameters: [{ name: "A", constraint: null, default: null, description: [] }],
      extends: [],
      implements: [],
      docs: {
        ...emptyDocs,
        summary: [{ kind: "text", text: "A completed result." }]
      },
      signatures: [],
      members: [{
        name: "value",
        anchor: "api-StudyResult-value",
        kind: "property",
        declaration: "readonly value: A",
        type: "A",
        optional: false,
        readonly: true,
        static: false,
        inherited: false,
        docs: {
          ...emptyDocs,
          summary: [{ kind: "text", text: "The selected value." }]
        },
        signatures: [],
        sourceUrl: `${sourceUrl}#L35`
      }],
      sourceUrl: `${sourceUrl}#L30`
    }]
  }]
}

export const docsSearchIndexFixture: DocsSearchIndex = {
  schemaVersion: 1,
  entries: [{
    id: "effect-search",
    kind: "package",
    package: "@scenesystems/effect-search",
    packageSlug: "effect-search",
    name: "@scenesystems/effect-search",
    qualifiedName: "@scenesystems/effect-search",
    category: null,
    summary: "Effect-native optimization studies.",
    path: "/docs/effect-search",
    anchor: null
  }, {
    id: "effect-search/Study#runStudy",
    kind: "symbol",
    package: "@scenesystems/effect-search",
    packageSlug: "effect-search",
    name: "runStudy",
    qualifiedName: "@scenesystems/effect-search/Study.runStudy",
    category: "studies",
    summary: "Run a study.",
    path: "/docs/effect-search/api/Study",
    anchor: "api-runStudy"
  }]
}
