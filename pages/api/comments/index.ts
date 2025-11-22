import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getClientIpFromReq } from "../../../lib/ipUtils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (req.method === "GET") {
    const { meetingId } = req.query;
    if (!meetingId) return res.status(400).json({ error: "meetingId required" });
    const comments = await prisma.comment.findMany({
      where: { meetingId: String(meetingId) },
      include: { author: { select: { id: true, username: true } } },
      orderBy: { createdAt: "asc" }
    });
    return res.status(200).json(comments);
  }

  if (req.method === "POST") {
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { bannedFromComments: true, banned: true } });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.banned) return res.status(403).json({ error: "User is banned" });
    if (user.bannedFromComments) return res.status(403).json({ error: "You are banned from commenting" });

    const { meetingId, content } = req.body;
    if (!meetingId || !content) return res.status(400).json({ error: "Missing fields" });

    const bannedWords = await prisma.bannedWord.findMany();
    const lower = content.toLowerCase();
    for (const bw of bannedWords) {
      if (!bw.word) continue;
      if (lower.includes(bw.word.toLowerCase())) {
        return res.status(400).json({ error: "Comment contains a banned word" });
      }
    }

    const ip = getClientIpFromReq(req) || "unknown";
    try {
      await prisma.userIp.upsert({
        where: { userId_ip: { userId: session.user.id, ip } },
        update: { seenAt: new Date() },
        create: { userId: session.user.id, ip }
      });
    } catch (e) {}

    const comment = await prisma.comment.create({
      data: {
        content,
        meetingId,
        authorId: session.user.id
      },
      include: { author: { select: { id: true, username: true } } }
    });

    return res.status(201).json(comment);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}