import type { Metadata } from "next";
import Hero, { Keep } from "@/components/home/Hero";
import ProjectBrowser from "@/components/project/ProjectBrowser";
import styles from "@/components/project/Project.module.css";
import { getPublished } from "@/lib/content";
import { isProjectCategory, projectCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Project · Code by Korn Natthanat",
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// 02 Project: the hero, one category of projects at a time (/project?category=design),
// and a note on case studies
export default async function ProjectPage({ searchParams }: PageProps<"/project">) {
  const category = one((await searchParams).category);
  const projects = await getPublished("project");
  return (
    <main>
      <Hero
        first="The things I"
        second="made."
        intro={
          <>
            Projects made the cut out of everything built. The full write-ups come{" "}
            <Keep>one at a time.</Keep>
          </>
        }
      />
      <ProjectBrowser
        projects={projects}
        initial={isProjectCategory(category) ? category : projectCategories[0].slug}
      />
      <section className={styles.cases} data-reveal>
        <h2 className={styles.casesTitle}>Case studies</h2>
        <p className={styles.casesText}>
          Full case studies are chosen from the best projects written slowly, one at a time, and
          only when there is something worth explaining.
        </p>
      </section>
    </main>
  );
}
