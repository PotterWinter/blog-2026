"use client";

import type { ReactNode } from "react";
import { categories } from "@/lib/site";
import type { CategorySlug } from "@/lib/site";
import { Dot, Slot } from "../travel-dot/TravelDot";
import { pressHandlers, useTravelDot } from "../travel-dot/useTravelDot";
import styles from "./CategoryFilter.module.css";

type Props = {
  value: CategorySlug | null; // null = All
  counts: Record<string, number>; // per category slug, plus "all"
  onChange: (value: CategorySlug | null) => void;
  children?: ReactNode; // the rest of the row: Tags toggle, search
};

// 01 category row: All 134 · Engineering 72 · Math 38 · Reading 24, with the travel dot.
// There's room above this row, so its dot hops upward (the nav's hops down).
export default function CategoryFilter({ value, counts, onChange, children }: Props) {
  const options = [{ slug: null, label: "All" }, ...categories];
  const active = options.findIndex((o) => o.slug === value);
  const { dotRef, itemRef, boing } = useTravelDot(active, "up");

  return (
    <div className={styles.row} role="group" aria-label="Category" data-reveal data-d="180">
      {options.map((option, i) => (
        <button
          key={option.label}
          ref={itemRef(i)}
          type="button"
          className={styles.item}
          aria-pressed={i === active}
          data-active={i === active || undefined}
          onClick={() => (i === active ? boing() : onChange(option.slug))}
          {...pressHandlers}
        >
          <Slot />
          {/* One inline run for the word and its number, so the number can be lifted
              the same way whether the button is a flex box (phones) or inline (768+) */}
          <span>
            {option.label}
            <span className={styles.count}>{counts[option.slug ?? "all"] ?? 0}</span>
          </span>
        </button>
      ))}
      {children}
      <Dot ref={dotRef} />
    </div>
  );
}
