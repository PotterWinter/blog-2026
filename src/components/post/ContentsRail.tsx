"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Post.module.css";

type Item = { id: string; label: string; sub: boolean };

// Where a heading counts as "being read": once its top passes 35% down the screen (v4)
const LINE = 0.35;
// Scroll a heading this far below the top of the screen when jumping to it (v4)
const OFFSET = 96;
// Mouse travel before a press on the rail becomes a drag; a finger may move this
// much and still count as a tap
const DRAG = 4;
const TAP_SLOP = 10;
// Touch: the names fold away after this long untouched
const IDLE = 5000; // a tap opens the names for this long (owner, 4 Oct 69: 3s was quick)
// Tablet drag: the page glides to the entry under the finger once it has rested there
// this long
const DWELL = 120;

// 04 contents rail (v4 _tocRail): a short tick per heading down the right edge, held at
// the middle of the screen while the article is on it. The tick of the section being
// read is long and ink, with a 6px dot beside it that arcs over when the section
// changes. Hover (or a drag) opens the headings' names to the left.
// Press and drag along the rail (mouse or finger): reaching a tick, the page slides to
// that heading (on a tablet by finger, once it rests there — see slideTo). A click jumps to an
// entry; by touch, one tap opens the names and a tap on one goes there.
// From 1280 it sits in the page margin; below that it shrinks to the screen's edge.
// In the editor's WRITE (5.3d) the same rail runs on the text being typed: `live` reads
// the headings again as they change (EDITOR-SPEC: "updates as you type"), `ends: false`
// leaves out Title and End (the page there is the editor, not the post), and `onJump`
// hears where a click took the page (WRITE puts the caret there).
export default function ContentsRail({
  live = false,
  ends = true,
  onJump,
}: {
  live?: boolean;
  ends?: boolean;
  onJump?: (id: string) => void;
} = {}) {
  const navRef = useRef<HTMLElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const onJumpRef = useRef(onJump);
  useEffect(() => {
    onJumpRef.current = onJump;
  });

  // "Title" = the post's title (back to the top), then the article's numbered headings
  // (h2 = section, h3 = sub-section), and always last "End" = Previous | Next. Title and
  // End carry no number (owner, 30 Sep 69)
  useEffect(() => {
    const post = navRef.current?.closest("[data-post]");
    const article = post?.querySelector("[data-rail-text]") ?? post?.querySelector("article");
    const title = post?.querySelector<HTMLElement>("#post-title");
    if (!post || !article || (ends && !title)) return;
    const collect = () => {
      let n = 0;
      let m = 0;
      const found = [...article.querySelectorAll<HTMLElement>("h2[id], h3[id]")].map((h) => {
        const sub = h.tagName === "H3";
        if (sub) m += 1;
        else {
          n += 1;
          m = 0;
        }
        const num = sub ? `${String(n).padStart(2, "0")}.${m}` : String(n).padStart(2, "0");
        return { id: h.id, label: `${num} ${h.textContent ?? ""}`, sub };
      });
      const end = post.querySelector("#post-end") ? [{ id: "post-end", label: "End", sub: false }] : [];
      const next = ends ? [{ id: "post-title", label: "Title", sub: false }, ...found, ...end] : found;
      // Unchanged (typing in a paragraph): keep the same list, so the rail isn't rebuilt
      setItems((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    collect();
    if (!live) return;
    let queued = 0;
    const observer = new MutationObserver(() => {
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), collect()));
    });
    observer.observe(article, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["id"] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(queued);
    };
  }, [live, ends]);

  useEffect(() => {
    const nav = navRef.current;
    const dot = dotRef.current;
    const layer = layerRef.current;
    if (!nav || !dot || !layer || items.length === 0) return;
    const links = [...nav.querySelectorAll<HTMLAnchorElement>("a")];
    const heads = items.map((it) => document.getElementById(it.id));
    let cur = -1;
    let open = false;
    let x = 0;
    let y = 0;
    // A tablet: a touch screen whose shorter side is a tablet's (an iPad's is 744 or
    // more, a phone's 440 or less), whichever way it's held. The iPad fixes below are
    // for it alone — the computer and the iPhone keep the rail as it was (owner,
    // 2 Oct 69)
    const tablet = () =>
      window.matchMedia("(pointer: coarse)").matches &&
      Math.min(screen.width, screen.height) >= 600;
    const px = (name: string) => parseFloat(getComputedStyle(nav).getPropertyValue(name)) || 0;

    // Shut, the ticks sit close together (--pitch-shut apart) about the rail's middle;
    // open, they spread to the laid-out spacing (owner, 30 Sep 69). They spread from the
    // entry under the pointer or finger, which stays put, so what's about to be pressed
    // never slides away (why the spacing was once fixed). Moved by transforms, so the
    // rail's box — and where it's held — never changes.
    let dys = links.map(() => 0);
    let anchor = 0;
    // `follow`: the page is scrolling, so move with it at once rather than easing behind
    const spread = (follow = false) => {
      const pitch = links.length > 1 ? links[1].offsetTop - links[0].offsetTop : 0;
      const mid = (links.length - 1) / 2;
      const squeeze = pitch - px("--pitch-shut");
      const shut = links.map((_, i) => (mid - i) * squeeze);
      const box = nav.getBoundingClientRect();
      let next: number[];
      if (open) {
        // ...but never past either end of its range: the top of the post, or
        // (--rail-end short of) the top rule of Previous | Next — spread from the last
        // tick at the foot of the page, it ran over that rule (owner, 30 Sep 69)
        let shift = shut[anchor];
        const range = nav.parentElement?.getBoundingClientRect();
        if (range) {
          shift = Math.min(Math.max(shift, range.top - box.top), range.bottom - box.bottom);
        }
        next = links.map(() => shift);
      } else {
        // Shut, the ticks gather mid-box with room to spare above and below. When the
        // end of the page pushes the rail up off its held height, the gathering slides
        // down into that room first: it holds its place longer, and meets the end at
        // --rail-end from Previous | Next, not ~50px more (owner, 30 Sep 69)
        const room = mid * squeeze;
        const push = Math.max(-room, Math.min(room, heldAt - box.top));
        next = shut.map((v) => v + push);
      }
      const moved = next.some((v, i) => Math.abs(v - dys[i]) > 0.5);
      dys = next;
      if (follow && moved) {
        nav.setAttribute("data-follow", "");
        requestAnimationFrame(() =>
          requestAnimationFrame(() => nav.removeAttribute("data-follow")),
        );
      }
      links.forEach((a, i) => (a.style.transform = `translateY(${dys[i]}px)`));
    };

    // The dot sits 6px left of the active tick, or of its name when the rail is open.
    // The name's place is read from the page (the link's left plus the name's, both in
    // offsets, so the names' slide-in transform doesn't count) — it used to be worked out
    // as if the link were exactly as wide as its tick, true only from 1280: on an iPad
    // (1024–1279, and a touch screen, so it drags) the dot landed hundreds of px left of
    // the name and swung there and back at every tick (owner's video, 2 Oct 69)
    const target = (k: number): [number, number] => {
      const a = links[k];
      const tick = items[k].sub ? px("--tick-sub-on") : px("--tick-on");
      const label = a.querySelector<HTMLElement>("[data-label]");
      const nx = open && label ? a.offsetLeft + label.offsetLeft - 12 : nav.clientWidth - tick - 12;
      return [nx, a.offsetTop + dys[k] + a.offsetHeight / 2 - 3];
    };
    const place = (k: number, animate: boolean) => {
      links.forEach((a, i) => a.toggleAttribute("data-on", i === k));
      cur = k;
      const [nx, ny] = target(k);
      if (animate) {
        // Tablet: from where the dot is drawn right now, not where its last arc was
        // headed — a fast drag picks a new entry before the arc lands, and starting from
        // that arc's end made the dot jump there first, then swing back (iPad, 2 Oct 69)
        if (tablet()) {
          const now = new DOMMatrixReadOnly(getComputedStyle(dot).transform);
          x = now.m41;
          y = now.m42;
        }
        dot.getAnimations().forEach((q) => q.cancel());
        dot.animate(
          [
            { transform: `translate(${x}px, ${y}px)` },
            { transform: `translate(${Math.min(x, nx) - 12}px, ${(y + ny) / 2}px)`, offset: 0.5 },
            { transform: `translate(${nx}px, ${ny}px)` },
          ],
          { duration: 480, easing: "cubic-bezier(.3,.7,.2,1)" },
        );
      }
      dot.style.transform = `translate(${nx}px, ${ny}px)`;
      x = nx;
      y = ny;
    };
    // Opening moves the dot to the left of the names (a slide, not the arc)
    const slide = () => {
      if (cur < 0) return;
      [x, y] = target(cur);
      dot.style.transform = `translate(${x}px, ${y}px)`;
    };
    // Shut, the ticks and dot are drawn in difference, so over anything dark (a code
    // block, a photo) they turn light where they cross it (owner, 30 Sep 69). Open, the
    // names' white boxes would invert too, so the blend is off from the moment they
    // open until they've faded out. Colours swap in the same frame as the blend.
    let blendTimer = 0;
    const blend = (v: boolean) => {
      nav.setAttribute("data-snap", "");
      nav.toggleAttribute("data-blend", v);
      requestAnimationFrame(() => requestAnimationFrame(() => nav.removeAttribute("data-snap")));
    };
    // The ticks and the dot move together (0.36s); place the dot again once they've
    // settled, in case the names' widths changed
    let settle = 0;
    const setOpen = (v: boolean, at = cur < 0 ? 0 : cur) => {
      if (open === v) return;
      open = v;
      if (v) anchor = at;
      spread();
      clearTimeout(blendTimer);
      if (v) blend(false);
      else blendTimer = window.setTimeout(() => blend(true), 280);
      nav.toggleAttribute("data-open", v);
      requestAnimationFrame(slide);
      clearTimeout(settle);
      settle = window.setTimeout(slide, 400);
    };

    // An entry picked from the rail stays lit where it lands, even when the section is
    // too short for its heading to be the last one past the line (02.1 here) — until
    // the reader scrolls on
    let pin: { k: number; y: number | null } | null = null;
    const check = () => {
      if (pin) {
        if (pin.y === null || Math.abs(window.scrollY - pin.y) < 40) {
          if (pin.k !== cur) place(pin.k, cur >= 0);
          return;
        }
        pin = null;
      }
      const line = window.innerHeight * LINE;
      let k = 0;
      heads.forEach((h, i) => {
        if (h && h.getBoundingClientRect().top < line) k = i;
      });
      // At the very bottom the last section is being read, even when it's too short
      // for its heading ever to reach the line
      const el = document.documentElement;
      if (window.scrollY + window.innerHeight >= el.scrollHeight - 2) k = heads.length - 1;
      if (k !== cur) place(k, cur >= 0);
    };
    // Held mid-screen from the top of the post down (no upper limit — owner, 30 Sep 69;
    // for a while it started under Category · Published · Tags). With a mouse, no lower
    // than clears Previous | Next once the page reaches its end, where it would be
    // pushed up — held there, it never moves while it's being used. On a phone simply
    // mid-screen: the page below the article is so tall there that clearing it held the
    // rail near the top; End stops short instead (see topOf).
    const phone = window.matchMedia("(pointer: coarse)");
    const rail = nav.parentElement;
    const zone = rail?.parentElement;
    // Offsets, not drawn boxes: the header is still sliding in when this first runs
    const pageTop = (el: HTMLElement) => {
      let y = 0;
      for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
        y += e.offsetTop;
      }
      return y;
    };
    let heldAt = 0;
    // The dot's own layer lies exactly over the rail (same sticky top, same height,
    // pulled up over it), so the dot keeps the rail's coordinates
    const fitLayer = () => {
      const h = nav.offsetHeight;
      layer.style.top = nav.style.top;
      layer.style.height = `${h}px`;
      layer.style.marginTop = `${-h}px`;
    };
    // How far spreading from an end tick shifts the rail (see spread): room kept for it
    // on a phone, so the spread is never squeezed back in while a finger is on it
    let slack = 0;
    const centre = () => {
      const h = nav.offsetHeight;
      let top = window.innerHeight / 2 - h / 2;
      if (phone.matches) {
        const pitch = links.length > 1 ? links[1].offsetTop - links[0].offsetTop : 0;
        slack = Math.max(0, ((links.length - 1) / 2) * (pitch - px("--pitch-shut")));
      } else if (zone) {
        slack = 0;
        const below =
          document.documentElement.scrollHeight - (pageTop(zone) + zone.offsetHeight);
        const fit = window.innerHeight - below - h - px("--rail-end");
        top = Math.max(64, Math.min(top, fit));
      }
      nav.style.top = `${Math.round(top)}px`;
      heldAt = top;
      fitLayer();
    };
    centre();
    spread();
    // Fonts and lazy images change the header's and the article's heights
    const sizes = new ResizeObserver(() => {
      centre();
      spread();
    });
    if (zone) sizes.observe(zone);
    requestAnimationFrame(() => {
      check();
      dot.style.opacity = "1";
      nav.setAttribute("data-ready", ""); // the ticks ease from here on, not into place
    });

    // Where each entry takes the page: its heading (Title: the title) OFFSET below the top
    // of the screen — never the very top, where the rail isn't held mid-screen yet and
    // would slide out from under the pointer
    // Phones: never past the furthest the page can go with the rail still held mid-screen.
    // A short last section would otherwise take its heading to the top and the article's
    // end with it, pushing the rail up; it stops a little lower instead (owner, 2 Oct 69).
    // End goes exactly there — the rail's range ends --rail-end above Previous | Next.
    const topOf = (k: number) => {
      const h = heads[k];
      if (!h) return 0;
      const held =
        phone.matches && zone
          ? pageTop(zone) + zone.offsetHeight - px("--rail-end") - heldAt - nav.offsetHeight - slack
          : Infinity;
      if (items[k].id === "post-end" && held < Infinity) return Math.max(0, held);
      return Math.max(0, Math.min(held, h.getBoundingClientRect().top + window.scrollY - OFFSET));
    };
    // The ticks' heights are taken once, as a drag starts, where they'll be once
    // spread — not live. Live, they were still easing apart from 8px (a few px of finger
    // crossed the whole article), and at the end of the page sticky pushes the rail up
    // above the finger, which then read as "past the last tick" and stuck there (seen
    // on an iPhone, 30 Sep 69).
    let ticks: number[] = [];
    const holdTicks = () => {
      const top = nav.getBoundingClientRect().top;
      ticks = links.map((a, i) => top + a.offsetTop + dys[i] + a.offsetHeight / 2);
    };
    const held = (clientY: number) => {
      let k = 0;
      ticks.forEach((v, i) => {
        if (Math.abs(v - clientY) < Math.abs(ticks[k] - clientY)) k = i;
      });
      return k;
    };
    // A drag doesn't scrub the page through the article (by finger it crept along, and
    // on the desktop the owner wanted the same, 30 Sep 69): reaching a tick, the page
    // slides to that heading, as a click would. The tick the drag started on isn't a
    // choice (shut, they're 8px apart: a finger meaning 01 often lands on 02.1) — only
    // reaching another one is.
    let slid = -1;
    const startSlide = (y: number) => {
      holdTicks();
      slid = held(y);
    };
    // Tablet, by finger: the page glides only once the finger rests on an entry (DWELL), and
    // the finger's height is not read while the page moves, nor once just after: while
    // the page scrolls, iOS Safari reports touches up to ~300px off — clientY and
    // pageY − scrollY alike (WebKit bug 181954, open since 2018) — so sliding the page
    // under a moving finger chose headings back and forth (iPad logs, 2 Oct 69). Until
    // the page moves, the dot and the lit name follow the finger.
    let dwell = 0;
    let skipNext = false;
    const slideTo = (y: number, finger = false) => {
      if (finger && gliding) {
        skipNext = true;
        return;
      }
      if (finger && skipNext) {
        skipNext = false;
        return;
      }
      const k = held(y);
      if (k === slid) return;
      slid = k;
      if (!finger) {
        jump(k);
        return;
      }
      pin = { k, y: null };
      if (k !== cur) place(k, cur >= 0);
      clearTimeout(dwell);
      dwell = window.setTimeout(() => jump(k), DWELL);
    };
    // The finger lifts: the page goes to the last entry it chose
    const endSlide = () => {
      clearTimeout(dwell);
      jump(slid);
    };
    // The entry whose tick (and name) sits nearest a height on screen
    const nearest = (clientY: number) => {
      let best = 0;
      let dist = Infinity;
      links.forEach((a, i) => {
        const r = a.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - clientY);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      return best;
    };

    // Images between here and the heading load as the page glides past and push it
    // down, so once the glide has settled, check where the heading landed and go again
    // (up to a few times)
    let fix = 0;
    let gliding = false;
    const jump = (k: number, tries = 3) => {
      const h = heads[k];
      if (!h) return;
      pin = { k, y: null };
      gliding = true;
      if (k !== cur) place(k, cur >= 0);
      window.scrollTo({ top: topOf(k), behavior: "smooth" });
      if (tries === 3) onJumpRef.current?.(items[k].id);
      clearInterval(fix);
      let last = -1;
      fix = window.setInterval(() => {
        if (window.scrollY !== last) {
          last = window.scrollY;
          return;
        }
        clearInterval(fix);
        gliding = false;
        if (pin) pin.y = window.scrollY;
        // Off from where it should be (its heading at OFFSET, or the phone's cap)
        const off = window.scrollY - topOf(k);
        const atBottom =
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        if (Math.abs(off) > 4 && !atBottom && tries > 0) jump(k, tries - 1);
      }, 150);
    };

    // Mouse: hover opens the names, a click jumps, a drag slides heading to heading.
    // Touch: a tap opens the names, a tap on one jumps there; they fold after IDLE
    // untouched. A finger dragged along the rail slides as the mouse does (owner,
    // 30 Sep 69 — for a while it was taps only), so the rail doesn't scroll the page.
    let hoverTimer = 0;
    let idleTimer = 0;
    const armIdle = (ms = IDLE) => {
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(fold, ms);
    };
    let press: { y: number; id: number; dragging: boolean; target: EventTarget | null } | null =
      null;
    // The entry actually under the pointer (its tick or name), else the nearest by height
    const entryAt = (target: EventTarget | null, clientY: number) => {
      const a = target instanceof Element ? target.closest("a") : null;
      const i = a ? links.indexOf(a as HTMLAnchorElement) : -1;
      return i >= 0 ? i : nearest(clientY);
    };
    let hoverY = 0;
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hoverY = e.clientY;
      clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => setOpen(true, nearest(hoverY)), 110);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || press) return;
      clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => setOpen(false), 160);
    };
    // Fingers go through the touch handlers below (iOS Safari is dependable there)
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      press = { y: e.clientY, id: e.pointerId, dragging: false, target: e.target };
      clearTimeout(idleTimer);
      try {
        nav.setPointerCapture(e.pointerId); // keep the drag even off the rail
      } catch {
        // the pointer is already gone
      }
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      hoverY = e.clientY;
      if (!press || e.pointerId !== press.id) return;
      if (!press.dragging && Math.abs(e.clientY - press.y) < DRAG) return;
      if (!press.dragging) {
        press.dragging = true;
        nav.setAttribute("data-drag", "");
        clearTimeout(hoverTimer);
        setOpen(true, nearest(press.y));
        startSlide(press.y);
      }
      slideTo(e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const { dragging, target } = press;
      press = null;
      nav.removeAttribute("data-drag");
      // (A drag's slide settles the pin itself)
      if (!dragging) jump(entryAt(target, e.clientY)); // a click on a tick or a name
      if (!nav.matches(":hover")) {
        clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => setOpen(false), 160);
      }
    };
    const onCancel = () => {
      press = null;
      nav.removeAttribute("data-drag");
    };

    // Touch: a tap (moving under TAP_SLOP) opens the rail, or — open — jumps to the
    // entry under it. Moving further is a drag: it opens the names and slides.
    let touch: {
      id: number;
      y: number;
      wasOpen: boolean;
      target: EventTarget | null;
      dragging: boolean;
    } | null = null;
    // Opened by a finger: a touch anywhere else, or the page scrolling by any hand but
    // the rail's, folds it at once — nothing is jumped to (owner, 30 Sep 69)
    let byTouch = false;
    const fold = () => {
      byTouch = false;
      clearTimeout(idleTimer);
      setOpen(false);
    };
    const onTouchStart = (e: TouchEvent) => {
      touch =
        e.touches.length === 1
          ? {
              id: e.touches[0].identifier,
              y: e.touches[0].clientY,
              wasOpen: open,
              target: e.target,
              dragging: false,
            }
          : null;
      if (touch) clearTimeout(idleTimer);
      // iOS Safari ignores touch-action: none, and once it has started scrolling the
      // page a later preventDefault can't stop it — so the rail claims the finger
      // from the first touch (a tap is handled in touchend)
      if (touch && e.cancelable) e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return;
      if (e.cancelable) e.preventDefault(); // the finger is on the rail, not the page
      // The finger that started on the rail (e.touches lists every finger on the screen)
      const f = [...e.touches].find((q) => q.identifier === touch?.id);
      if (!f) return;
      const y = f.clientY;
      if (!touch.dragging && Math.abs(y - touch.y) <= TAP_SLOP) return;
      if (!touch.dragging) {
        touch.dragging = true;
        nav.setAttribute("data-drag", "");
        byTouch = true;
        setOpen(true, nearest(touch.y));
        startSlide(touch.y);
      }
      slideTo(y, tablet());
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touch) return;
      const t = touch;
      touch = null;
      e.preventDefault(); // no click after the tap
      if (t.dragging) {
        nav.removeAttribute("data-drag");
        if (tablet()) endSlide();
        armIdle(600); // the glide settles the pin itself
        return;
      }
      if (!t.wasOpen) {
        byTouch = true;
        // Scrolled on past the end, the rail has been pushed up off its height: opening
        // it also takes the page back to End, which brings the rail back mid-screen,
        // ready for the finger (owner, 30 Sep 69)
        const last = links.length - 1;
        if (heldAt - nav.getBoundingClientRect().top > 2) {
          setOpen(true, last);
          jump(last);
        } else setOpen(true, nearest(t.y));
        armIdle();
        return;
      }
      jump(entryAt(t.target, e.changedTouches[0].clientY));
      armIdle(600);
    };
    const onTouchCancel = () => {
      if (touch?.dragging) {
        nav.removeAttribute("data-drag");
        if (tablet()) endSlide();
        armIdle(600); // the glide settles the pin itself
      }
      touch = null;
    };
    // The tap that folds the rail does only that: the click it would make is dropped
    let swallow = 0;
    const onTouchOutside = (e: TouchEvent) => {
      if (!open || !byTouch || nav.contains(e.target as Node)) return;
      fold();
      swallow = e.timeStamp;
    };
    const onClickOutside = (e: MouseEvent) => {
      if (swallow && e.timeStamp - swallow < 800) {
        e.preventDefault();
        e.stopPropagation();
      }
      swallow = 0;
    };
    // Keyboard: the links work as links
    const onClick = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const i = links.indexOf(e.target as HTMLAnchorElement);
      if (i >= 0 && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        jump(i);
      }
    };

    let queued = 0;
    // (It once hid the page's scroll bar on phones while on screen, html[data-rail] —
    // iOS Safari never brought the bar back; globals.css, 6 Oct 69)
    const onScroll = () => {
      if (open && byTouch && !gliding && !touch?.dragging) fold();
      // Near either end of its range the rail may be pushed: the ticks keep to it
      // (not mid-drag: the finger is steering by where the ticks were when it started)
      if (!press?.dragging && !touch?.dragging) {
        spread(true);
        slide();
      }
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), check()));
    };
    phone.addEventListener("change", centre);
    const onResize = () => {
      centre();
      spread();
      slide();
      onScroll();
    };
    nav.addEventListener("pointerenter", onEnter);
    nav.addEventListener("pointerleave", onLeave);
    nav.addEventListener("pointerdown", onDown);
    nav.addEventListener("pointermove", onMove);
    nav.addEventListener("pointerup", onUp);
    nav.addEventListener("pointercancel", onCancel);
    nav.addEventListener("touchstart", onTouchStart, { passive: false });
    nav.addEventListener("touchmove", onTouchMove, { passive: false });
    nav.addEventListener("touchend", onTouchEnd, { passive: false });
    nav.addEventListener("touchcancel", onTouchCancel);
    nav.addEventListener("click", onClick);
    nav.addEventListener("keydown", onKey);
    document.addEventListener("touchstart", onTouchOutside, { capture: true, passive: true });
    document.addEventListener("click", onClickOutside, { capture: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      nav.removeEventListener("pointerenter", onEnter);
      nav.removeEventListener("pointerleave", onLeave);
      nav.removeEventListener("pointerdown", onDown);
      nav.removeEventListener("pointermove", onMove);
      nav.removeEventListener("pointerup", onUp);
      nav.removeEventListener("pointercancel", onCancel);
      nav.removeEventListener("touchstart", onTouchStart);
      nav.removeEventListener("touchmove", onTouchMove);
      nav.removeEventListener("touchend", onTouchEnd);
      nav.removeEventListener("touchcancel", onTouchCancel);
      nav.removeEventListener("click", onClick);
      nav.removeEventListener("keydown", onKey);
      document.removeEventListener("touchstart", onTouchOutside, { capture: true });
      document.removeEventListener("click", onClickOutside, { capture: true });
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      clearTimeout(hoverTimer);
      clearTimeout(idleTimer);
      clearTimeout(settle);
      clearTimeout(blendTimer);
      clearInterval(fix);
      clearTimeout(dwell);
      cancelAnimationFrame(queued);
      sizes.disconnect();
      phone.removeEventListener("change", centre);
    };
  }, [items]);

  if (items.length < (ends ? 2 : 1)) return <aside ref={navRef} hidden />;
  return (
    <aside className={styles.rail} aria-label="Contents">
      <nav ref={navRef} className={styles.toc} data-blend>
        {items.map((it) => (
          <a key={it.id} href={`#${it.id}`} data-sub={it.sub || undefined} draggable={false}>
            <span className={styles.tocLabel} data-label>
              {it.label}
            </span>
            <span className={styles.tick} aria-hidden="true" />
          </a>
        ))}
      </nav>
      {/* The dot on a layer of its own, always in difference: open, the rail's blend
          is off for the names' white boxes, and the dot crossing a code block stayed
          black on black (owner, 30 Sep 69) */}
      <div ref={layerRef} className={styles.tocDots} aria-hidden="true">
        <span ref={dotRef} className={styles.tocDot} />
      </div>
    </aside>
  );
}
