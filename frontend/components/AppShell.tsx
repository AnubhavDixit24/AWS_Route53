import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Hosted zones", href: "/hosted-zones" },
  { label: "Health checks", href: "/health-checks" },
  { label: "Traffic policies", href: "/traffic-policies" },
  { label: "Resolver", href: "/resolver" },
  { label: "Profiles", href: "/profiles" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">aws</span>
          <span className="topbar-service">Route 53</span>
        </div>
        <div className="topbar-right">
            <span className="topbar-region">US East (N. Virginia)</span>
            <button
                className="btn topbar-theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
                {theme === "light" ? "🌙" : "☀️"}
            </button>
            <div className="topbar-user">
                <span>{user?.full_name ?? "..."}</span>
                <span className="topbar-account">Account: {user?.account_id}</span>
            </div>
            <button className="btn topbar-logout" onClick={() => logout()}>
                Sign out
            </button>
        </div>
        
      </header>

      <div className="shell-body">
        <nav className="sidebar">
          <div className="sidebar-title">Route 53</div>
          <ul>
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? router.pathname === "/"
                  : router.pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={active ? "active" : ""}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}