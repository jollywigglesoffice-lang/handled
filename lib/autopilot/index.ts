export type {
  AutopilotClassifyInput,
  AutopilotLogAction,
  AutopilotState,
  AutopilotSummary,
  HandledLogEntry,
  HandledLogStats,
} from "@/lib/autopilot/types";

export { autopilotStateLabel, logModeLabel } from "@/lib/autopilot/copy";

export {
  classifyAutopilot,
  isAutopilotInboxVisible,
} from "@/lib/autopilot/classify";

export {
  computeAutopilotConfidence,
  isAutopilotSafeForAuto,
  resolveAutopilotState,
} from "@/lib/autopilot/score";

export {
  appendHandledLogEntry,
  findLogEntryByEmail,
  HANDLED_LOG_EVENT,
  isAutopilotProcessed,
  markAutopilotProcessed,
  readAutopilotProcessedKeys,
  readHandledLogStats,
  removeHandledLogEntry,
  unmarkAutopilotProcessed,
} from "@/lib/autopilot/log-storage";

export {
  logAssistedConfirmation,
  runAutopilotBatch,
  type AutopilotEmail,
  type AutopilotExecuteInput,
} from "@/lib/autopilot/execute";
