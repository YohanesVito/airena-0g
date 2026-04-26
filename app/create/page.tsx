"use client";

import dynamic from "next/dynamic";

const CreateBotClient = dynamic(() => import("@/components/CreateBotClient"), { ssr: false });

export default function CreateBotPage() {
  return <CreateBotClient />;
}
