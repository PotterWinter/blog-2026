"use client";

import { Fragment } from "react";
import type { ReactNode } from "react";
import { usePageTransition } from "./PageTransition";

// Wraps the page (not the header or footer). When the current page is pressed again,
// the round changes, React throws the old page away and mounts it fresh — so any state
// it held (the category filter, the page number) goes back to its starting value.
export default function PageSlot({ children }: { children: ReactNode }) {
  const { round } = usePageTransition();
  return <Fragment key={round}>{children}</Fragment>;
}
