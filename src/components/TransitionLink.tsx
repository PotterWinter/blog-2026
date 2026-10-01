"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePageTransition } from "./PageTransition";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string };

// A Link that plays the page transition (on the current page too, which starts it over)
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
