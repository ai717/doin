import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { ThemeSync } from "@/components/theme-sync";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { appJsonLd } from "@/lib/seo";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "description", content: APP_TAGLINE },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "theme-color", content: "#F3EEE4" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/sudoku/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/sudoku/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/sudoku/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(appJsonLd()),
      },
    ],
  }),
  component: () => (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <ThemeSync />
        <Outlet />
      </body>
    </html>
  ),
});
