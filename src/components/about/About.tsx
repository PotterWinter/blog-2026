import Image from "next/image";
import type { ReactNode } from "react";
import BangkokClock from "./BangkokClock";
import CursorBadge from "./CursorBadge";
import styles from "./About.module.css";

const timeline = [
  {
    when: "Apr 2025 – Jul 2026",
    role: "Java developer, core banking",
    where: "Silverlake Structure Services",
  },
  { when: "Sep 2024 – Jan 2025", role: "Full-stack bootcamp", where: "TECH UP" },
  { when: "Aug 2023 – Feb 2024", role: "Brand designer", where: "Freelance · Bangkok" },
  { when: "Apr 2021 – Jul 2022", role: "Packaging designer", where: "SCG Packaging" },
  {
    when: "Jan 2018 – Jan 2022",
    role: "B.Arch, industrial & automotive design",
    where: "KMITL · GPA 3.01",
  },
];

const stack = [
  { group: "Frontend", items: ["Next.js", "React", "TypeScript", "Tailwind"] },
  { group: "Backend", items: ["Java", "Spring Boot", "Node", "REST APIs"] },
  { group: "Data", items: ["PostgreSQL", "MySQL", "Jaspersoft", "SQL reports"] },
  { group: "Tools", items: ["Git", "Docker", "Postman", "Figma"] },
];

const now = [
  {
    label: "Preparing",
    text: "A master’s application in software architecture and system design — reading, portfolio, and the entrance exam.",
  },
  {
    label: "Learning",
    text: "Cybersecurity — building systems trustworthy enough to hold AI-driven tooling.",
  },
  { label: "Writing", text: "Roughly one post a week — whatever took longest to get right." },
];

const elsewhere = [
  { text: "GitHub", href: "https://github.com/PotterWinter" },
  { text: "Behance", href: "#" },
  { text: "LinkedIn", href: "#" },
];

// Long arrows from v4: down (a download) and out (leaves the page)
const ArrowDown = () => (
  <svg
    viewBox="0 0 14 26"
    width="0.55em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="square"
    aria-hidden="true"
  >
    <path vectorEffect="non-scaling-stroke" d="M7 0v24M1.5 19 7 25l5.5-6" />
  </svg>
);
const ArrowOut = ({ size = "0.75em" }: { size?: string }) => (
  <svg
    viewBox="0 0 20 20"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="square"
    aria-hidden="true"
  >
    <path vectorEffect="non-scaling-stroke" d="M1 19 18.5 1.5M10.5 1.5h8v8" />
  </svg>
);

// A labelled band: the label in the left column (above it on phones), content right
function Band({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.band} ${className ?? ""}`} data-reveal>
      <h2 className={`label ${styles.bandLabel}`}>{label}</h2>
      <div>{children}</div>
    </section>
  );
}

// 03 About (v4): a headline, background beside the portrait, then timeline, stack,
// what I'm on right now, the open-for-work note and the ways to get in touch.
export default function About() {
  return (
    <main>
      <div className={styles.hero}>
        <h1 className={styles.headline} data-reveal>
          I learned to build things
          <br />
          before I learned to build software.
        </h1>
      </div>

      <div className={styles.background}>
        <div className={`label ${styles.backgroundLabel}`} data-reveal>
          Background
          {/* One line below 1024 ("Background · Bangkok, Thailand"), two from 1024 */}
          <span className={styles.sep}> · </span>
          <br className={styles.brk} />
          Bangkok, Thailand
        </div>
        <div className={styles.story} data-reveal data-d="140">
          <p className={styles.lead}>
            Industrial design came first. Four years at KMITL taught me to look at how things are
            assembled, why they work, and what happens when the pieces don’t fit.
          </p>
          <p className={styles.lead}>
            Software became a different kind of design problem. Instead of materials and mechanisms,
            the pieces became APIs, databases, services, networks, and infrastructure.
          </p>
          <p className={styles.text}>
            Today I’m interested in the layer between software and infrastructure — building systems
            that are reliable, observable, secure, and understandable.
          </p>
          <p className={styles.text}>
            I work on enterprise software in banking, mostly around Java, Spring Boot, Angular, data
            migration, and reporting systems. Outside work I build small systems to understand how
            software actually gets deployed and operated — from Git to containers, cloud
            infrastructure, CI/CD, and security.
          </p>
        </div>
        <figure className={styles.portrait} data-reveal data-d="220">
          <div className={styles.mask}>
            <Image
              src="/about/portrait.webp"
              alt="Natthanat Chuayriang"
              fill
              sizes="(min-width: 1280px) 300px, (min-width: 1024px) 260px, 240px"
              className={styles.photo}
              priority
            />
          </div>
          <figcaption className={styles.caption}>
            <span className={styles.name}>
              Natthanat
              <br />
              Chuayriang
            </span>
            <span className={`label ${styles.role}`}>
              Junior full-stack
              <br />
              developer
            </span>
          </figcaption>
          <div className={styles.portraitRule} />
        </figure>
      </div>

      <div className={styles.bands}>
        <Band label="Timeline" className={styles.timelineBand}>
          <ol className={styles.timeline}>
            {timeline.map((t) => (
              <li key={t.when} className={styles.entry}>
                <span className={`label ${styles.when}`}>{t.when}</span>
                <span className={styles.what}>{t.role}</span>
                <span className={styles.where}>{t.where}</span>
              </li>
            ))}
          </ol>
        </Band>

        <Band label="Stack">
          <div className={styles.stack}>
            {stack.map((s) => (
              <div key={s.group}>
                <h3 className={styles.stackGroup}>{s.group}</h3>
                <ul className={styles.stackItems}>
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Band>

        <Band label="Right now" className={styles.nowBand}>
          <div className={styles.now}>
            {now.map((n) => (
              <div key={n.label} className={styles.nowItem}>
                <span className={`label ${styles.ink}`}>{n.label}</span>
                <p className={styles.nowText}>{n.text}</p>
              </div>
            ))}
          </div>
        </Band>
      </div>

      <Band label="Open for work" className={styles.open}>
        <p className={styles.status}>
          <span className={styles.live} aria-hidden="true" />
          {/* Kept in whole phrases, so a narrow screen breaks between them, never
              leaving a lone "·" or splitting the time */}
          <span>
            <span className={styles.keep}>Available now ·</span>{" "}
            <span className={styles.keep}>Bangkok or remote ·</span>{" "}
            <span className={styles.keep}>
              <BangkokClock />
            </span>
          </span>
        </p>
        <h2 className={styles.pitch}>
          Looking for a full-stack role where design and implementation sit together.
        </h2>
        <p className={styles.lead}>
          Junior full-stack, one year of production Java and Angular behind me, and a design degree
          before that. Full-time or contract — replies usually land within a day.
        </p>
      </Band>

      <Band label="Contact" className={styles.contact}>
        <div className={styles.ways}>
          <div className={styles.way}>
            <span className="label">Hiring? Start here</span>
            <a className={styles.bigLink} href="#">
              <CursorBadge label="View" />
              <span className={styles.bigText}>
                Download my CV
                <span className={styles.arrow}>
                  <ArrowDown />
                </span>
              </span>
              <span className="label">PDF · one page · Sep 2026</span>
            </a>
          </div>
          <div className={styles.way}>
            <span className="label">Have a role or project in mind?</span>
            <a className={styles.bigLink} href="mailto:natthanataa@gmail.com">
              <CursorBadge label="Email" />
              <span className={styles.bigText}>
                <span className={styles.email}>natthanataa@gmail.com</span>
                <span className={styles.arrow}>
                  <ArrowOut />
                </span>
              </span>
              <span className="label">Replies within a day</span>
            </a>
          </div>
          <div className={styles.small}>
            <div className={styles.smallPair}>
              <div className={styles.smallGroup}>
                <span className="label">Call</span>
                <div className={styles.smallLinks}>
                  <a className={`${styles.underline} ${styles.tap}`} href="tel:+66868346007">
                    +66 86 834 6007
                  </a>
                </div>
              </div>
              <div className={styles.smallGroup}>
                <span className="label">Elsewhere</span>
                <div className={styles.smallLinks}>
                  {elsewhere.map((l) => (
                    <a key={l.text} className={`${styles.underline} ${styles.tap}`} href={l.href}>
                      {l.text}
                      <span className={styles.out}>
                        <ArrowOut size="0.65em" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.smallGroup}>
              <span className="label">Based in</span>
              <span className={`${styles.smallLinks} ${styles.tapText}`}>Bangkok, Thailand</span>
            </div>
          </div>
        </div>
      </Band>
    </main>
  );
}
