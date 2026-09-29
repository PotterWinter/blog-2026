"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePageTransition } from "./PageTransition";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string };

// A Link that plays the page transition inside the site (on the current page too, which
// reloads it), and a plain Link anywhere else (login, admin)
export default function TransitionLink({ href, ...props }: Props) {
  const { go } = usePageTransition();

  return (
    <Link
      href={href}
      {...props}
      onNavigate={(e) => {
        if (!go) return;
        e.preventDefault();
        go(href);
      }}
    />
  );
}
