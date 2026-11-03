export async function hasValidSession(request, secret, sign) {
  if (!secret) return false;
  const authorization = request.headers.get("Authorization") || "";
  const bearer = authorization.match(/^Bearer\\s+(.+)$/i)?.[1];
  // A stale sessionStorage bearer must never shadow a valid HttpOnly cookie.
  const candidates = [...new Set([bearer, readCookie(request, "nexus_session")].filter(Boolean))];
  for (const token of candidates) {
    const [expiresText, signature] = token.split(".");
    const expires = Number(expiresText);
    if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000) || !signature) continue;
    const expected = await sign(secret, `nexus:${expires}`);
    if (signature === expected) return true;
  }
  return false;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
