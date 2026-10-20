import type { Metadata, Viewport } from "next";
import { Baloo_2, Rethink_Sans } from "next/font/google";
import "./globals.css";

// Baloo 2: the rounded lettering of a child's sticker chart. Rethink Sans: plain and readable for parents.
const display = Baloo_2({ variable: "--ff-display", subsets: ["latin"], weight: ["600", "800"] });
const body = Rethink_Sans({ variable: "--ff-body", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Patch Hours",
  description: "The show plays only while the eye patch is on. A Fire TV app and a phone check for children patching for amblyopia.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1D1714" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
