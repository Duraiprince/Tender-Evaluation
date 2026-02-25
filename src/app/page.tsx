"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      setError("Please enter User ID and Password.");
      return;
    }
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 400);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Refinery background image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/refinery-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.55)",
          zIndex: 0,
        }}
      />
      {/* Purple gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(109,40,217,0.55) 0%, rgba(124,58,237,0.45) 40%, rgba(99,102,241,0.4) 100%)",
          zIndex: 1,
        }}
      />
      {/* Card wrapper */}
      <div
        className="flex rounded-2xl overflow-hidden shadow-2xl"
        style={{ width: 720, minHeight: 400, position: "relative", zIndex: 2 }}
      >
        {/* Left — form */}
        <div className="bg-white flex flex-col justify-center px-10 py-12" style={{ width: 360 }}>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Log In</h1>
          <p className="text-sm text-gray-400 mb-8">CPCL Tender AI</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setError(""); }}
                placeholder="Enter your user ID"
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition"
                style={{ backgroundColor: "#f0edf8", border: "none" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your password"
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition"
                style={{ backgroundColor: "#f0edf8", border: "none" }}
              />
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all active:scale-95"
              style={{
                background: loading
                  ? "#9333ea"
                  : "linear-gradient(90deg, #7c3aed, #9333ea)",
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading ? "Logging in…" : "Log In"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">Powered by ShakthiAI</p>
        </div>

        {/* Right — brand panel */}
        <div
          className="flex flex-col items-center justify-center"
          style={{
            width: 360,
            background: "linear-gradient(160deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circles */}
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -40,
              left: -40,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
            }}
          />

          {/* Logo */}
          <div
            className="rounded-full flex items-center justify-center mb-5"
            style={{
              width: 150,
              height: 150,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(4px)",
            }}
          >
            <Image
              src="/cpcl-logo.png"
              alt="CPCL Logo"
              width={120}
              height={120}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>

          <p className="text-white text-xl font-bold tracking-wide">CPCL Tender AI</p>
        </div>
      </div>
    </div>
  );
}
