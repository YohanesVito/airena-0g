"use client";

import dynamic from "next/dynamic";

const ArenaClient = dynamic(() => import("@/components/ArenaClient"), { ssr: false });

export default function ArenaPage() {
  return <ArenaClient />;
}
