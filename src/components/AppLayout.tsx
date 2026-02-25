"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import Image from "next/image";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/materials", label: "Materials" },
  { href: "/contracts", label: "Contracts" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [clickedHref, setClickedHref] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const handleNav = (e: React.MouseEvent, href: string) => {
    if (pathname === href) return;
    e.preventDefault();
    setClickedHref(href);
    setTransitioning(true);
    setTimeout(() => {
      router.push(href);
      setTimeout(() => {
        setTransitioning(false);
        setClickedHref(null);
      }, 300);
    }, 150);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-52 flex flex-col flex-shrink-0"
        style={{ backgroundColor: "#1a1a2e", color: "#e0e0e0" }}
      >
        {/* Logo / Brand */}
        <div className="flex flex-col items-center py-6 px-3 border-b" style={{ borderColor: "#2e2e4e" }}>
          <div
            className="rounded-full flex items-center justify-center mb-2 overflow-hidden"
            style={{
              width: 56,
              height: 56,
              background: "#ffffff",
              boxShadow: "0 0 0 3px rgba(255,255,255,0.12)",
            }}
          >
            <Image
              src="/cpcl-logo.png"
              alt="CPCL Logo"
              width={46}
              height={46}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div className="text-center">
            <div className="font-bold text-sm" style={{ color: "#ffffff" }}>CPCL Tender AI</div>
            <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>Powered by ShakthiAI</div>
          </div>
        </div>

        {/* Nav */}
          <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const isClicked = clickedHref === item.href;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNav(e, item.href)}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer select-none"
                    style={{
                      backgroundColor: isClicked
                        ? "#2563eb"
                        : isActive
                        ? "#2563eb"
                        : "transparent",
                      color: isActive || isClicked ? "#ffffff" : "#9ca3af",
                      transform: isClicked ? "scale(0.97)" : "scale(1)",
                    }}
                  >
                    {item.label}
                  </div>
                </a>
              );
            })}
          </nav>

        {/* User initial at bottom */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "#2e2e4e" }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: "#374151", color: "#d1d5db" }}
          >
            P
          </div>
        </div>
      </aside>

        {/* Main content with fade transition */}
        <main
          className="flex-1 flex flex-col transition-opacity duration-200"
          style={{
            backgroundColor: "#f9fafb",
            opacity: transitioning ? 0 : 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* CPCL watermark logo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/cpcl-logo.png')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "380px 380px",
              opacity: 0.05,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          {/* Content sits above watermark */}
          <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </main>
    </div>
  );
}
