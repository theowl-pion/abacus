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
    <nav className="flex w-56 flex-shrink-0 flex-col gap-6 rounded-2xl border border-black/10 p-4 dark:border-white/10">
      <span className="px-3 text-sm font-bold tracking-tight text-black dark:text-white">
        Vettos
      </span>
      <div className="flex flex-col gap-1">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
                  : "rounded-xl px-3 py-2 text-sm font-semibold text-zinc-500 transition hover:bg-black/5 hover:text-black dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
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
