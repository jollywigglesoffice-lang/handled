export type {
  CategorizationIntelligenceOptions,
  CategorizationIntelligenceResult,
  CategorizationReasonCode,
} from "@/lib/categorization-intelligence/types";
export {
  analyzeCategorizationIntelligence,
  mustNotAutoHandle,
} from "@/lib/categorization-intelligence/analyze";
export {
  detectPrioritySignals,
  isPersonalPriorityContext,
} from "@/lib/categorization-intelligence/priority-signals";
export {
  detectPromotionalSignals,
  isMarketingStyleQuestion,
  isPromotionalDominant,
} from "@/lib/categorization-intelligence/promotional-signals";
export { detectRealHumanSignals } from "@/lib/categorization-intelligence/real-human-signals";
export { applySenderMemory } from "@/lib/categorization-intelligence/sender-memory";
