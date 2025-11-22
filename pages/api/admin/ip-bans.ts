import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const bans = await prisma.ipBan.findMany({ orderBy: { createdAt: "desc" } });
    return res.json(bans);
  }

  if (req.method === "POST") {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: "ip required" });
    const rec = await prisma.ipBan.upsert({
      where: { ip },
      update: { reason },
      create: { ip, reason }
    });
    return res.status(201).json(rec);
  }

  if (req.method === "DELETE") {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "ip required" });
    await prisma.ipBan.deleteMany({ where: { ip } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  res.status(405).end();
}