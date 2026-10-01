"use client";

import { useLayoutEffect, useRef } from "react";
import styles from "./Segmented.module.css";

type Option<T extends string> = { value: T; label: string };

// v4 .seg: a capsule of choices with a black pill under the chosen one, gliding to the
// next (the label inverts over it). GRID / LIST on the home page is the same thing;
// this one takes any options — the editor's BLOG / PROJECT, categories, WRITE / RAW .MD.
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string; // for screen readers
  disabled?: (value: T) => string | false; // why that one can't be picked, as a tooltip
}) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef(new Map<T, HTMLButtonElement>());

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const item = itemRefs.current.get(value);
    if (!pill || !item) return;
    const place = () => {
      pill.style.transform = `translateX(${item.offsetLeft}px)`;
      pill.style.width = `${item.offsetWidth}px`;
    };
    place();
    // First placement is instant; from then on the pill glides
    if (!pill.dataset.ready) requestAnimationFrame(() => (pill.dataset.ready = ""));
    const observer = new ResizeObserver(place);
    observer.observe(item);
    return () => observer.disconnect();
  }, [value, options]);

  return (
    <div className={styles.seg} role="group" aria-label={label}>
      <span ref={pillRef} className={styles.pill} aria-hidden="true" />
      {options.map((option) => {
        const why = disabled?.(option.value);
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) itemRefs.current.set(option.value, el);
              else itemRefs.current.delete(option.value);
            }}
            type="button"
            className={styles.item}
            aria-pressed={option.value === value}
            aria-disabled={why ? true : undefined}
            title={why || undefined}
            onClick={() => !why && option.value !== value && onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
