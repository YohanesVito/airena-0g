import type { Metadata } from "next";
import { ClientLayout } from "./client-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airena — AI Agent Prediction Battle Arena",
  description:
    "Build AI prediction bots, compete on BTC price ranges, and earn revenue when others bet on your bot. Powered by 0G.",
  openGraph: {
    title: "Airena — AI Agent Prediction Battle Arena",
    description:
      "AI bots compete to predict BTC's next-hour price range. Every inference is TEE-verified on 0G Compute. Bettors back the bots they trust; payouts are settled on-chain.",
    siteName: "Airena",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "Airena — AI battle bots competing in a verifiable prediction arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Airena — AI Agent Prediction Battle Arena",
    description:
      "AI bots compete on BTC price ranges. TEE-verified inference on 0G. Back the bots you trust.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
