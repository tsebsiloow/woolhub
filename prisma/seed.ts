import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || "woolisbest";
  const adminPassword = process.env.ADMIN_PASSWORD || "1Sik.2Tti.3Ookw";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.warn(
      "WARNING: ADMIN_USERNAME or ADMIN_PASSWORD not set in environment. Falling back to insecure defaults. " +
        "Set ADMIN_USERNAME / ADMIN_PASSWORD in your .env or Render secrets for production."
    );
  }

  const hashed = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      password: hashed,
      role: "ADMIN",
      banned: false,
      bannedFromComments: false
    },
    create: {
      username: adminUsername,
      email: adminEmail,
      password: hashed,
      name: "Admin",
      role: "ADMIN",
      banned: false,
      bannedFromComments: false
    }
  });

  console.log("Seed: Admin created/updated:", adminUsername);

  // create example moderator user for testing
  const modPass = process.env.SAMPLE_MOD_PASSWORD || "modpass";
  const hashedMod = await bcrypt.hash(modPass, 10);
  await prisma.user.upsert({
    where: { username: "modere_user" },
    update: {},
    create: {
      username: "modere_user",
      email: "mod@example.com",
      password: hashedMod,
      name: "Moderator",
      role: "MODERATOR"
    }
  });

  // sample normal user
  const userPassword = process.env.SAMPLE_USER_PASSWORD || "userpass";
  const hashedUser = await bcrypt.hash(userPassword, 10);
  const user = await prisma.user.upsert({
    where: { username: "alice" },
    update: {},
    create: {
      username: "alice",
      email: "alice@example.com",
      password: hashedUser,
      name: "Alice",
      role: "USER"
    }
  });

  // sample meeting
  const m1 = await prisma.meeting.upsert({
    where: { title: "Weekly Sync" },
    update: {},
    create: {
      title: "Weekly Sync",
      description: "Weekly status meeting",
      startAt: new Date(Date.now() + 1000 * 60 * 60),
      endAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
      createdById: admin.id
    }
  });

  await prisma.comment.createMany({
    data: [
      {
        content: "Welcome to the meeting!",
        authorId: user.id,
        meetingId: m1.id,
        createdAt: new Date()
      }
    ],
    skipDuplicates: true
  });

  console.log("Seed finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
