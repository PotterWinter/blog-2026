"use client";

import { Dot, Slot } from "../travel-dot/TravelDot";
import { pressHandlers, useTravelDot } from "../travel-dot/useTravelDot";
import styles from "./Pager.module.css";

type Props = {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  onChange: (page: number) => void;
};

// Which page numbers to show: all of them up to 7, otherwise the first and last
// with a window around the current page — 01 02 03 04 05 … 12 / 01 … 05 06 07 … 12
function pageList(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, 5, "gap", pages];
  if (page >= pages - 2) return [1, "gap", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "gap", page - 1, page, page + 1, "gap", pages];
}

const two = (n: number) => String(n).padStart(2, "0");

// SHOWING 1—12 OF 134 · PREV 01 02 03 … 12 NEXT, with a small travel dot on the page
export default function Pager({ page, pages, from, to, total, onChange }: Props) {
  const list = pageList(page, pages);
  const numbers = list.filter((n): n is number => n !== "gap");
  const { dotRef, itemRef, boing } = useTravelDot(numbers.indexOf(page), "up");

  return (
    <nav className={styles.pager} aria-label="Pages">
      <span className="label">
        Showing {from}—{to} of {total}
      </span>
      <div className={styles.controls}>
        <button
          type="button"
          className={`label ${styles.step}`}
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          Prev
        </button>
        <div className={styles.numbers}>
          {list.map((n, i) => {
            if (n === "gap") {
              return (
                <span key={`gap-${i}`} className={styles.gap}>
                  …
                </span>
              );
            }
            return (
              <button
                key={n}
                ref={itemRef(numbers.indexOf(n))}
                type="button"
                className={styles.number}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                data-active={n === page || undefined}
                onClick={() => (n === page ? boing() : onChange(n))}
                {...pressHandlers}
              >
                <Slot />
                {two(n)}
              </button>
            );
          })}
          <Dot ref={dotRef} />
        </div>
        <button
          type="button"
          className={`label ${styles.step}`}
          disabled={page === pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
