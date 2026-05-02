"use client";

import dynamic from "next/dynamic";

const CreatorClient = dynamic(() => import("@/components/CreatorClient"), { ssr: false });

export default function CreatorPage() {
  return <CreatorClient />;
}
