"use client";

import dynamic from "next/dynamic";

const LeaderboardClient = dynamic(() => import("@/components/LeaderboardClient"), { ssr: false });

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
