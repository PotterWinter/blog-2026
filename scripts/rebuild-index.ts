// Rebuild index.json from every .md in a content folder:
//   npm run rebuild-index -- ~/Desktop/PersonalBlog2026/blog-content
// The admin keeps index.json in step with the .md files on every save; this is for
// when they drift (a post edited straight on GitHub) or the index's shape changes.
// When the folder is a git repo, each post's first commit date and commit count come
// from git log; otherwise its publish date and 1.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildIndex, type ContentIndex, type SourceFile } from "../src/lib/schema.ts";

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
    const slug = name.slice(0, -3);
    const file: SourceFile = { slug, text: readFileSync(path.join(postsDir, name), "utf8") };
    if (isRepo) {
      const dates = git("log", "--follow", "--format=%aI", "--", `posts/${name}`).trim().split("\n").filter(Boolean);
      if (dates.length) {
        file.createdAt = dates.at(-1); // log lists newest first
        file.revisions = dates.length;
      }
    }
    return file;
  });

// Keep a nextId that's already ahead (posts deleted since): ids are never reused
const indexFile = path.join(dir, "index.json");
const previous = existsSync(indexFile)
  ? (JSON.parse(readFileSync(indexFile, "utf8")) as ContentIndex).nextId
  : 1;

const index = buildIndex(files, previous);
writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n");
console.log(`index.json: ${index.posts.length} posts, nextId ${index.nextId}${isRepo ? "" : " (not a git repo: dates from publishedAt)"}`);
