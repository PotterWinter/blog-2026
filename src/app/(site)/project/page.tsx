import type { Metadata } from "next";
import Hero, { Keep } from "@/components/home/Hero";
import ProjectBrowser from "@/components/project/ProjectBrowser";
import { getPublished } from "@/lib/content";
import { isProjectCategory, projectCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Project · Code by Korn Natthanat",
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// 02 Project: the hero, one category of projects at a time (/project?category=design).
// The note on case studies is part of the hero's line, as the blog has one line only
// (owner, 12 Oct 69 — it was its own "Case studies" section under the list)
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
            Projects made the cut out of everything built. The full writeups come{" "}
            <Keep>one at a time.</Keep> Full case studies are chosen from the best projects
            written slowly, one at a time, and only when there is{" "}
            <Keep>something worth explaining.</Keep>
          </>
        }
      />
      <ProjectBrowser
        projects={projects}
        initial={isProjectCategory(category) ? category : projectCategories[0].slug}
      />
    </main>
  );
}
