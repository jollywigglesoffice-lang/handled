"use client";

import { useEffect, useState } from "react";
import type { LandingLocale } from "@/lib/landing-copy";
import { getLandingCopy } from "@/lib/landing-copy";

const ROTATE_MS = 4_500;

type SocialProofProps = {
  locale: LandingLocale;
};

export function SocialProof({ locale }: SocialProofProps) {
  const lines = getLandingCopy(locale).socialProof;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIndex(0);
  }, [locale]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % lines.length);
        setVisible(true);
      }, 320);
    }, ROTATE_MS);
    return () => window.clearInterval(interval);
  }, [lines.length]);

  return (
    <section className="border-t border-gray-100 pt-8">
      <p
        className={`text-base leading-relaxed text-gray-500 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-live="polite"
      >
        {lines[index]}
      </p>
    </section>
  );
}
