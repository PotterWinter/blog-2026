"use client";

import type { ReactNode } from "react";
import { Dot, Slot } from "../travel-dot/TravelDot";
import { pressHandlers, useTravelDot } from "../travel-dot/useTravelDot";
import styles from "./CategoryFilter.module.css";

export type CategoryOption<T> = { value: T; label: string; count: number };

type Props<T> = {
  options: CategoryOption<T>[];
  value: T;
  onChange: (value: T) => void;
  children?: ReactNode; // the rest of the row: Tags toggle, search
  // Phones: spread the labels across the row (01's four) — or keep them flush left
  // (02's two, owner 30 Sep 69)
  spread?: boolean;
};

// A row of big category labels with counts and the travel dot: 01's All 134 ·
// Engineering 72 · Math 38 · Reading 24, 02's Development 2 · Design 4.
// There's room above this row, so its dot hops upward (the nav's hops down).
export default function CategoryFilter<T>({
  options,
  value,
  onChange,
  children,
  spread = true,
}: Props<T>) {
  const active = options.findIndex((o) => o.value === value);
  const { dotRef, itemRef, boing } = useTravelDot(active, "up");

  return (
    <div
      className={styles.row}
      role="group"
      aria-label="Category"
      data-spread={spread || undefined}
      data-reveal
      data-d="180"
    >
      {options.map((option, i) => (
        <button
          key={option.label}
          ref={itemRef(i)}
          type="button"
          className={styles.item}
          aria-pressed={i === active}
          data-active={i === active || undefined}
          onClick={() => (i === active ? boing() : onChange(option.value))}
          {...pressHandlers}
        >
          <Slot />
          {/* One inline run for the word and its number, so the number can be lifted
              the same way whether the button is a flex box (phones) or inline (768+) */}
          <span>
            {option.label}
            <span className={styles.count}>{option.count}</span>
          </span>
        </button>
      ))}
      {children}
      <Dot ref={dotRef} />
    </div>
  );
}
