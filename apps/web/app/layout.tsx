import type { Metadata } from "next";
import Link from "next/link";
import { Cuboid } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RenovationTwin",
  description: "Upload a floor plan and walk through renovation ideas in 3D."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="container topbar-inner">
              <Link href="/" className="brand" aria-label="RenovationTwin home">
                <span className="brand-mark">
                  <Cuboid size={18} aria-hidden="true" />
                </span>
                <span>RenovationTwin</span>
              </Link>
              <nav className="nav-links" aria-label="Main navigation">
                <Link href="/demo/london-flat">Demo</Link>
                <Link href="/projects/new">Upload</Link>
                <Link href="/novus-proof">Novus proof</Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
