"use client";

import { useEffect } from "react";

// v4 _jump, with the values from v4's tuning panel (★ HERO SWAY ★ / ★ HERO BOUNCE ★)
const PULL = 1; // heroPull: how far the letter under the pointer follows it
const FOLLOW = 0.11; // swayFollow: spring pull per frame
const DAMP = 0.8;
const IDLE_MS = 8000; // idleSec: still this long, and the letters start to breathe
const SWAY_SPEED = 6;
const SWAY_Y = 1.6;
const SWAY_X = 0;
const SWAY_WAVE = 0.42; // phase step from one letter to the next
const EVERY_MS = 60_000; // bounceEvery: the whole headline jumps once a minute
const STAGGER_MS = 70;
// v4's scroll "wind" is switched off in its panel, so it isn't ported

type Letter = {
  el: HTMLElement;
  i: number; // order on the page, for the sway's travelling phase
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  vr: number;
  w: number; // how much the pointer has hold of it, eased 0 → 1
  inside: boolean;
  kick: number;
  rest: boolean;
  skip: boolean;
  // measured once per width
  pw: number;
  ox: number;
  oy: number;
  hw: number;
  hh: number;
  // this frame
  s: number;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  d: number;
};

// Headline letters (JumpText) that the pointer can pick up: the one under it leans after
// it and, let go, springs up and settles. Left alone for 8 seconds they sway in a slow
// travelling wave; once a minute the whole headline jumps, line by line, and the
// category dot answers with a hop. No motion at all under prefers-reduced-motion.
export default function JumpMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters: Letter[] = [];
    const known = new WeakSet<Element>();
    const scan = () => {
      for (let k = letters.length - 1; k >= 0; k--) {
        if (!letters[k].el.isConnected) letters.splice(k, 1);
      }
      document.querySelectorAll<HTMLElement>("[data-jump]").forEach((el) => {
        if (known.has(el)) return;
        known.add(el);
        letters.push({
          el, i: 0, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, w: 0, inside: false, kick: 0,
          rest: true, skip: false, pw: -1, ox: 0, oy: 0, hw: 0, hh: 0, s: 1, cx: 0, cy: 0,
          dx: 0, dy: 0, d: 0,
        });
      });
      letters.forEach((p, k) => (p.i = k));
      wake();
    };

    const m = { x: -1e4, y: -1e4, lx: NaN, ly: NaN, vx: 0, vy: 0, env: 0, lt: 0 };
    let lastAct = performance.now();
    let loop = 0;
    let boxes: DOMRect[] | null = null;
    const wake = () => {
      if (!loop) {
        m.lx = NaN;
        m.lt = 0;
        loop = requestAnimationFrame(step);
      }
    };

    const step = () => {
      loop = 0;
      if (document.hidden) {
        document.addEventListener("visibilitychange", wake, { once: true });
        return;
      }
      let busy = false;
      const now = performance.now();
      // 1 = one 60fps frame, so a dropped or fast frame keeps the same real-time motion
      const dt = m.lt ? Math.min(3, Math.max(0.25, (now - m.lt) / 16.667)) : 1;
      m.lt = now;
      // Idle breath: fades in slowly once idle, drops out quickly on any input
      const idle = now - lastAct > IDLE_MS;
      const envT = idle ? 1 : 0;
      m.env += (envT - m.env) * (1 - Math.pow(envT ? 0.975 : 0.8, dt));
      if (m.env < 0.001 && !envT) m.env = 0;
      // The pointer's own velocity, smoothed
      if (Number.isNaN(m.lx)) {
        m.lx = m.x;
        m.ly = m.y;
      }
      let fx = m.x - m.lx;
      let fy = m.y - m.ly;
      if (Math.abs(fx) > 200 || Math.abs(fy) > 200) fx = fy = 0;
      m.lx = m.x;
      m.ly = m.y;
      m.vx += (fx - m.vx) * 0.25;
      m.vy += (fy - m.vy) * 0.25;
      const spd = Math.hypot(m.vx, m.vy);

      // Where each letter's resting centre is on screen (its word's box + its offset in it)
      const rects = new Map<Element, DOMRect>();
      for (const p of letters) {
        const par = p.el.parentElement;
        if (!par) {
          p.skip = true;
          continue;
        }
        if (!rects.has(par)) rects.set(par, par.getBoundingClientRect());
        const pr = rects.get(par)!;
        p.skip = pr.bottom < -200 || pr.top > window.innerHeight + 200;
        if (p.skip) {
          if (!p.rest) {
            p.x = p.y = p.r = p.vx = p.vy = p.vr = p.w = 0;
            p.inside = false;
            p.rest = true;
            p.el.style.transform = "";
          }
          continue;
        }
        if (p.pw !== par.offsetWidth) {
          p.pw = par.offsetWidth;
          const own = p.el.offsetParent === par;
          p.ox = p.el.offsetLeft - (own ? 0 : par.offsetLeft) + p.el.offsetWidth / 2;
          p.oy = p.el.offsetTop - (own ? 0 : par.offsetTop) + p.el.offsetHeight / 2;
          p.hw = p.el.offsetWidth / 2 + 3;
          p.hh = p.el.offsetHeight * 0.36;
        }
        p.s = pr.width / (par.offsetWidth || 1) || 1;
        p.cx = pr.left + p.ox * p.s;
        p.cy = pr.top + p.oy * p.s;
      }

      // The one letter the pointer is over (nearest, if two overlap)
      let near: Letter | null = null;
      let nd = 1e9;
      for (const p of letters) {
        if (p.skip) continue;
        p.dx = (m.x - p.cx) / p.s;
        p.dy = (m.y - p.cy) / p.s;
        p.d = Math.hypot(p.dx, p.dy);
        if (Math.abs(p.dx) < p.hw && Math.abs(p.dy) < p.hh && p.d < nd) {
          nd = p.d;
          near = p;
        }
      }
      if (near) busy = true;

      for (const p of letters) {
        if (p.skip) continue;
        const { s, dx, dy, d } = p;
        let tx = 0;
        let ty = 0;
        if (m.env > 0) {
          const ph = (now / 1000) * SWAY_SPEED - p.i * SWAY_WAVE;
          ty += Math.sin(ph) * SWAY_Y * m.env;
          tx += Math.cos(ph * 0.63) * SWAY_X * m.env;
          busy = true;
        }
        const inside = p === near;
        // Let go: a kick upward, harder the faster the pointer left
        if (p.inside && !inside && now - p.kick > 500) {
          const k = 0.45 + Math.min(1, spd / 10) * 0.55;
          p.vy -= 7 * k;
          p.vr -= 3 * k;
          p.kick = now;
        }
        p.inside = inside;
        p.w += ((inside ? 1 : 0) - p.w) * (1 - Math.pow(0.86, dt));
        const reach = Math.max(p.hw, p.hh) * 1.5;
        if (p.w > 0.001 && d < reach) {
          const ff = Math.max(0, 1 - d / reach) * p.w;
          tx = dx * PULL * ff;
          ty = dy * PULL * ff;
        }
        if (inside) {
          const f = Math.max(0, 1 - d / reach);
          p.vx += (m.vx * 0.09 * f) / s;
          p.vy += (m.vy * 0.09 * f) / s;
          p.vr += (m.vx * 0.05 * f) / s;
        }
        const dd = Math.pow(DAMP, dt);
        p.vx = (p.vx + (tx - p.x) * FOLLOW * dt) * dd;
        p.vy = (p.vy + (ty - p.y) * FOLLOW * dt) * dd;
        p.vr = (p.vr + (tx * 0.12 - p.r) * FOLLOW * dt) * dd;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        const still =
          Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.r) + Math.abs(p.vr) <
          0.005;
        if (!still || p.w > 0.001) busy = true;
        if (still) {
          if (p.rest) continue;
          p.x = p.y = p.r = p.vx = p.vy = p.vr = 0;
          p.rest = true;
          p.el.style.transform = "";
          continue;
        }
        p.rest = false;
        p.el.style.transform = `translate3d(${p.x.toFixed(3)}px, ${p.y.toFixed(3)}px, 0) rotate(${p.r.toFixed(3)}deg)`;
      }
      boxes = [...rects.values()];
      if (busy && !loop) loop = requestAnimationFrame(step);
    };

    // The pointer only wakes the loop near a headline
    const onMove = (e: PointerEvent) => {
      m.x = e.clientX;
      m.y = e.clientY;
      if (
        loop ||
        !boxes ||
        boxes.some((b) => m.x > b.left - 60 && m.x < b.right + 60 && m.y > b.top - 60 && m.y < b.bottom + 60)
      ) {
        wake();
      }
    };
    // A finger lifting leaves nothing behind to hold a letter (a mouse stays where it is)
    const onUp = (e: PointerEvent) => {
      boxes = null;
      if (e.pointerType !== "mouse") m.x = m.y = -1e4;
    };
    const forget = () => (boxes = null);
    const act = () => (lastAct = performance.now());
    const onScroll = () => {
      act();
      wake();
    };
    // Past the idle wait, start the loop for the sway
    const idleTimer = window.setInterval(() => {
      if (performance.now() - lastAct > IDLE_MS) wake();
    }, 500);

    // Once a minute: every letter jumps, each visual line from its first letter
    // (a run with data-jump-lead waits that many letters), then the category dot hops
    const order = (p: Letter) => {
      const group = p.el.closest<HTMLElement>("[data-jump-group]");
      if (!group) return 0;
      const lead = Number(group.dataset.jumpLead ?? 0);
      const line = [...group.querySelectorAll<HTMLElement>("[data-jump]")].filter(
        (o) => Math.abs(o.offsetTop - p.el.offsetTop) < 4,
      );
      return lead + line.indexOf(p.el);
    };
    const timers: number[] = [];
    const fire = () => {
      if (document.hidden || !letters.length) return;
      timers.length = 0; // last minute's have all run
      let last = 0;
      for (const p of letters) {
        const n = order(p);
        last = Math.max(last, n);
        timers.push(
          window.setTimeout(() => {
            p.vy -= 7;
            p.vr -= 3;
            p.rest = false;
            wake();
          }, n * STAGGER_MS),
        );
      }
      timers.push(
        window.setTimeout(() => {
          document.querySelectorAll("[data-dot-hop]").forEach((g) => g.dispatchEvent(new Event("dothop")));
        }, last * STAGGER_MS + 380),
      );
    };
    const minute = window.setInterval(fire, EVERY_MS);

    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    scan();
    const first = window.setTimeout(wake, 600);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true, capture: true });
    window.addEventListener("pointercancel", onUp, { passive: true, capture: true });
    for (const ev of ["wheel", "resize", "keydown"]) {
      window.addEventListener(ev, forget, { passive: true, capture: true });
    }
    for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) {
      window.addEventListener(ev, act, { passive: true, capture: true });
    }
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      mutations.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      for (const ev of ["wheel", "resize", "keydown"]) {
        window.removeEventListener(ev, forget, { capture: true });
      }
      for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) {
        window.removeEventListener(ev, act, { capture: true });
      }
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("visibilitychange", wake);
      window.clearInterval(idleTimer);
      window.clearInterval(minute);
      window.clearTimeout(first);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(loop);
      letters.forEach((p) => (p.el.style.transform = ""));
    };
  }, []);

  return null;
}
