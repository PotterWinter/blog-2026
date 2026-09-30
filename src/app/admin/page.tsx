import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import SignOut from "@/components/login/SignOut";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin · Code by Korn Natthanat",
  robots: { index: false, follow: false },
};

// Placeholder until 06 Admin hub (step 5.2): proves the sign-in holds, and signs out
export default async function AdminPage() {
  if (!(await currentSession())) redirect("/login");
  return (
    <>
      <Header>
        <span className="label" style={{ marginLeft: "auto" }}>
          <SignOut />
        </span>
      </Header>
      <main style={{ padding: "72px var(--page-x)" }}>
        <h1 style={{ fontSize: "var(--fs-display)", fontWeight: 400 }}>Admin</h1>
        <p style={{ marginTop: 16, color: "var(--muted)" }}>Signed in. The admin hub comes next.</p>
      </main>
    </>
  );
}
