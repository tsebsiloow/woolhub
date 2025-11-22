import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const words = await prisma.bannedWord.findMany({ orderBy: { createdAt: "desc" } });
    return res.json(words);
  }

  if (req.method === "POST") {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: "word required" });
    const rec = await prisma.bannedWord.create({ data: { word } });
    return res.status(201).json(rec);
  }

  if (req.method === "DELETE") {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: "word required" });
    await prisma.bannedWord.deleteMany({ where: { word } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  res.status(405).end();
}