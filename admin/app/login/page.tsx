"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcoming, setWelcoming] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      // Cinematic welcome, then into the dashboard.
      setWelcoming(true);
      setTimeout(() => { router.replace("/"); router.refresh(); }, 2400);
    } else {
      setError("That is not quite right. Try again.");
      setPassword("");
    }
  }

  if (welcoming) {
    return (
      <main className="welcome fixed inset-0 z-50 grid place-items-center bg-ink overflow-hidden px-6">
        <span className="welcome__glow" />
        <div className="relative text-center">
          <p className="welcome__eyebrow text-[0.7rem] tracking-[0.34em] uppercase text-creamSoft mb-4">Hazel&apos;s Command Centre</p>
          <h1 className="welcome__title font-serif text-4xl md:text-6xl text-cream leading-tight">
            Welcome back, <span className="text-gold italic">Hazel.</span>
          </h1>
          <span className="welcome__line block h-px bg-gold mx-auto mt-7" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm rise text-center">
        <div className="mb-10">
          <div className="font-serif text-3xl text-gold">Hazel&apos;s</div>
          <div className="text-xs tracking-[0.32em] uppercase text-creamSoft mt-1">Command Centre</div>
        </div>
        <label className="block text-left">
          <span className="text-[0.7rem] tracking-[0.2em] uppercase text-gold">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="mt-2 w-full bg-transparent border-b border-creamSoft/30 focus:border-gold outline-none py-2 text-cream"
          />
        </label>
        {error && <p className="mt-4 text-sm text-rose font-serif italic">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-8 w-full rounded-full bg-gold text-ink font-medium tracking-[0.14em] uppercase text-sm py-3 transition hover:bg-goldBright disabled:opacity-60"
        >
          {loading ? "Opening..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
