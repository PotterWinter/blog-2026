"use client";

import { useEffect, useState } from "react";

const time = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

// The time in Bangkok, ticking each second. Reads 00:00:00 (v4's placeholder) until it
// runs in the browser, so the server's time from whenever the page was built never shows.
export default function BangkokClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(time());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <time>{now ?? "00:00:00"}</time>;
}
