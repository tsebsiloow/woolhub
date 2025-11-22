import { Server } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";

/**
 * Socket.IO handler with optional Redis adapter.
 * - If REDIS_URL present, uses Redis adapter for cross-instance pub/sub.
 * - Otherwise falls back to in-memory maps (single-instance).
 *
 * Emits "online-count" per meeting room as earlier.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TypeScript: attach io to res.socket.server
  // @ts-ignore
  if (!res.socket.server.io) {
    console.log("Initializing Socket.IO server");

    // initialize io
    // @ts-ignore
    const io = new Server(res.socket.server as any, {
      path: "/api/socket.io",
      cors: { origin: "*" }
    });

    // If REDIS_URL is provided, attach redis adapter
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const pubClient = new Redis(redisUrl);
        const subClient = pubClient.duplicate();
        // give a small delay to ensure connections ready
        await Promise.all([pubClient.connect?.(), subClient.connect?.()].filter(Boolean));
        io.adapter(createAdapter(pubClient, subClient));
        console.log("Socket.IO Redis adapter initialized");
        // store redis clients for potential cleanup / use elsewhere
        // @ts-ignore
        res.socket.server.__redisPub = pubClient;
        // @ts-ignore
        res.socket.server.__redisSub = subClient;
      } catch (e) {
        console.error("Failed to initialize Redis adapter, falling back to in-memory:", e);
      }
    }

    // in-memory maps for presence if Redis not used
    // @ts-ignore
    if (!res.socket.server.__roomSockets) res.socket.server.__roomSockets = new Map();
    // @ts-ignore
    if (!res.socket.server.__socketToMeeting) res.socket.server.__socketToMeeting = new Map();
    // @ts-ignore
    if (!res.socket.server.__roomUsers) res.socket.server.__roomUsers = new Map();
    // @ts-ignore
    if (!res.socket.server.__socketToUser) res.socket.server.__socketToUser = new Map();

    io.on("connection", (socket) => {
      socket.on("join", (payload: { meetingId: string; userId?: string }) => {
        try {
          const { meetingId, userId } = payload || {};
          if (!meetingId) return;
          socket.join(meetingId);

          // in-memory presence bookkeeping (works alongside Redis adapter for simple local counts)
          // @ts-ignore
          const roomSockets = res.socket.server.__roomSockets;
          // @ts-ignore
          const socketToMeeting = res.socket.server.__socketToMeeting;
          // @ts-ignore
          const roomUsers = res.socket.server.__roomUsers;
          // @ts-ignore
          const socketToUser = res.socket.server.__socketToUser;

          socketToMeeting.set(socket.id, meetingId);
          let s = roomSockets.get(meetingId);
          if (!s) {
            s = new Set<string>();
            roomSockets.set(meetingId, s);
          }
          s.add(socket.id);

          if (userId) {
            socketToUser.set(socket.id, userId);
            let u = roomUsers.get(meetingId);
            if (!u) {
              u = new Set<string>();
              roomUsers.set(meetingId, u);
            }
            u.add(userId);
          }

          // emit counts (local counts; when Redis adapter used, global counts require a dedicated mechanism)
          const socketsCount = roomSockets.get(meetingId)?.size || 0;
          const accountsCount = roomUsers.get(meetingId)?.size || 0;
          io.to(meetingId).emit("online-count", { sockets: socketsCount, accounts: accountsCount });
        } catch (err) {
          console.error("join error", err);
        }
      });

      socket.on("signal", ({ to, data }) => {
        io.to(to).emit("signal", { from: socket.id, data });
      });

      socket.on("message", (payload) => {
        if (payload?.meetingId) io.to(payload.meetingId).emit("message", payload);
      });

      socket.on("disconnecting", () => {
        // cleanup presence
        // @ts-ignore
        const meetingId = res.socket.server.__socketToMeeting.get(socket.id);
        // @ts-ignore
        const userId = res.socket.server.__socketToUser.get(socket.id);
        if (meetingId) {
          // @ts-ignore
          const s = res.socket.server.__roomSockets.get(meetingId);
          if (s) {
            s.delete(socket.id);
            if (s.size === 0) res.socket.server.__roomSockets.delete(meetingId);
          }
          if (userId) {
            const u = res.socket.server.__roomUsers.get(meetingId);
            if (u) {
              let hasOther = false;
              for (const sockId of res.socket.server.__roomSockets.get(meetingId) || []) {
                if (res.socket.server.__socketToUser.get(sockId) === userId) {
                  hasOther = true;
                  break;
                }
              }
              if (!hasOther) u.delete(userId);
              if (u.size === 0) res.socket.server.__roomUsers.delete(meetingId);
            }
          }
          res.socket.server.__socketToMeeting.delete(socket.id);
          res.socket.server.__socketToUser.delete(socket.id);
          const socketsCount = res.socket.server.__roomSockets.get(meetingId)?.size || 0;
          const accountsCount = res.socket.server.__roomUsers.get(meetingId)?.size || 0;
          io.to(meetingId).emit("online-count", { sockets: socketsCount, accounts: accountsCount });
        }
      });
    });

    // @ts-ignore
    res.socket.server.io = io;
  }
  res.end();
}