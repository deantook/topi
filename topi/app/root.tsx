import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import type { Route } from "./+types/root";
import { ThemeProvider } from "@/components/theme-provider";
import { queryClient } from "@/lib/query-client";
import "./app.css";

const themeScript = `
(function() {
  const k = 'topi-theme';
  const raw = localStorage.getItem(k);
  let mode = 'system', accent = 'neutral';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system')) {
        mode = parsed.mode;
        if (['neutral','blue','green','purple'].includes(parsed.accent)) accent = parsed.accent;
      }
    } catch (_) {
      if (raw === 'light' || raw === 'dark' || raw === 'system') mode = raw;
    }
  }
  const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-accent', accent);
})();
`;

export function meta() {
  return [{ title: "待办清单" }];
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster richColors position="top-center" />
            <ScrollRestoration />
            <Scripts />
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
