"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./Post.module.css";

type Link = { label: string; url: string; preview: string | null };

type Props = { title: string; excerpt: string; links: Link[] };

// 04B title block (v4 _plinks): title and excerpt, then "See it live" and up to three
// link buttons, beside a 16:10 preview. Nothing shows at rest; pointing at a link drops
// a 6px dot in front of it (the label steps aside) and fades that link's preview in.
// Moving to another link, the dot hops over in an arc and lands with a squash.
// Touch screens have no hover: no dot, no preview (the column goes; v4 hides it on
// phones), just the buttons.
export default function ProjectLead({ title, excerpt, links }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const dot = dotRef.current;
    const preview = previewRef.current;
    if (!row || !dot) return;
    const items = [...row.querySelectorAll<HTMLAnchorElement>("a")];
    const shots = preview ? [...preview.children] : [];
    let cur = -1;
    let x = 0;
    let y = 0;

    // In front of the link, halfway down its label
    const pos = (k: number): [number, number] => {
      const a = items[k];
      const name = a.querySelector<HTMLElement>("[data-name]");
      const mid = name ? name.offsetTop + name.offsetHeight / 2 : a.offsetHeight / 2;
      return [a.offsetLeft, a.offsetTop + mid - 3];
    };
    const show = (k: number) => shots.forEach((s, i) => s.toggleAttribute("data-on", i === k));
    const go = (k: number) => {
      if (k === cur) return;
      const fresh = cur < 0;
      items.forEach((a, i) => a.toggleAttribute("data-on", i === k));
      const [nx, ny] = pos(k);
      dot.getAnimations().forEach((q) => q.cancel());
      if (fresh) {
        // Drops in from above and settles
        dot.animate(
          [
            { transform: `translate(${nx}px, ${ny - 14}px) scale(.6)` },
            { transform: `translate(${nx}px, ${ny}px) scale(1.2, .78)`, offset: 0.45 },
            { transform: `translate(${nx}px, ${ny - 3}px) scale(.95, 1.05)`, offset: 0.72 },
            { transform: `translate(${nx}px, ${ny}px) scale(1)` },
          ],
          { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
      } else {
        // Hops over: higher the further it goes, squashes on landing
        const h = Math.min(26, 10 + Math.abs(nx - x) * 0.08);
        dot.animate(
          [
            { transform: `translate(${x}px, ${y}px) scale(1)` },
            { transform: `translate(${(x + nx) / 2}px, ${Math.min(y, ny) - h}px) scale(.9, 1.12)`, offset: 0.42 },
            { transform: `translate(${nx}px, ${ny}px) scale(1.25, .72)`, offset: 0.8 },
            { transform: `translate(${nx}px, ${ny - 3}px) scale(.94, 1.06)`, offset: 0.9 },
            { transform: `translate(${nx}px, ${ny}px) scale(1)` },
          ],
          { duration: 560, easing: "cubic-bezier(.3,.6,.3,1)" },
        );
      }
      dot.style.transform = `translate(${nx}px, ${ny}px)`;
      x = nx;
      y = ny;
      cur = k;
      show(k);
      row.setAttribute("data-live", "");
    };
    const rest = () => {
      items.forEach((a) => a.removeAttribute("data-on"));
      show(-1);
      row.removeAttribute("data-live");
      cur = -1;
    };

    // Mouse (and keyboard focus); a finger's tap just follows the link
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const a = (e.target as Element).closest("a");
      const k = a ? items.indexOf(a as HTMLAnchorElement) : -1;
      if (k >= 0) go(k);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") rest();
    };
    const onFocus = (e: FocusEvent) => {
      const k = items.indexOf(e.target as HTMLAnchorElement);
      if (k >= 0 && (e.target as Element).matches(":focus-visible")) go(k);
    };
    const onBlur = (e: FocusEvent) => {
      if (!row.contains(e.relatedTarget as Node)) rest();
    };
    row.addEventListener("pointerover", onOver);
    row.addEventListener("pointerleave", onLeave);
    row.addEventListener("focusin", onFocus);
    row.addEventListener("focusout", onBlur);
    return () => {
      row.removeEventListener("pointerover", onOver);
      row.removeEventListener("pointerleave", onLeave);
      row.removeEventListener("focusin", onFocus);
      row.removeEventListener("focusout", onBlur);
    };
  }, []);

  return (
    <div className={styles.lead}>
      <div>
        <h1 id="post-title" className={styles.title} data-reveal data-d="80">
          {title}
        </h1>
        <p className={styles.excerpt} data-reveal data-d="160">
          {excerpt}
        </p>
        <span className={`label ${styles.seeLive}`} data-reveal data-d="200">
          See it live
        </span>
        <div ref={rowRef} className={styles.links} data-reveal data-d="220">
          {links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener" className={styles.projectLink}>
              <span className={styles.linkName}>
                <span data-name>{link.label}</span>
                <svg
                  viewBox="0 0 20 20"
                  width="0.75em"
                  height="0.75em"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="square"
                  aria-hidden="true"
                >
                  <path vectorEffect="non-scaling-stroke" d="M1 19 18.5 1.5M10.5 1.5h8v8" />
                </svg>
              </span>
              <span className={styles.linkRule} />
            </a>
          ))}
          <span ref={dotRef} className={styles.linkDot} aria-hidden="true" />
        </div>
      </div>
      <div ref={previewRef} className={styles.preview} data-reveal data-d="260" aria-hidden="true">
        {links.map((link) => (
          <div key={link.url} className={styles.shot}>
            {link.preview && (
              <Image
                src={`/${link.preview}`}
                alt=""
                fill
                sizes="(min-width: 1024px) 500px, 50vw"
                className={styles.coverImage}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
