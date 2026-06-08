"use client";

import { useEffect, useState } from "react";

const BASE_COUNT = 12_847;
const TICK_MS = 2_800;

export function CompletedCounter() {
  const [count, setCount] = useState(BASE_COUNT);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 3) + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <section className="rounded-xl border border-gray-100 bg-[#FAFBFC] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
        Emails completed with Handled
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#0F172A]">
        {count.toLocaleString()}
      </p>
    </section>
  );
}
