import type { Metadata } from "next";
import loginStyles from "@/components/login/Login.module.css";
import adminStyles from "@/components/admin/Admin.module.css";
import { LiveCategories, LivePager, LiveSegmented } from "@/components/design/Live";
import PostCard from "@/components/home/PostCard";
import PostNav from "@/components/post/PostNav";
import { getPublished } from "@/lib/content";
import { isPrivate } from "@/lib/site";
import styles from "@/components/design/Design.module.css";
import PostBody from "@/components/post/PostBody";

// /design (owner, 10 Oct 69): the design system as the site is built today — v4's 00
// sheet, redrawn from the real tokens (globals.css) and components, so it never drifts
// from the code. Linked from nowhere and kept out of search engines; open it to point
// at a piece when asking for a change.
export const metadata: Metadata = {
  title: "Design system · Code by Korn Natthanat",
  robots: { index: false, follow: false },
};

const colours = [
  ["--ink", "#111110", "Text, black pills, section rules"],
  ["--muted", "#6b6862", "Labels, meta, unpicked categories"],
  ["--line", "#dcdad6", "Row rules, table lines, ---, outlined pills"],
  ["--surface", "#e8e8e7", "Image wells, the grey under a pressed pill"],
  ["--paper", "#ffffff", "Page"],
  ["--error", "#d23a2e", "Failed checks, delete, wrong code"],
  ["--success", "#22a355", "Saved, passed checks"],
] as const;

const faces = [
  ["Helvetica Neue", "--ff-sans", "the device's own (Mac / iPhone) · Arial elsewhere", "400 · 500", "UI, headings, titles, nav, labels", "sans"],
  ["Newsreader", "--ff-serif", "Google Fonts via next/font · optical size axis", "variable weight · italic", "Lead paragraphs and excerpts", "serif"],
  ["IBM Plex Mono", "--ff-mono", "Google Fonts via next/font", "400 · 500", "Dates, numbers, code, meta", "mono"],
  ["IBM Plex Sans Thai", "--font-plex-thai", "Google Fonts via next/font · under all three", "400 · 500 · 600", "Any Thai text, whatever the face around it", "thai"],
] as const;

const type = [
  ["Post title", "--fs-post-title", "40 → 50", "sans", "Building a blog on GitHub API"],
  ["Display", "--fs-display", "32 → 42", "sans", "Hello, I am Korn."],
  ["H2 · category row · quote", "--fs-h2", "24 → 30", "sans", "The shape of the problem"],
  ["Lead", "--fs-lead", "24 → 28", "serif", "A quiet book about a quiet life."],
  ["Card / row title", "--fs-card-title", "19", "sans", "A repo is enough of a database"],
  ["Nav", "--fs-nav", "16", "sans", "Blog  Project  About"],
  ["Body", "--fs-body", "12 · 16 from 768", "sans", "Posts are notes to read quickly — not built for engagement."],
  ["UI, captions", "--fs-ui", "14", "sans", "Save changes · 3 files"],
  ["Mono meta", "--fs-meta", "12", "mono", "8 APR 26 · 4 MIN · No. 12"],
] as const;

const rules = [
  ["--rule-nav", "0.5px ink 50%", "Under the header"],
  ["--rule-section", "1px ink", "Above a section (counts, Previous | Next)"],
  ["--rule-row", "1px line", "Between rows, tables, ---"],
] as const;

const easings = [
  ["--ease-draw", "cubic-bezier(.2, .7, .2, 1)", "Underlines, rails"],
  ["--ease-panel", "cubic-bezier(.2, .8, .2, 1)", "Panels, sheets, reveals"],
  ["--ease-settle", "cubic-bezier(.34, 1.5, .5, 1)", "Copy icon, settings dot"],
] as const;

// Where the build left v4 on purpose — the owner's calls, newest first
const changes = [
  ["10 Oct 69", "--- is a light line (--rule-row), like a table's — v4 drew it in ink"],
  ["10 Oct 69", "New post moves like Publish: the pill shrinks to a dot on hover"],
  ["10 Oct 69", "A Private category on the blog, shown only while signed in"],
  ["6 Oct 69", "Every image opens full screen (⤢ corner button, a double tap on phones)"],
  ["5 Oct 69", "Images and clips fit inside 1000 × 500; Full and Carousel are 2:1; no Fit H"],
  ["5 Oct 69", "A table's top line is light, not ink"],
  ["5 Oct 69", "Settings' Danger zone is called Maintenance; posts per page 6 / 12 / 18 / 24"],
  ["4 Oct 69", "A cover can be a clip"],
  ["29 Sep 69", "Content stops growing at 1680px wide (v4 is drawn at 1280)"],
  ["29 Sep 69", "Category counts sit higher than v4's super, level with the capitals"],
] as const;

const sample = `## A heading in a post

Body text, with a [link](https://korn-natthanat.vercel.app) and \`inline code\`.

> A quote, at the H2 size.

> [!NOTE]
> A note.

\`\`\`ts
const answer = 42;
\`\`\`

| Token | Value |
| --- | --- |
| --line | #dcdad6 |
| --ink | #111110 |

---

After the rule.`;

const font = {
  sans: "var(--ff-sans)",
  serif: "var(--ff-serif)",
  mono: "var(--ff-mono)",
  thai: "var(--font-plex-thai)",
} as const;

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.head}>
        <span className="label">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function DesignPage() {
  // A real post for the card and Previous | Next (never a private one, even signed in)
  const posts = (await getPublished("blog")).filter((p) => !isPrivate(p));
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <h1 className={styles.title}>Design system</h1>
        <p className={styles.intro}>
          The site as built today, drawn from its own tokens and components. v4 (00) is where it started; what changed
          since is listed at the end.
        </p>
      </header>

      <Section n="01" title="Colour">
        <div className={styles.swatches}>
          {colours.map(([name, hex, use]) => (
            <div key={name} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${name})` }} />
              <code className={styles.mono}>{name}</code>
              <span className={styles.mono}>{hex}</span>
              <span className={styles.use}>{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="02" title="Typefaces">
        <div className={styles.faces}>
          {faces.map(([name, token, source, weights, use, face]) => (
            <div key={name} className={styles.face}>
              <p className={styles.specimen} style={{ fontFamily: font[face] }}>
                {face === "thai" ? "กขค ภาษาไทย" : "Aa Gg 0123"}
              </p>
              <p className={styles.faceName}>{name}</p>
              <code className={styles.mono}>{token}</code>
              <span className={styles.use}>
                {weights} · {use}
              </span>
              <span className={styles.use}>{source}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="03" title="Type">
        <p className={styles.use}>Sizes are px at 390 → 1280, fluid between.</p>
        <div className={styles.rows}>
          {type.map(([role, token, size, face, text]) => (
            <div key={token} className={styles.row}>
              <div className={styles.meta}>
                <span className="label">{role}</span>
                <code className={styles.mono}>
                  {token} · {size}
                </code>
              </div>
              <p style={{ fontSize: `var(${token})`, fontFamily: font[face], lineHeight: 1.15 }}>{text}</p>
            </div>
          ))}
          <div className={styles.row}>
            <div className={styles.meta}>
              <span className="label">Label caps</span>
              <code className={styles.mono}>.label · 10.5 · 0.13em</code>
            </div>
            <p className="label">Published · Draft · Checks</p>
          </div>
        </div>
      </Section>

      <Section n="04" title="Rules and space">
        <div className={styles.rows}>
          {rules.map(([token, what, use]) => (
            <div key={token} className={styles.row}>
              <div className={styles.meta}>
                <code className={styles.mono}>{token}</code>
                <span className={styles.use}>
                  {what} · {use}
                </span>
              </div>
              <span className={styles.rule} style={{ borderTop: `var(${token})` }} />
            </div>
          ))}
          <div className={styles.row}>
            <div className={styles.meta}>
              <code className={styles.mono}>--inset / --page-x</code>
              <span className={styles.use}>20 · 32 from 768 · 44 from 1024 · content capped at 1680</span>
            </div>
            <span className={styles.inset} />
          </div>
        </div>
      </Section>

      <Section n="05" title="Motion">
        <p className={styles.use}>Named per use, never unified. Hover a bar to run it.</p>
        <div className={styles.rows}>
          {easings.map(([token, curve, use]) => (
            <div key={token} className={styles.row}>
              <div className={styles.meta}>
                <code className={styles.mono}>{token}</code>
                <span className={styles.use}>
                  {curve} · {use}
                </span>
              </div>
              <span className={styles.track}>
                <span className={styles.ball} style={{ transitionTimingFunction: `var(${token})` }} />
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="06" title="Controls">
        <div className={styles.rows}>
          <div className={styles.row}>
            <div className={styles.meta}>
              <span className="label">Black pill</span>
              <span className={styles.use}>Publish, New post, Continue — shrinks to a dot on hover</span>
            </div>
            <div className={styles.inline}>
              <button type="button" className={loginStyles.continue}>
                Publish
              </button>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.meta}>
              <span className="label">Outlined pill</span>
              <span className={styles.use}>Save changes, Cancel — the line turns ink on hover</span>
            </div>
            <div className={styles.inline}>
              <button type="button" className={adminStyles.btnl}>
                Save changes
              </button>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.meta}>
              <span className="label">Capsule</span>
              <span className={styles.use}>GRID / LIST, WRITE / RAW .MD, BLOG / PROJECT</span>
            </div>
            <div className={styles.inline}>
              <LiveSegmented />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.meta}>
              <span className="label">Category row</span>
              <span className={styles.use}>The travel dot hops to the one picked</span>
            </div>
            <div className={styles.flush}>
              <LiveCategories />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.meta}>
              <span className="label">Notes</span>
              <span className={styles.use}>Under Save / Publish</span>
            </div>
            <div className={styles.notes}>
              <span className={styles.mono}>Saved at 14:02 · 3 files</span>
              <span className={styles.mono} style={{ color: "var(--success)" }}>
                Published as No. 4 · live now
              </span>
              <span className={styles.mono} style={{ color: "var(--error)" }}>
                2 checks failed
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section n="07" title="Components">
        <div className={styles.rows}>
          <div className={styles.row}>
            <div className={styles.meta}>
              <span className="label">Pager</span>
              <span className={styles.use}>Under the grid and the list · the dot slides on a low arc</span>
            </div>
            <div className={styles.flush}>
              <LivePager />
            </div>
          </div>
          {posts[0] && (
            <div className={styles.row}>
              <div className={styles.meta}>
                <span className="label">Card</span>
                <span className={styles.use}>01 grid · cover, category, tags, title, excerpt (the newest post)</span>
              </div>
              <div className={styles.card}>
                <PostCard post={posts[0]} delay={0} reveal={false} order={0} />
              </div>
            </div>
          )}
        </div>
        {posts.length > 1 && (
          <div className={styles.nav}>
            <span className="label">Previous | Next · the end of a post</span>
            <PostNav previous={posts[1]} next={posts[0]} />
          </div>
        )}
      </Section>

      <Section n="08" title="In a post">
        <div className={styles.post}>
          <PostBody markdown={sample} />
        </div>
      </Section>

      <Section n="09" title="Changed from v4">
        <ul className={styles.changes}>
          {changes.map(([when, what]) => (
            <li key={what}>
              <span className={styles.mono}>{when}</span>
              <span>{what}</span>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
