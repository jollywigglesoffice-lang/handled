import type { DraftMemoryIntegrationDescriptor } from "@/lib/draft-memory/types";

export function listDraftMemoryIntegrations(): DraftMemoryIntegrationDescriptor[] {
  return [
    {
      id: "business_mode",
      status: "planned",
      description: "Dedicated business communication profile with learned phrases.",
    },
    {
      id: "personal_mode",
      status: "planned",
      description: "Personal and family tone presets with edit learning.",
    },
    {
      id: "school_mode",
      status: "planned",
      description: "School and teacher communication style memory.",
    },
    {
      id: "formal_mode",
      status: "planned",
      description: "Formal and healthcare-appropriate drafting.",
    },
    {
      id: "multilingual_mode",
      status: "planned",
      description: "English, Italian, and mixed-language natural adaptation.",
    },
  ];
}
