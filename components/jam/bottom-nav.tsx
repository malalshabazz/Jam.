"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GridIcon, InboxIcon, PlusIcon, UserIcon } from "@/components/jam/icons";

const navItems = [
  { href: "/feed", label: "discover", Icon: GridIcon },
  { href: "/collabs", label: "inbox", Icon: InboxIcon },
  { href: "/you", label: "you", Icon: UserIcon },
];

type ActiveNav = "/feed" | "/collabs" | "/you" | "/post" | string;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeNav, setActiveNav] = useState<ActiveNav>(pathname);
  const [randomizingDiscover, setRandomizingDiscover] = useState(false);
  const navigationTimerRef = useRef<number | null>(null);
  const randomizeTimerRef = useRef<number | null>(null);
  const postSheetOpen = activeNav === "/post" || pathname === "/post";

  useEffect(() => {
    if (activeNav === "/post") return;
    if (navigationTimerRef.current) return;

    const frame = requestAnimationFrame(() => setActiveNav(pathname));
    return () => cancelAnimationFrame(frame);
  }, [activeNav, pathname]);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
      if (randomizeTimerRef.current) {
        window.clearTimeout(randomizeTimerRef.current);
      }
    };
  }, []);

  function clearPendingNavigation() {
    if (navigationTimerRef.current) {
      window.clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
  }

  function navigateWithAnimation(href: string) {
    if (href === "/feed" && pathname === "/feed") {
      window.dispatchEvent(new Event("jam:randomize-discover"));
      setRandomizingDiscover(true);
      if (randomizeTimerRef.current) {
        window.clearTimeout(randomizeTimerRef.current);
      }
      randomizeTimerRef.current = window.setTimeout(() => {
        setRandomizingDiscover(false);
        randomizeTimerRef.current = null;
      }, 520);
      return;
    }

    if (href === activeNav && href === pathname) return;

    clearPendingNavigation();
    setActiveNav(href);

    if (href === pathname) return;

    navigationTimerRef.current = window.setTimeout(() => {
      navigationTimerRef.current = null;
      router.push(href);
    }, 180);
  }

  function openPostSheet() {
    clearPendingNavigation();
    setActiveNav("/post");
    if (pathname !== "/post") router.push("/post");
  }

  return (
    <>
      <nav className="fixed bottom-0 left-1/2 z-50 h-[calc(96px+env(safe-area-inset-bottom))] w-full max-w-[390px] -translate-x-1/2 border-t border-white/10 bg-[#0a0a0a]/95 px-4 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-md items-center justify-center gap-2 pb-[env(safe-area-inset-bottom)]">
          <NavTab
            href="/feed"
            label="discover"
            Icon={GridIcon}
            activePath={activeNav}
            onNavigate={navigateWithAnimation}
            animating={randomizingDiscover}
          />

          <button
            type="button"
            onClick={openPostSheet}
            aria-label="Create post"
            aria-pressed={postSheetOpen}
            className={[
              "flex h-14 shrink-0 items-center justify-center rounded-2xl bg-white text-black transition-all duration-300 ease-out",
              postSheetOpen
                ? "w-32 shadow-[0_0_0_3px_rgba(255,255,255,0.22)]"
                : "w-14 shadow-lg",
            ].join(" ")}
          >
            <PlusIcon className="h-7 w-7" />
          </button>

          {navItems.slice(1).map(({ href, label, Icon }) => (
            <NavTab
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              activePath={activeNav}
              onNavigate={navigateWithAnimation}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavTab({
  href,
  label,
  Icon,
  activePath,
  onNavigate,
  animating,
}: {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
  activePath: string;
  onNavigate: (href: string) => void;
  animating?: boolean;
}) {
  const isActive = activePath === href;

  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={[
        "flex h-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-sm capitalize transition-all duration-300 ease-out",
        isActive
          ? "w-32 gap-2 border-blue-300/70 bg-zinc-900 px-4 text-white shadow-[0_0_0_1px_rgba(147,197,253,0.45)_inset]"
          : "w-14 gap-0 border-white/15 bg-transparent px-0 text-zinc-300",
        animating ? "scale-105 border-white/50 bg-zinc-800" : "",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-5 w-5 shrink-0 transition-transform duration-300",
          animating ? "animate-[jam-discover-shake_520ms_ease-in-out]" : "",
        ].join(" ")}
      />
      <span
        className={[
          "whitespace-nowrap transition-all duration-300 ease-out",
          isActive
            ? "max-w-20 translate-x-0 opacity-100"
            : "max-w-0 -translate-x-2 opacity-0",
          animating ? "animate-[jam-discover-shake_520ms_ease-in-out]" : "",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}
