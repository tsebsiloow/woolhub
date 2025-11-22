export function getClientIpFromReq(req: any): string | null {
  const xff = req.headers?.["x-forwarded-for"] as string | undefined;
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[0];
  }
  // @ts-ignore
  const sockAddr = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (sockAddr) return sockAddr;
  return null;
}