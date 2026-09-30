import TransitionLink from "../TransitionLink";
import Dots404 from "./Dots404";
import styles from "./NotFound.module.css";

const links = [
  { text: "Back to Blog", href: "/" },
  { text: "Projects", href: "/project" },
  { text: "About", href: "/about" },
];

// 10 · Not found: "404" in moving dots, a line of explanation, and three ways back
export default function NotFound() {
  return (
    <main>
      <Dots404 />
      <div className={styles.body}>
        <h1 className={styles.title}>This page isn’t here. It may have moved, or never existed.</h1>
        <div className={styles.try}>
          <span className="label">Try instead</span>
          <nav className={styles.links} aria-label="Try instead">
            {links.map((link) => (
              <TransitionLink key={link.href} href={link.href} className={styles.link}>
                {link.text}
              </TransitionLink>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
