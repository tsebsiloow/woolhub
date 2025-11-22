import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/users/me");
        if (!r.ok) return;
        const u = await r.json();
        setUsername(u?.username || null);
        setRole(u?.role || null);
      } catch (e) {}
    }
    load();
  }, [session]);

  function renderTag(roleStr?: string | null) {
    if (!roleStr) return null;
    if (roleStr === "ADMIN") return <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 700 }}>adomin</span>;
    if (roleStr === "MODERATOR") return <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 700 }}>modere</span>;
    return null;
  }

  return (
    <nav className="nav container">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/">
          <a style={{ fontWeight: 700, color: "var(--accent)" }}>WoolHub</a>
        </Link>
        <Link href="/admin">
          <a className="muted">Admin</a>
        </Link>
      </div>
      <div>
        {session ? (
          <>
            <span className="muted" style={{ marginRight: 8 }}>
              {username ?? session.user?.email ?? session.user?.name}
              {renderTag(role)}
            </span>
            <Link href="/settings">
              <a style={{ marginRight: 8 }} className="muted">Settings</a>
            </Link>
            <button className="btn" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/login">
              <a className="btn">Sign in</a>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}