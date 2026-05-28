"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/jam/bottom-nav";

const TAB_ROUTES = new Set(["/feed", "/collabs", "/you", "/post"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showBottomNav = TAB_ROUTES.has(pathname);

  return (
    <>
      {children}
      {showBottomNav && <BottomNav />}
    </>
  );
}
