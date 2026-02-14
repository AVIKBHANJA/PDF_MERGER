import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Merger & Compressor",
  description: "Upload a PDF and two ZIP files, merge and compress them into a single PDF under 20MB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
