"use client";

import { useState, useEffect } from "react";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f" }}>
        {children}
      </div>
    );
  }

  return (
    <Providers>
      <Navbar />
      {children}
    </Providers>
  );
}
