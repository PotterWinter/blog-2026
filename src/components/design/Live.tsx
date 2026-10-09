"use client";

import { useState } from "react";
import CategoryFilter from "@/components/home/CategoryFilter";
import Pager from "@/components/home/Pager";
import Segmented from "@/components/Segmented";

// /design: the moving parts, live — the same components the site uses, on dummy data
export function LiveCategories() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <CategoryFilter
      options={[
        { value: null, label: "All", count: 30 },
        { value: "engineering", label: "Engineering", count: 16 },
        { value: "math", label: "Math", count: 5 },
        { value: "reading", label: "Reading", count: 8 },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

export function LiveSegmented() {
  const [value, setValue] = useState<"write" | "raw">("write");
  return (
    <Segmented
      label="Mode"
      options={[
        { value: "write", label: "WRITE" },
        { value: "raw", label: "RAW .MD" },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

export function LivePager() {
  const [page, setPage] = useState(1);
  return <Pager page={page} pages={5} from={(page - 1) * 12 + 1} to={page * 12} total={60} onChange={setPage} />;
}
