import { Match, Schema } from "effect"

import { ErrorCode } from "../../error.js"

import {
  type PackageDocsApiRoute,
  type PackageDocsBundleSelection,
  type PackageDocsSearchSelection
} from "./api-route.js"

export class PackageDocsApiFailurePresentation extends Schema.Class<PackageDocsApiFailurePresentation>(
  "PackageDocsApiFailurePresentation"
)({
  code: ErrorCode,
  message: Schema.String,
  status: Schema.Number
}) {}

export const packageDocsBundleFailurePresentation = (
  selection: PackageDocsBundleSelection
): PackageDocsApiFailurePresentation =>
  Match.value(selection).pipe(
    Match.tag(
      "MissingPackageDocsBundlePackage",
      () =>
        PackageDocsApiFailurePresentation.make({
          code: "invalid-query",
          message: "Bundle lookup requires ?package=<package-id>.",
          status: 400
        })
    ),
    Match.tag(
      "PackageDocsBundlePackage",
      ({ packageId }) =>
        PackageDocsApiFailurePresentation.make({
          code: "invalid-package-id",
          message: `Unknown package docs id: ${packageId}`,
          status: 404
        })
    ),
    Match.exhaustive
  )

export const packageDocsSearchFailurePresentation = (
  selection: PackageDocsSearchSelection
): PackageDocsApiFailurePresentation =>
  Match.value(selection).pipe(
    Match.tag(
      "MissingPackageDocsSearchQuery",
      () =>
        PackageDocsApiFailurePresentation.make({
          code: "invalid-query",
          message: "Package docs search requires a non-empty ?query=... value.",
          status: 400
        })
    ),
    Match.tag(
      "InvalidPackageDocsSearchPackage",
      ({ rawPackageId }) =>
        PackageDocsApiFailurePresentation.make({
          code: "invalid-package-id",
          message: `Unknown package docs id: ${rawPackageId}`,
          status: 404
        })
    ),
    Match.tag(
      "PackageDocsSearchQuery",
      () =>
        PackageDocsApiFailurePresentation.make({
          code: "invalid-query",
          message: "Package docs search requires a non-empty ?query=... value.",
          status: 400
        })
    ),
    Match.exhaustive
  )

export const packageDocsRouteFailurePresentation = (
  route: Extract<PackageDocsApiRoute, { readonly _tag: "route-not-found" }>
): PackageDocsApiFailurePresentation =>
  Match.value(route).pipe(
    Match.tag(
      "route-not-found",
      () =>
        PackageDocsApiFailurePresentation.make({
          code: "route-not-found",
          message: "Package docs API route not found.",
          status: 404
        })
    ),
    Match.exhaustive
  )
