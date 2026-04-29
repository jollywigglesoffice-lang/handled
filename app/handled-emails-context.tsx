"use client";

import { createContext, useContext, useMemo, useState } from "react";

type HandledEmailsContextValue = {
  handledEmailIds: string[];
  markEmailHandled: (emailId: string) => void;
};

const HandledEmailsContext = createContext<HandledEmailsContextValue | undefined>(
  undefined,
);

export function HandledEmailsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [handledEmailIds, setHandledEmailIds] = useState<string[]>([]);

  const value = useMemo(
    () => ({
      handledEmailIds,
      markEmailHandled: (emailId: string) => {
        setHandledEmailIds((previousIds) =>
          previousIds.includes(emailId) ? previousIds : [...previousIds, emailId],
        );
      },
    }),
    [handledEmailIds],
  );

  return (
    <HandledEmailsContext.Provider value={value}>
      {children}
    </HandledEmailsContext.Provider>
  );
}

export function useHandledEmails() {
  const context = useContext(HandledEmailsContext);

  if (!context) {
    throw new Error("useHandledEmails must be used within HandledEmailsProvider.");
  }

  return context;
}
