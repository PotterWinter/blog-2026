---
id: 31
no: 6
title: "Buddy Blog"
excerpt: "A git-native publishing platform: markdown committed to a GitHub repo, TOTP auth, incremental revalidation. Publishing is a push to main — this site runs on it."
section: project
category: development
tags: [Next.js, TypeScript, GitHub API, Vercel ISR]
cover: ../media/2026/interior-22.webp
coverAlt: "Buddy Blog"
status: published
publishedAt: 2026-02-14
updatedAt: 2026-02-14
role: "Design & development"
year: "2026 · solo, ongoing"
links:
  - label: Live site
    url: https://blog-2026-vercel.vercel.app
    preview: ../media/2026/interior-20.webp
  - label: GitHub
    url: https://github.com/PotterWinter/blog-2026
    preview: ../media/2026/interior-21.webp
  - label: Behance
    url: https://www.behance.net/
---
Placeholder write-up for Buddy Blog, text from the v4 mock — the real case study comes over from the old portfolio in step 5.5. The link previews are stand-in photos; Behance has none, so it shows the cover.

## The constraint

I wanted to write, not administer. The blog had to survive a year of neglect without a server to patch or a database to restore.

That ruled out most of the usual stack. What was left was the one store I already trusted with everything: a git repo.

## How publishing works

The admin never writes to disk. Saving a post is a single commit through the GitHub contents API; the site listens for the push and revalidates only the pages that changed.

```ts title="publish.ts"
await octokit.repos.createOrUpdateFileContents({
  owner, repo, path: `posts/${slug}.md`,
  message: `publish: ${title}`, content: base64(md), sha,
})
await revalidatePath(`/posts/${slug}`)
```

> The database is a folder of text files with a very good undo button.

## What I would change

Images are the weak point. Committing them to the same repo keeps everything in one place, but the repository grows with every screenshot.

Search is the other. It works by scanning files at build time, which is fine at a hundred posts and will not be at a thousand.

<!-- two 16:10 -->
![Admin editor](../media/2026/interior-23.webp "The editor: markdown on the left, live preview on the right.")
![Commit history](../media/2026/interior-24.webp "Every save is a commit, so every revision is recoverable.")
