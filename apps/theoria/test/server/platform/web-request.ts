/**
 * The server tests' side of the host boundary: the one module in the server
 * tests that names a host object, just as `apps/theoria/app/web/platform/` is
 * the one module in shipped code that does. The Worker's `fetch` export and
 * Effect's `HttpServerRequest.fromWeb` both take the web `Request` the host
 * would hand the Worker; this module builds that one object.
 */
import { HttpServerRequest } from "@effect/platform"

/** The web request for `url`, as the host would deliver it. */
export const webRequest = (url: string, init: RequestInit): Request => new Request(url, init)

/** A server request for `url`, as the host would deliver it. */
export const serverRequest = (url: string, init: RequestInit): HttpServerRequest.HttpServerRequest =>
  HttpServerRequest.fromWeb(webRequest(url, init))

/**
 * A server request for `url` carrying `cookie` as its `Cookie` header. The
 * header is set after construction: a browser-shaped `Request` strips it from
 * its constructor's init, the host that hands the Worker a request does not.
 */
export const serverRequestWithCookie = (url: string, cookie: string): HttpServerRequest.HttpServerRequest => {
  const request = webRequest(url, { method: "GET" })
  request.headers.set("cookie", cookie)
  return HttpServerRequest.fromWeb(request)
}
