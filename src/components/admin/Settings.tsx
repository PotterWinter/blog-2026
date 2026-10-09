"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { clearAllCache, signOutDevice, signOutOthers, type Done } from "@/app/admin/actions";
import { longDate } from "@/lib/format";
import { perPageChoices, postsPerPage } from "@/lib/site";
import HomeIntro from "../home/HomeIntro";
import type { LoginEvent, Session } from "@/lib/session";
import type { RepoHead } from "./Hub";
import styles from "./Admin.module.css";
import s from "./Settings.module.css";

type Category = { slug: string; label: string; posts: number };
type Device = Omit<Session, "id"> & { handle: string; mine: boolean };

const SECTIONS = [
  { id: "site", label: "Site" },
  { id: "categories", label: "Categories" },
  { id: "checks", label: "Checks" },
  { id: "repository", label: "Repository" },
  { id: "security", label: "Security" },
  { id: "maintenance", label: "Maintenance" },
];
const pad2 = (n: number) => String(n).padStart(2, "0");

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
// "2026-10-05T07:16:21Z" → "5 Oct 2026 · 14:16" (Bangkok, as the rest of the admin)
const stamp = (iso: string) => {
  const t = new Date(Date.parse(iso) + 7 * 3600 * 1000).toISOString();
  return `${longDate(t.slice(0, 10))} · ${t.slice(11, 16)}`;
};
// ::1 / 127.0.0.1 = next dev on this machine
const address = (ip: string) => (ip === "::1" || ip === "127.0.0.1" ? "this machine" : ip.replace(/^::ffff:/, ""));
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// Which sign-ins these are: each place keeps its own in Redis (dev: / preview: / prod:)
type Env = "live" | "preview" | "local";
const ON: Record<Env, string> = { live: "on the live site", preview: "on previews", local: "on localhost" };

// The Firewall rule (Vercel): 5 tries at /api/login in 10 minutes per IP, then 429 —
// those never reach the app, so a lock-out shows as 5 wrong codes from one IP within
// 10 minutes. The IPs that got there, newest first.
const LIMIT = 5;
const WINDOW = 10 * 60 * 1000;
const lockedOut = (missed: LoginEvent[]) => {
  const byIp = new Map<string, number[]>();
  for (const m of missed) if (m.ip) byIp.set(m.ip, [...(byIp.get(m.ip) ?? []), Date.parse(m.at)]);
  return [...byIp].filter(([, times]) => times.some((t, i) => i + LIMIT - 1 < times.length && t - times[i + LIMIT - 1] <= WINDOW)).map(([ip]) => ip);
};

// 09 Settings (v4), 5.5a: Site · Categories · Checks · Repository · Security ·
// zone down the page, a rail of them at the left with the dot on the one in view (a
// strip of tabs under the header below 1024). Site, Categories and Checks show what's
// set — they become editable in 5.5b, kept in site.json in the content repo. Security
// lists the devices signed in, one row each (another can be signed out, or all the
// others), and the wrong codes of the week; Maintenance clears the cache.
export default function Settings({
  categories,
  limits,
  code,
  content,
  local,
  sessions,
  missed,
  env,
}: {
  categories: Category[];
  limits: { imageKb: number; clipMb: number };
  code: { repo: string; branch: string; sha: string } | null;
  content: RepoHead;
  local: boolean;
  sessions: Device[];
  missed: LoginEvent[];
  env: Env;
}) {
  const rootRef = useRef<HTMLElement>(null);

  // Sticky under the header, however tall it's drawn (one row on a computer, two on a
  // phone): its height, measured
  useEffect(() => {
    const root = rootRef.current;
    const header = document.querySelector("header");
    if (!root || !header) return;
    const set = () => root.style.setProperty("--head", `${header.getBoundingClientRect().height}px`);
    set();
    const seen = new ResizeObserver(set);
    seen.observe(header);
    return () => seen.disconnect();
  }, []);

  // The section in view, as the post's contents rail decides it: the last whose top has
  // passed a line 35% down the screen — the dot moves once the section has arrived. At
  // the very end, the last, however short.
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const pick = () => {
      const line = window.innerHeight * 0.35;
      let at = 0;
      SECTIONS.forEach(({ id }, i) => {
        const el = document.getElementById(`set-${id}`);
        if (el && el.getBoundingClientRect().top < line) at = i;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) at = SECTIONS.length - 1;
      setPos(at);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, []);

  return (
    <main ref={rootRef} className={`${styles.hub} ${s.page}`}>
      <div className={`${styles.top} ${s.top}`}>
        <h1 className={styles.title}>Settings</h1>
        <span className={s.note}>Site, categories and checks become editable next · kept in site.json</span>
      </div>

      <div className={s.layout}>
        <Rail pos={pos} />

        <div className={s.sections}>
          <Section n={1} id="site" title="Site" aside="What readers see">
            <Row label="Site name" hint="Part of the logo · changed in code">
              <span className={s.value}>Code by Korn Natthanat</span>
              <ReadOnly />
            </Row>
            <Row label="Description" hint="The serif line beside the hero on the home page">
              <span className={s.quote}>
                <HomeIntro />
              </span>
              <ReadOnly />
            </Row>
            <Row label="Posts per page" hint="Home · grid and list · fills 2 or 3 columns">
              <span className={s.choices}>
                {perPageChoices.map((n) => (
                  <span key={n} className={s.choice} data-on={n === postsPerPage || undefined}>
                    {n}
                  </span>
                ))}
              </span>
              <ReadOnly />
            </Row>
          </Section>

          <Section n={2} id="categories" title="Categories" aside="Blog's four, Project's two">
            <div className={s.catHead}>
              <span className="label">Name</span>
              <span className="label">Slug</span>
              <span className="label">Posts</span>
            </div>
            {categories.map((c) => (
              <div key={c.slug} className={s.catRow}>
                <span>{c.label}</span>
                <span className={s.at}>{c.slug}</span>
                <span className={s.mono}>{pad2(c.posts)}</span>
              </div>
            ))}
          </Section>

          <Section n={3} id="checks" title="Checks" aside="Run as you write · Publish isn't held back">
            {[
              ["Cover", "Post has a cover image"],
              ["Excerpt", "Short summary under the title"],
              ["Alt text", "Every image has a description"],
              ["Links", "All links open without 404", "other sites: asked once you stop typing"],
              ["Files", "Every image and clip referenced exists"],
              ["Image size", "Per image", `${limits.imageKb} KB`],
              ["Video size", "Per clip", `${limits.clipMb} MB`],
              ["TODO", "No TODO or TK left in the text"],
            ].map(([label, hint, extra]) => (
              <Row key={label} label={label} hint={hint}>
                <span className={s.on}>On</span>
                {extra && <span className={s.extra}>{extra}</span>}
              </Row>
            ))}
          </Section>

          <Section n={4} id="repository" title="Repository" aside="Where code and posts live">
            <Row label="Code">
              {code ? <Repo repo={code.repo} at={`${code.branch} · ${code.sha}`} /> : <Repo repo="this folder" at="next dev" />}
            </Row>
            <Row label="Content">
              {content ? (
                <Repo repo={content.repo} at={`${content.branch} · ${content.sha} · ${ago(content.date)}`} />
              ) : (
                <Repo repo={local ? "fixtures/content" : "content repo"} at={local ? "local folder" : "not answering"} off={!local} />
              )}
            </Row>
            <Row label="Deploy on push" hint="Vercel builds every push to main · a save on the site shows at once">
              <span className={s.on}>On</span>
              <ReadOnly />
            </Row>
          </Section>

          <Security sessions={sessions} missed={missed} env={env} />

          <Section n={6} id="maintenance" title="Maintenance" aside="When the site shows something old">
            <div className={s.maintenance}>
              <Action
                label="Clear cache"
                hint="Every page and image read from the content repo again · the next visits are slower"
                button="Clear cache"
                run={clearAllCache}
              />
            </div>
          </Section>
        </div>
      </div>

      <footer className={styles.term}>
        <span>{content?.repo ?? "fixtures/content · local"}</span>
        {content && (
          <span className={styles.termDim}>
            {content.branch} · {content.sha}
          </span>
        )}
        {code && <span className={styles.termDim}>site {code.sha}</span>}
      </footer>
    </main>
  );
}

// The rail (v4): 01 Site … 06 Maintenance, the dot at the section in view, gliding on
// as the next one arrives (as the post's contents rail); a press scrolls there. Below
// 1024 a strip of tabs, sideways, the one in view in ink.
function Rail({ pos }: { pos: number }) {
  const navRef = useRef<HTMLElement>(null);
  const active = SECTIONS[pos].id;
  // Each item's middle, measured, for the dot to sit beside
  const [mids, setMids] = useState<number[]>([]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () =>
      setMids(SECTIONS.map(({ id }) => {
        const item = nav.querySelector<HTMLElement>(`[data-id="${id}"]`);
        return item ? item.offsetTop + item.offsetHeight / 2 : 0;
      }));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  // The strip scrolls the tab in view into sight — itself only, sideways: scrollIntoView
  // moved the page too, and broke off the glide to the section just pressed
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!nav || !item || nav.scrollWidth <= nav.clientWidth) return;
    const left = item.offsetLeft - nav.clientWidth / 2 + item.offsetWidth / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);
  const y = mids.length ? mids[pos] : null;
  return (
    <nav ref={navRef} className={s.rail} aria-label="Settings sections">
      {y !== null && <span className={s.dot} style={{ transform: `translateY(${y}px)` }} aria-hidden="true" />}
      {SECTIONS.map((sec, i) => (
        <a
          key={sec.id}
          href={`#set-${sec.id}`}
          data-id={sec.id}
          className={s.railItem}
          aria-current={sec.id === active || undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(`set-${sec.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <span className={s.mono}>{pad2(i + 1)}</span>
          {sec.label}
        </a>
      ))}
    </nav>
  );
}

function Section({ n, id, title, aside, children }: { n: number; id: string; title: string; aside: string; children: ReactNode }) {
  return (
    <section id={`set-${id}`} className={s.section}>
      <div className={s.sectionHead}>
        <span className={s.mono}>{pad2(n)}</span>
        <h2 className={s.h2}>{title}</h2>
        <span className={s.aside}>{aside}</span>
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <div className={s.rowLabel}>
        <span>{label}</span>
        {hint && <span className={s.hint}>{hint}</span>}
      </div>
      <div className={s.rowValue}>{children}</div>
    </div>
  );
}

const ReadOnly = () => <span className={`label ${s.readOnly}`}>Read only</span>;

function Repo({ repo, at, off = false }: { repo: string; at: string; off?: boolean }) {
  return (
    <>
      <span className={s.mono}>{repo}</span>
      <span className={s.at}>{at}</span>
      <span className={s.link} data-off={off || undefined}>
        {off ? "Not connected" : "Connected"}
      </span>
    </>
  );
}

// A row with a button that runs a server action (Maintenance)
function Action({ label, hint, button, run }: { label: string; hint: string; button: string; run: () => Promise<Done> }) {
  return (
    <div className={s.action}>
      <div className={s.rowLabel}>
        <span>{label}</span>
        <span className={s.hint}>{hint}</span>
      </div>
      <RunButton button={button} run={run} red />
    </div>
  );
}

// The button itself: says what came of it beside it, and reloads the page's data after
// (the devices list)
function RunButton({ button, run, red = false }: { button: string; run: () => Promise<Done>; red?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ text: string; bad: boolean } | null>(null);
  return (
    <div className={s.actionEnd}>
      <button
        type="button"
        className={styles.btnl}
        data-red={red || undefined}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const done = await run();
            setSaid(done.ok ? { text: done.note ?? "Done", bad: false } : { text: done.error, bad: true });
            router.refresh();
          })
        }
      >
        {pending ? "Working…" : button}
      </button>
      {said && (
        <span className={s.said} data-bad={said.bad || undefined}>
          {said.text}
        </span>
      )}
    </div>
  );
}

// 05 Security: the authenticator, and the devices signed in — one row each, this one
// marked, any other signed out from here — with, under them, the codes that didn't get
// in this week (the full history stays in Redis for a dashboard)
function Security({ sessions, missed, env }: { sessions: Device[]; missed: LoginEvent[]; env: Env }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<string | null>(null);
  const others = sessions.filter((d) => !d.mine).length;
  const out = (handle: string) =>
    start(async () => {
      setGone(handle);
      await signOutDevice(handle);
      router.refresh();
    });
  const last = missed[0];
  const locked = env === "local" ? [] : lockedOut(missed);
  // No IP location on localhost: "dev" where the city goes
  const city = (c: string) => c || (env === "local" ? "dev" : "");
  return (
    <Section n={5} id="security" title="Security" aside="One admin, one authenticator">
      <Row label="Authenticator" hint="TOTP · a code from the app, once each">
        <span className={s.value}>Enabled</span>
        <ReadOnly />
      </Row>
      <Row label="Rate limit" hint="Vercel Firewall · per IP">
        <span className={s.value}>{env === "local" ? "Off on localhost" : `${LIMIT} tries in 10 min, then locked out`}</span>
        <ReadOnly />
      </Row>
      <Row label="Sessions" hint={`${plural(sessions.length, "device")} signed in ${ON[env]} · 30 days each`}>
        <div className={s.devices}>
          {sessions.map((d) => (
            <div key={d.handle} className={s.device} data-gone={(pending && gone === d.handle) || undefined}>
              <span>{d.device}</span>
              <span className={s.at}>
                {[address(d.ip), city(d.city)].filter(Boolean).join(" · ") || "—"} · signed in {ago(d.createdAt)}
              </span>
              {d.mine ? (
                <span className={`label ${s.mine}`}>This device</span>
              ) : (
                <button type="button" className={s.signOut} disabled={pending} onClick={() => out(d.handle)}>
                  Sign out
                </button>
              )}
            </div>
          ))}
          <div className={s.device}>
            {others ? (
              <RunButton button={`Sign out all other devices (${others})`} run={signOutOthers} />
            ) : (
              <span className={s.at}>No other device signed in</span>
            )}
          </div>
          <div className={s.device}>
            {last ? (
              <span className={s.missed}>
                {plural(missed.length, "wrong code")} in the last 7 days · last {stamp(last.at)}
                {last.ip ? ` from ${address(last.ip)}` : ""}
                {city(last.city) ? `, ${city(last.city)}` : ""}
                {locked.length ? ` · locked out: ${locked.map(address).join(", ")}` : ""}
              </span>
            ) : (
              <span className={s.at}>No wrong codes in the last 7 days</span>
            )}
          </div>
        </div>
      </Row>
    </Section>
  );
}
