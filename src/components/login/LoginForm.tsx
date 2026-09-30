"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./Login.module.css";

const LENGTH = 6;

// 05 (v4 _otp / _pasteBtns): one field over six underlines. A digit shows for a second,
// then turns to •. Checked on Continue or Enter, not as it's typed: right = the six
// underlines turn into green boxes together and the admin opens (v4 staggered them;
// the owner wanted them at once, like the red); wrong = red boxes that shake. Typing
// again clears the red. v4's Paste button is gone: browsers ask before a page may read
// the clipboard (Safari showed nothing at all), and a long-press paste or the iPhone's
// suggested code already does the job (owner, 1 Oct 69).
export default function LoginForm({ next, aside }: { next: string; aside: React.ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const segsRef = useRef<HTMLSpanElement[]>([]);
  const realRef = useRef(""); // the digits; the field only ever shows • and the newest
  const checkRef = useRef<() => void>(() => {});

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    let show = -1; // the one digit still showing
    let timer = 0;
    let alerted = false;
    let busy = false;

    const draw = (caret?: number) => {
      const real = realRef.current;
      input.value = [...real].map((c, i) => (i === show ? c : "•")).join("");
      input.scrollLeft = 0;
      input.style.caretColor = real.length >= LENGTH ? "transparent" : "";
      if (caret != null) input.setSelectionRange(caret, caret);
    };
    const set = (digits: string, caret: number, reveal: number) => {
      realRef.current = digits.slice(0, LENGTH);
      show = reveal;
      clearTimeout(timer);
      draw(Math.min(caret, realRef.current.length));
      if (reveal >= 0) {
        timer = window.setTimeout(() => {
          show = -1;
          const [a, b] = [input.selectionStart, input.selectionEnd];
          draw();
          input.setSelectionRange(a, b);
        }, 1000);
      }
    };

    const segs = segsRef.current;
    const rest = () => segs.forEach((g) => g.removeAttribute("data-state"));
    const unalert = () => {
      if (!alerted) return;
      alerted = false;
      rest();
    };

    const check = async () => {
      if (busy) return;
      const code = realRef.current;
      if (code.length < LENGTH) {
        input.focus();
        return;
      }
      busy = true;
      let res: Response | null = null;
      try {
        res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
      } catch {
        // offline: treated like any other failure below
      }
      alerted = true;
      if (res?.ok) {
        segs.forEach((g) => (g.dataset.state = "right"));
        window.setTimeout(() => router.replace(next), 550);
        return;
      }
      busy = false;
      segs.forEach((g, i) => {
        g.dataset.state = "wrong";
        g.animate(
          [
            { transform: "none" },
            { transform: "translateX(-5px)" },
            { transform: "translateX(4px)" },
            { transform: "translateX(-2px)" },
            { transform: "none" },
          ],
          { duration: 380, delay: 120 + i * 45, easing: "cubic-bezier(.3,.7,.3,1)" },
        );
      });
    };
    checkRef.current = check;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      check();
    };
    // Every edit goes through here, so the field never holds the real digits
    const onBeforeInput = (e: InputEvent) => {
      e.preventDefault();
      const s = input.selectionStart ?? 0;
      const en = input.selectionEnd ?? s;
      const real = realRef.current;
      if (e.inputType.startsWith("insert")) {
        const src = e.data ?? e.dataTransfer?.getData("text") ?? "";
        const d = src.replace(/\D/g, "");
        if (!d) return;
        const r = (real.slice(0, s) + d + real.slice(en)).slice(0, LENGTH);
        const c = Math.min(s + d.length, LENGTH);
        unalert();
        set(r, c, d.length === 1 ? c - 1 : -1);
      } else if (e.inputType.startsWith("delete")) {
        if (s !== en) set(real.slice(0, s) + real.slice(en), s, -1);
        else if (e.inputType === "deleteContentBackward" && s > 0) {
          set(real.slice(0, s - 1) + real.slice(s), s - 1, -1);
        } else if (e.inputType === "deleteContentForward") {
          set(real.slice(0, s) + real.slice(s + 1), s, -1);
        }
        unalert();
      }
    };
    const onScroll = () => (input.scrollLeft = 0);
    // The browser's own highlight would run across the gaps and past the last slot, so
    // it's hidden (CSS) and the selected slots turn grey instead
    const onSelect = () => {
      const a = input.selectionStart ?? 0;
      const b = input.selectionEnd ?? 0;
      const on = document.activeElement === input && b > a;
      segs.forEach((g, i) => g.toggleAttribute("data-sel", on && i >= a && i < b));
    };

    input.addEventListener("keydown", onKey);
    input.addEventListener("beforeinput", onBeforeInput);
    input.addEventListener("scroll", onScroll);
    input.addEventListener("blur", onSelect);
    document.addEventListener("selectionchange", onSelect);
    return () => {
      input.removeEventListener("keydown", onKey);
      input.removeEventListener("beforeinput", onBeforeInput);
      input.removeEventListener("scroll", onScroll);
      input.removeEventListener("blur", onSelect);
      document.removeEventListener("selectionchange", onSelect);
      clearTimeout(timer);
    };
  }, [next, router]);

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        checkRef.current();
      }}
    >
      <div className={styles.row} data-reveal data-d="120">
        <div className={styles.slots}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <span
              key={i}
              className={styles.seg}
              style={{ "--i": i } as React.CSSProperties}
              ref={(el) => {
                if (el) segsRef.current[i] = el;
              }}
            />
          ))}
          <input
            ref={inputRef}
            className={styles.input}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="6-digit code"
            spellCheck={false}
            autoFocus
          />
        </div>
      </div>
      <div className={styles.actions} data-reveal data-d="220">
        <button type="submit" className={styles.continue}>
          Continue to admin
        </button>
        {aside}
      </div>
    </form>
  );
}
