// ==========================================
// LOGISCO - PHONE TAB BAR (crew, mechanic)
// ==========================================
// On a phone the crew and mechanic portals have three and four pages, which is
// a tab bar's worth, and it sits under the thumb instead of behind a menu
// button in the top corner a driver has to reach across the screen for.
//
// "More" opens the sidebar for what is left in it: who is signed in and the
// logout. The header's menu button is hidden wherever this bar shows, so there
// is one way to open it rather than two.
//
// In the layout's flow below <main>, not fixed over it, so it never covers the
// bottom of a page - the crew dashboard's sticky action bar sits on top of it.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { PORTAL_NAV, isActive, type Portal } from "@/components/portalNav";

interface BottomTabBarProps {
  portal: Portal;
  onMore: () => void;
}

const TAB =
  "flex flex-1 flex-col items-center justify-center gap-0.5 min-h-14 px-1 text-xs font-medium transition-colors";

export default function BottomTabBar({ portal, onMore }: BottomTabBarProps) {
  const pathname = usePathname();
  const { items } = PORTAL_NAV[portal];

  return (
    <nav
      data-bottom-nav
      aria-label="Main"
      className="md:hidden shrink-0 flex bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(15,23,42,0.05)] pb-[var(--safe-bottom)] z-30"
    >
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${TAB} relative ${active ? "text-blue-700 font-semibold" : "text-slate-600"}`}
          >
            {/* A bar over the lit tab, so the page you are on does not rest on
                colour alone. */}
            {active && (
              <span aria-hidden="true" className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-blue-600" />
            )}
            <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
            <span className="leading-tight">{item.short}</span>
          </Link>
        );
      })}

      <button type="button" onClick={onMore} className={`${TAB} text-slate-600`}>
        <Menu className="w-5 h-5" />
        <span className="leading-tight">More</span>
      </button>
    </nav>
  );
}
