"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Footer.module.css";

const groups = [
  {
    label: "Contact",
    links: [
      { text: "natthanataa@gmail.com", href: "mailto:natthanataa@gmail.com" },
      { text: "+66 86 834 6007", href: "tel:+66868346007" },
    ],
  },
  {
    label: "Social",
    inline: true,
    links: [
      { text: "LinkedIn", href: "#" },
      { text: "GitHub", href: "https://github.com/PotterWinter" },
      { text: "Behance", href: "https://www.behance.net/korn-natthanat" },
    ],
  },
  {
    label: "Résumé",
    links: [{ text: "Download CV (PDF)", href: "#" }],
  },
];

export default function Footer() {
  // About has its own, fuller contact section: the groups would only repeat it
  const withGroups = usePathname() !== "/about";
  return (
    <footer>
      {withGroups && (
        <div className={styles.groups}>
          {groups.map((group) => (
            <div key={group.label} className={styles.group}>
              <div className="label">{group.label}</div>
              <div className={`${styles.links} ${group.inline ? styles.inline : ""}`}>
                {group.links.map((link) => (
                  <a key={link.text} href={link.href}>
                    {link.text}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles.bottom}>
        <span className={styles.name}>Korn Natthanat</span>
        <Link href="/login" className={`${styles.dotLink} ${styles.muted}`}>
          ADMIN LOGIN
        </Link>
        <a href="#" className={styles.dotLink}>
          BACK TO TOP
        </a>
      </div>
    </footer>
  );
}
