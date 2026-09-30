import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import styles from "@/components/login/Login.module.css";
import LoginForm from "@/components/login/LoginForm";
import RevealObserver from "@/components/RevealObserver";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin access · Code by Korn Natthanat",
  robots: { index: false, follow: false },
};

// Where to go once signed in: only an /admin page (never another site)
const safeNext = (next: string | string[] | undefined) =>
  typeof next === "string" && /^\/admin(\/[\w\-/]*)?$/.test(next) ? next : "/admin";

// 05 Login (TOTP): one code from the authenticator app, no password
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await currentSession()) redirect(next);

  const walkthrough = (
    <span className={styles.note}>
      Not the admin?{" "}
      <a className={styles.walk} href="#" target="_blank" rel="noopener">
        Watch how this site{" "}
        {/* The arrow never wraps onto a line of its own */}
        <span className={styles.keep}>
          works{" "}
          <svg viewBox="0 0 20 20" width="0.75em" height="0.75em" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" d="M1 19 18.5 1.5M10.5 1.5h8v8" />
          </svg>
        </span>
      </a>{" "}
      — a short video walkthrough on YouTube.
    </span>
  );

  return (
    <div className={styles.page}>
      <Header>
        <span className={`label ${styles.access}`}>Admin access</span>
      </Header>
      <main className={styles.main}>
        <div className={styles.box}>
          <div data-reveal>
            <h1 className={styles.title}>Enter your code</h1>
            <p className={styles.lead}>Admin only.</p>
          </div>
          <LoginForm next={next} aside={walkthrough} />
        </div>
      </main>
      <p className={styles.foot}>{walkthrough}</p>
      <RevealObserver />
    </div>
  );
}
