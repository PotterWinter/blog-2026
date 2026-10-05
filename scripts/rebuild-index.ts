// Rebuild index.json from every .md in a content folder:
//   npm run rebuild-index -- ~/Desktop/PersonalBlog2026/blog-content
// The admin keeps index.json in step with the .md files on every save; this is for
// when they drift (a post edited straight on GitHub) or the index's shape changes.
// When the folder is a git repo, each post's first commit date and commit count come
// from git log; otherwise its publish date and 1.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildIndex, sourceSlug, type ContentIndex, type SourceFile } from "../src/lib/schema.ts";

const dir = path.resolve(process.argv[2] ?? ".");
const postsDir = path.join(dir, "posts");
if (!existsSync(postsDir)) {
  console.error(`No posts/ folder in ${dir}`);
  process.exit(1);
}

const isRepo = existsSync(path.join(dir, ".git"));
const git = (...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });

const files: SourceFile[] = readdirSync(postsDir)
  .filter((name) => name.endsWith(".md"))
  .map((name) => {
    const text = readFileSync(path.join(postsDir, name), "utf8");
    const file: SourceFile = { slug: sourceSlug(name, text), text, file: `posts/${name}` };
    if (isRepo) {
      const log = git("log", "--follow", "--format=%h %aI", "--", `posts/${name}`).trim().split("\n").filter(Boolean);
      if (log.length) {
        const [sha, date] = log[0].split(" "); // log lists newest first
        file.lastCommit = `${sha} · ${date}`;
        file.createdAt = log.at(-1)!.split(" ")[1];
        file.revisions = log.length;
      }
    }
    return file;
  });

// Keep what the .md files can't give back: a nextId that's already ahead (posts deleted
// since — ids are never reused) and the kept tags
const indexFile = path.join(dir, "index.json");
const previous = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as Partial<ContentIndex>) : {};

const index = buildIndex(files, previous.nextId ?? 1, previous.tags ?? []);
writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n");
console.log(`index.json: ${index.posts.length} posts, nextId ${index.nextId}${isRepo ? "" : " (not a git repo: dates from publishedAt)"}`);
