"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { usePageTransition } from "./PageTransition";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string };

// A Link that plays the page transition inside the site, and a plain Link anywhere else
// (login, admin) or when it points at the page we're already on
export default function TransitionLink({ href, ...props }: Props) {
  const { go } = usePageTransition();
  const pathname = usePathname();

  return (
    <Link
      href={href}
      {...props}
      onNavigate={(e) => {
        if (!go || href === pathname) return;
        e.preventDefault();
        go(href);
      }}
    />
  );
}
