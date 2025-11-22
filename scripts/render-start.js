// scripts/render-start.js
// Run DB migrations and start the app on Render.
// - It runs `prisma migrate deploy` and `prisma generate`.
// - Optionally runs the seed script if RUN_SEED=true (administrator should enable only for first deploy).
// - Finally starts the Next.js production server.
//
// Usage (Render): set start command to `npm run render:start` or `node scripts/render-start.js` that runs this script.

const { spawnSync } = require("child_process");

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts });
  if (r.error) {
    console.error("Command failed:", r.error);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`Command exited with status ${r.status}`);
    process.exit(r.status || 1);
  }
}

try {
  // Ensure Prisma migrations are applied (use migrate deploy on production)
  run("npx", ["prisma", "migrate", "deploy"]);

  // Ensure Prisma client is generated
  run("npx", ["prisma", "generate"]);

  // Optionally run seed (only when explicitly enabled)
  if (process.env.RUN_SEED === "true") {
    console.log("RUN_SEED=true, running seed script (ts-node) ...");
    // This requires ts-node to be installed on the environment (devDependency may not be installed in prod).
    // If ts-node isn't available, run seed manually via Render shell or convert seed to JS.
    run("npx", ["ts-node", "--transpile-only", "prisma/seed.ts"]);
  }

  // Start Next in production mode (respect PORT env)
  const port = process.env.PORT || "3000";
  console.log(`Starting app on port ${port} ...`);
  // Use next start (make sure build step ran during render build)
  run("npx", ["next", "start", "-p", port]);
} catch (e) {
  console.error("Startup script failed:", e);
  process.exit(1);
}