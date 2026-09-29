"use client";

import { categories } from "@/lib/site";
import type { CategorySlug } from "@/lib/site";
import { Dot, Slot } from "../travel-dot/TravelDot";
import { pressHandlers, useTravelDot } from "../travel-dot/useTravelDot";
import styles from "./CategoryFilter.module.css";

type Props = {
  value: CategorySlug | null; // null = All
  counts: Record<string, number>;
  onChange: (value: CategorySlug | null) => void;
};

// 01 category row: All · Engineering 72 · Math 38 · Reading 24, with the travel dot.
// There's room above this row, so its dot hops upward (the nav's hops down).
export default function CategoryFilter({ value, counts, onChange }: Props) {
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
          {option.label}
          {option.slug && <span className={styles.count}>&nbsp; {counts[option.slug] ?? 0}</span>}
        </button>
      ))}
      <Dot ref={dotRef} />
    </div>
  );
}
