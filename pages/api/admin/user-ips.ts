import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const username = String(req.query.username || "");
  if (!username) return res.status(400).json({ error: "username required" });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(404).json({ error: "user not found" });

  const ips = await prisma.userIp.findMany({ where: { userId: user.id }, orderBy: { seenAt: "desc" } });
  return res.json(ips);
}