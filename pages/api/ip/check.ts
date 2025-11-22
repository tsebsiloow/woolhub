import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ip = (req.query.ip as string) || req.body?.ip;
  if (!ip) return res.status(400).json({ error: "ip required" });

  const ban = await prisma.ipBan.findUnique({ where: { ip } });
  if (ban) {
    return res.json({ banned: true, reason: ban.reason || null });
  }
  return res.json({ banned: false });
}