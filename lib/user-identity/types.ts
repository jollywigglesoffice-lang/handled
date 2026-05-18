export type SignOffStyle = "best" | "thanks" | "regards" | "warm_regards" | "none";

export type CommunicationStyle = "professional" | "casual" | "balanced";

export type UserIdentity = {
  /** Short name for greetings and sign-offs — e.g. "Aisha" */
  displayName: string;
  /** Full name for formal signatures — e.g. "Aisha Surodjawan" */
  fullName?: string;
  businessTitle?: string;
  companyName?: string;
  defaultSignOff: SignOffStyle;
  /** Overrides template sign-off, e.g. "Best, Aisha" */
  customSignOff?: string;
  /** Multi-line block, e.g. "Aisha Surodjawan\\nFounder, Handled" */
  signatureBlock?: string;
  communicationStyle: CommunicationStyle;
  includeSignOffInReplies: boolean;
  updatedAt?: number;
};

export const EMPTY_IDENTITY: UserIdentity = {
  displayName: "",
  defaultSignOff: "best",
  communicationStyle: "balanced",
  includeSignOffInReplies: true,
};
