import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ToastProvider } from "../components/Toast";
import { ThemeProvider } from "../context/ThemeContext";
import "../styles/globals.css";
import { ShortcutsProvider } from "../context/ShortcutsContext";
const PUBLIC_PATHS = ["/login"];

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(router.pathname);
    if (!user && !isPublic) {
      router.push("/login");
    }
    if (user && isPublic) {
      router.push("/");
    }
  }, [user, loading, router.pathname]);

  if (loading) {
    return (
      <div className="full-page-loading">
        <div className="spinner" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ShortcutsProvider>
            <RouteGuard>
              <Component {...pageProps} />
            </RouteGuard>
          </ShortcutsProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}