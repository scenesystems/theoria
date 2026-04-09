import { Match, Option, Schema } from "effect"

import { nullablePackageName, type PackageName, PackageNameSchema } from "./shared.js"

const withOptionalPackageParam = (params: URLSearchParams, packageId: PackageName | null): URLSearchParams => {
  if (packageId !== null) {
    params.set("package", packageId)
  }

  return params
}

export class PackageDocsLandingPageRoute extends Schema.TaggedClass<PackageDocsLandingPageRoute>()(
  "landing",
  {}
) {
  static fromPathname(pathname: string, search: string): Option.Option<PackageDocsLandingPageRoute> {
    return PackageDocsLandingPageRoute.matches(pathname) && nullablePackageName(new URLSearchParams(search).get("package")) === null
      ? Option.some(PackageDocsLandingPageRoute.make({}))
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return pathname === PackageDocsLandingPageRoute.pathname() || pathname === `${PackageDocsLandingPageRoute.pathname()}/`
  }

  static pathname(): string {
    return "/packages"
  }

  path(): string {
    return PackageDocsLandingPageRoute.pathname()
  }

  selectedPackageId(): PackageName | null {
    return null
  }
}

export class PackageDocsPackagePageRoute extends Schema.TaggedClass<PackageDocsPackagePageRoute>()(
  "package",
  {
    packageId: PackageNameSchema
  }
) {
  static fromPathname(pathname: string, search: string): Option.Option<PackageDocsPackagePageRoute> {
    const packageId = nullablePackageName(new URLSearchParams(search).get("package"))

    return PackageDocsPackagePageRoute.matches(pathname) && packageId !== null
      ? Option.some(PackageDocsPackagePageRoute.make({ packageId }))
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return pathname === PackageDocsLandingPageRoute.pathname() || pathname === `${PackageDocsLandingPageRoute.pathname()}/`
  }

  path(): string {
    return `${PackageDocsLandingPageRoute.pathname()}?${withOptionalPackageParam(new URLSearchParams(), this.packageId).toString()}`
  }

  selectedPackageId(): PackageName | null {
    return this.packageId
  }
}

export const PackageDocsPageRouteSchema = Schema.Union(PackageDocsLandingPageRoute, PackageDocsPackagePageRoute)

export type PackageDocsPageRoute = typeof PackageDocsPageRouteSchema.Type
