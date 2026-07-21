import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Header } from "@/components/Header";
import { NavTabs } from "@/components/NavTabs";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TigerHelp",
  description: "COS office-hours help queue",
};

// Runs before paint to apply the saved theme, avoiding a flash of the wrong
// theme on load. If no choice is saved, data-theme stays unset and the OS
// preference governs (via the media query in globals.css).
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Header user={user} />
        {/* Tabs are navigation between signed-in views; the login page has none. */}
        {user && <NavTabs role={user.role} />}
        <main className="flex-1 w-full max-w-4xl mx-auto px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
