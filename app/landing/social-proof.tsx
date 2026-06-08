"use client";

import { useEffect, useState } from "react";

const LINES = [
  "Users are reaching Inbox Zero faster.",
  "Most users finish email in one sitting.",
  "The average completed email never needs to be seen again.",
] as const;

const ROTATE_MS = 4_500;

export function SocialProof() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % LINES.length);
        setVisible(true);
      }, 320);
    }, ROTATE_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="border-t border-gray-100 pt-8">
      <p
        className={`text-base leading-relaxed text-gray-500 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-live="polite"
      >
        {LINES[index]}
      </p>
    </section>
  );
}
