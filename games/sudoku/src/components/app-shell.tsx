import { SiteFrame, SiteHeader } from "@/components/site-chrome";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SiteFrame>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 py-8">{children}</main>
    </SiteFrame>
  );
}
