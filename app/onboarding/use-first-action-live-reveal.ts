"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_PROCESSING_SEQUENCE,
  FALLBACK_PROCESSING_SEQUENCE,
  WIDENING_PROCESSING_SEQUENCE,
  type LiveProcessingLineId,
} from "@/lib/onboarding/live-processing-copy";
import { MIN_ONBOARDING_EXAMPLES } from "@/lib/onboarding/build-queue";

const LINE_DURATION_MS = 720;
const MIN_TOTAL_PROCESSING_MS = 1400;
const MAX_TOTAL_PROCESSING_MS = 2800;

export type FirstActionLivePhase = "processing" | "revealed";

export type UseFirstActionLiveRevealInput = {
  locale: "en" | "it";
  active: boolean;
  exampleCount: number;
  hasEmail: boolean;
  /** Bump only on explicit user navigation — never on fetch/state side effects. */
  sequenceKey: number;
};

export type UseFirstActionLiveRevealResult = {
  phase: FirstActionLivePhase;
  activeLineId: LiveProcessingLineId | null;
  activeLineIndex: number;
  totalLines: number;
  showResultBanner: boolean;
  isProcessing: boolean;
  restart: () => void;
};

function buildSequence(input: {
  exampleCount: number;
  hasEmail: boolean;
}): LiveProcessingLineId[] {
  const lines: LiveProcessingLineId[] = [...BASE_PROCESSING_SEQUENCE];

  if (input.exampleCount < MIN_ONBOARDING_EXAMPLES) {
    lines.push(...WIDENING_PROCESSING_SEQUENCE);
  }

  if (!input.hasEmail && input.exampleCount === 0) {
    lines.push(...FALLBACK_PROCESSING_SEQUENCE);
  }

  return lines;
}

function randomRevealTargetMs(): number {
  return (
    MIN_TOTAL_PROCESSING_MS +
    Math.floor(Math.random() * (MAX_TOTAL_PROCESSING_MS - MIN_TOTAL_PROCESSING_MS + 1))
  );
}

export function useFirstActionLiveReveal(
  input: UseFirstActionLiveRevealInput,
): UseFirstActionLiveRevealResult {
  const frozenSequenceRef = useRef<LiveProcessingLineId[]>(
    buildSequence({ exampleCount: input.exampleCount, hasEmail: input.hasEmail }),
  );

  const [phase, setPhase] = useState<FirstActionLivePhase>("processing");
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [showResultBanner, setShowResultBanner] = useState(false);
  const [restartNonce, setRestartNonce] = useState(0);

  const revealTargetMsRef = useRef(randomRevealTargetMs());
  const startedAtRef = useRef(0);

  const restart = useCallback(() => {
    frozenSequenceRef.current = buildSequence({
      exampleCount: input.exampleCount,
      hasEmail: input.hasEmail,
    });
    revealTargetMsRef.current = randomRevealTargetMs();
    startedAtRef.current = 0;
    setPhase("processing");
    setActiveLineIndex(0);
    setShowResultBanner(false);
    setRestartNonce((n) => n + 1);
  }, [input.exampleCount, input.hasEmail]);

  useEffect(() => {
    if (!input.active) return;
    restart();
  }, [input.active, input.sequenceKey, restart]);

  const sequence = frozenSequenceRef.current;

  useEffect(() => {
    if (!input.active || phase !== "processing") return;

    if (startedAtRef.current === 0) {
      startedAtRef.current = Date.now();
    }

    let cancelled = false;
    let lineTimer: ReturnType<typeof setTimeout> | undefined;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    const tryReveal = () => {
      if (cancelled) return;

      const elapsed = Date.now() - startedAtRef.current;
      const timeGate = elapsed >= revealTargetMsRef.current;
      const lineGate = activeLineIndex >= sequence.length - 1;

      if (timeGate && lineGate) {
        setShowResultBanner(true);
        revealTimer = setTimeout(() => {
          if (!cancelled) setPhase("revealed");
        }, 420);
        return;
      }

      revealTimer = setTimeout(tryReveal, 120);
    };

    if (activeLineIndex < sequence.length - 1) {
      lineTimer = setTimeout(() => {
        if (!cancelled) setActiveLineIndex((i) => i + 1);
      }, LINE_DURATION_MS);
    }

    tryReveal();

    return () => {
      cancelled = true;
      if (lineTimer) clearTimeout(lineTimer);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [input.active, phase, activeLineIndex, sequence.length, restartNonce]);

  const safeIndex =
    sequence.length === 0 ? 0 : Math.min(activeLineIndex, sequence.length - 1);
  const activeLineId = sequence[safeIndex] ?? null;

  return {
    phase,
    activeLineId,
    activeLineIndex,
    totalLines: sequence.length,
    showResultBanner,
    isProcessing: phase === "processing",
    restart,
  };
}
