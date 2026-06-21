export type {
  CalendarAvailabilityResult,
  InboxFlowBand,
  ScheduleAcceptResult,
  SuggestedTimeSlot,
  TimeImpactKind,
  TimeImpactResult,
  TimeStripBand,
} from "@/lib/time-impact/types";

export { classifyTimeImpact, type ClassifyTimeImpactInput } from "@/lib/time-impact/classify";
export {
  applyTimeImpactOrderingToBuckets,
  sortMessagesByTimeImpact,
  type TimeSortableMessage,
} from "@/lib/time-impact/inbox-sort";
export {
  buildTimeStripGroups,
  type TimeStripGroup,
  type TimeStripItem,
  type TimeStripMessage,
} from "@/lib/time-impact/time-strip";
