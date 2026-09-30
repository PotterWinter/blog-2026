"use client";

import Image from "next/image";
import { useState } from "react";
import type { PostMeta } from "@/lib/content";
import { shortDate } from "@/lib/format";
import { projectCategories, type ProjectCategory } from "@/lib/site";
import CategoryFilter from "../home/CategoryFilter";
import TransitionLink from "../TransitionLink";
import styles from "./Project.module.css";

type Props = {
  projects: PostMeta[];
  initial: ProjectCategory;
};

const label = (slug: string) => projectCategories.find((c) => c.slug === slug)?.label ?? slug;

// Keep the category in the address bar (/project?category=design) without navigating;
// the first category is the default and leaves the URL clean
function remember(category: ProjectCategory) {
  const url = new URL(window.location.href);
  if (category === projectCategories[0].slug) url.searchParams.delete("category");
  else url.searchParams.set("category", category);
  window.history.replaceState(null, "", url);
}

// 02: Development · Design with the travel dot (one at a time, no All), then that
// category's projects. Each row is the write-up beside a 2:1 cover; the sides swap
// every two rows (text | image, text | image, image | text, …). Phones: cover on top.
export default function ProjectBrowser({ projects, initial }: Props) {
  const [category, setCategory] = useState(initial);
  const shown = projects.filter((p) => p.category === category);

  return (
    <>
      <CategoryFilter
        spread={false}
        options={projectCategories.map((c) => ({
          value: c.slug as ProjectCategory,
          label: c.label,
          count: projects.filter((p) => p.category === c.slug).length,
        }))}
        value={category}
        onChange={(next) => {
          setCategory(next);
          remember(next);
        }}
      />
      <div className={styles.list}>
        {shown.map((project, i) => (
          <TransitionLink
            key={project.slug}
            href={`/project/${project.slug}`}
            className={styles.row}
            data-flip={Math.floor(i / 2) % 2 === 1 || undefined}
            data-reveal
            data-d={i * 60}
          >
            <div className={styles.text}>
              <h2 className={styles.name}>{project.title}</h2>
              <div className={styles.meta}>
                <span className="label">{label(project.category)}</span>
                <span className={`label ${styles.date}`}>{shortDate(project.publishedAt)}</span>
              </div>
              <p className={styles.excerpt}>{project.excerpt}</p>
              <span className={styles.more}>
                Case study{" "}
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
            </div>
            <div className={styles.cover}>
              {project.cover && (
                <Image
                  src={`/${project.cover}`}
                  alt={project.coverAlt}
                  fill
                  sizes="(min-width: 1280px) 430px, (min-width: 768px) 45vw, 100vw"
                  className={styles.image}
                />
              )}
            </div>
          </TransitionLink>
        ))}
      </div>
    </>
  );
}
