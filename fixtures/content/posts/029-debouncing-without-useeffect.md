---
id: 29
code: l6e54q4l
no: 29
title: "Debouncing without useEffect"
excerpt: "Eight keystrokes, one request — and not a single useEffect in the file."
section: blog
category: engineering
tags: [react, typescript]
cover: ../media/2026/interior-20.webp
coverAlt: "Placeholder cover for Debouncing without useEffect"
status: published
publishedAt: 2026-08-30
updatedAt: 2026-09-12
---

## The shape of the problem

Every debounce hook I have written was a workaround for the same thing: React has no place to put time. A keystroke is an event. A search request is an effect of the *last* keystroke in a burst — not of the state that keystroke happened to produce.

Once the trigger is the event rather than the value, the hook disappears and what remains is **a plain function with a timer in it**.

พูดง่ายๆ คือ อย่ารอให้ state เปลี่ยนแล้วค่อยยิง request — ให้ยิงจาก**ปุ่มที่กดครั้งสุดท้าย**โดยตรง แล้วใช้ `setTimeout` ตัวเดียวคุมจังหวะ

```ts title="search.ts"
export const search = debounce((q: string) => {
  void fetchResults(q)
}, 250)
```

```output attach title="node debounce.ts"
$ node --experimental-strip-types debounce.ts
listening for keystrokes…
# q="d"     scheduled  +250ms
# q="de"    cancelled
# q="deb"   cancelled
  q="debounce"  → fetchResults("debounce")
# 1 request for 8 keystrokes
```

[YouTube · IFrame API demo](https://www.youtube.com/watch?v=M7lc1UVf-VE)

> The state is not the trigger. The event is.

## What I do now

Keep the input uncontrolled — no `value`, no `useState` — debounce at the edge where the event arrives, and cancel exactly once when the component goes away. Three rules, no dependency array, and a request count that finally matches what the user actually did. The same idea shows up in [Postgres row locks, illustrated](/posts/postgres-row-locks-illustrated) — hold the thing only as long as the event needs it.

1. Leave the input uncontrolled, so typing never re-renders the tree.
2. Debounce in the handler, at the exact edge where the event arrives.
3. Cancel once, when the component unmounts.

![One long roof, one quiet edge — the structure does the work.](../media/2026/interior-19.webp "One long roof, one quiet edge — the structure does the work.")

<!-- two 4:5 -->
![A wardrobe of pale shirts](../media/2026/interior-20.webp "Two images, 4:5 each")
![A room above the mountains](../media/2026/interior-22.webp "Cropped to the ratio, captions under each")

<!-- carousel -->
![A sofa and three tall windows](../media/2026/interior-19.webp "Carousel, 16:10 — the first of four")
![A screening room](../media/2026/interior-23.webp "A screening room")
![Slatted doors and a long shelf](../media/2026/interior-24.webp "Slatted doors and a long shelf")
![Light across a suede block](../media/2026/interior-25.webp "Light across a suede block")

<!-- fit height -->
![A lamp over a round table](../media/2026/interior-21.webp "Fit height: 560 tall, its own ratio")

<!-- full -->
![Light across a suede block](../media/2026/interior-25.webp "Full: edge to edge")

### Cancel once, on unmount

When the component goes away, call `clearTimeout` on the pending timer and stop. **One cleanup, in one place.**

## Where it breaks

Debouncing at the event is not free. If the same input feeds two consumers — search and analytics, say — each one now needs its own timer, and they drift apart by a few milliseconds.

| Approach | Requests / 8 keys | Cleanup |
| --- | --- | --- |
| useEffect on the value | 1 | Every render |
| Debounce in the handler | 1 | Once, on unmount |
| No debounce | 8 | None |

The other failure is navigation. A pending call that fires after the route changes will happily fetch results for a page nobody is looking at. Cancelling on unmount covers most of it; a [router-level abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) covers the rest.

> [!NOTE]
> If both consumers must agree on the same moment, debounce once upstream and fan the result out — not twice downstream.

---

## What I would keep

Keep the rule, not the helper. Time belongs to the event that started it. Once that is true, the component stays a plain function of its props, and the effect list in the file finally matches the effects the user can see.

- Time belongs to the event, not the state.
- One timer per consumer, cancelled in one place.
- Abort in-flight requests at the router, not in every component.
