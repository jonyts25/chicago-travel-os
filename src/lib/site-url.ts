function isLoopbackHost(host: string): boolean {
  const normalized = host.split(":")[0].toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]"
  );
}

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function getSiteUrlFromRequest(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto = forwardedProto?.split(",")[0]?.trim() ?? "https";
    if (host) {
      return normalizeSiteUrl(`${proto}://${host}`);
    }
  }

  const host = request.headers.get("host");
  if (host && !isLoopbackHost(host)) {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "development" ? "http" : "https");
    return normalizeSiteUrl(`${proto}://${host}`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    return normalizeSiteUrl(siteUrl);
  }

  const requestOrigin = new URL(request.url).origin;
  if (!isLoopbackHost(new URL(request.url).host)) {
    return normalizeSiteUrl(requestOrigin);
  }

  return normalizeSiteUrl(requestOrigin);
}

export function getSiteUrlForClient(): string {
  if (typeof window !== "undefined") {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (configured) {
      return normalizeSiteUrl(configured);
    }
    return window.location.origin;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return normalizeSiteUrl(configured);
  }

  return "http://localhost:3000";
}
