"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/abacus", label: "Abacus" },
  { href: "/lab", label: "Lab" },
];

export default function ToolsNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-6 py-3">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "rounded-full bg-black px-3 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
                  : "rounded-full px-3 py-1.5 text-sm font-semibold text-zinc-500 transition hover:text-black dark:text-zinc-400 dark:hover:text-white"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
