"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ReplyUsageContextValue = {
  generatedRepliesCount: number;
  incrementGeneratedRepliesCount: () => void;
};

const ReplyUsageContext = createContext<ReplyUsageContextValue | undefined>(
  undefined,
);

export function ReplyUsageProvider({ children }: { children: React.ReactNode }) {
  const [generatedRepliesCount, setGeneratedRepliesCount] = useState(0);

  const incrementGeneratedRepliesCount = useCallback(() => {
    setGeneratedRepliesCount((count) => count + 1);
  }, []);

  const value = useMemo(
    () => ({
      generatedRepliesCount,
      incrementGeneratedRepliesCount,
    }),
    [generatedRepliesCount, incrementGeneratedRepliesCount],
  );

  return (
    <ReplyUsageContext.Provider value={value}>
      {children}
    </ReplyUsageContext.Provider>
  );
}

export function useReplyUsage() {
  const context = useContext(ReplyUsageContext);

  if (!context) {
    throw new Error("useReplyUsage must be used within ReplyUsageProvider.");
  }

  return context;
}
