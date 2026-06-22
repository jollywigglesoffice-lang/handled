import type { GuidedOnboardingStep } from "@/lib/onboarding/guided-steps";

export type OnboardingPreferencesMemory = {
  skipped: boolean;
  noneOfThese: boolean;
  importantCount: number;
  promoCount: number;
};

export type ConversationLocale = "en" | "it";

export const ONBOARDING_CONVERSATION: Record<
  ConversationLocale,
  {
    headline: string;
    connect: {
      prompt: string;
      body: string;
      connectGmail: string;
      connected: string;
      continue: string;
      secondInbox: string;
      secondInboxLocked: string;
      connecting: string;
      checkingConnection: string;
    };
    preferences: {
      prompt: string;
      subtitle: string;
      importantHint: string;
      promoHint: string;
      importantCount: (n: number) => string;
      promoCount: (n: number) => string;
      continue: string;
      skip: string;
      noneOfThese: string;
      showDifferent: string;
      waitingForMail: string;
      emptyInboxSkip: string;
    };
    firstAction: {
      intro: string;
      introLoading: string;
      afterReveal: string;
      choiceHint: string;
      findAnother: string;
      reply: string;
      done: string;
      refresh: string;
      skip: string;
      ackReply: string;
      ackDone: string;
      ackSkip: string;
      ackRefresh: string;
      ackSkipNoMore: string;
    };
    personalize: {
      prompt: string;
      body: (sender: string) => string;
      save: string;
    };
    release: {
      title: string;
      body: string;
      cta: string;
    };
    categories: Record<string, string>;
    transitions: Partial<Record<GuidedOnboardingStep, string>>;
  }
> = {
  en: {
    headline: "Let's set up your inbox together.",
    connect: {
      prompt: "First, let's connect your Gmail.",
      body: "Handled works on top of Gmail — your mail stays yours, always.",
      connectGmail: "Connect Gmail",
      connected: "Gmail connected",
      continue: "Great — let's keep going.",
      secondInbox: "Add second inbox",
      secondInboxLocked: "Pro — add another inbox later",
      connecting: "Connecting…",
      checkingConnection: "Just checking your Gmail connection…",
    },
    preferences: {
      prompt: "Who should I keep an eye on for you?",
      subtitle: "Totally optional — tap anyone you never want to miss, or we can figure it out later.",
      importantHint: "Anyone worth your attention?",
      promoHint: "Anyone you'd rather see less of?",
      importantCount: (n) => (n === 0 ? "No one selected yet" : `${n} selected`),
      promoCount: (n) => (n === 0 ? "None selected" : `${n} selected`),
      continue: "Sounds good",
      skip: "Skip for now",
      noneOfThese: "None of these",
      showDifferent: "Show me others",
      waitingForMail: "I'm pulling a few senders from your inbox…",
      emptyInboxSkip: "Your inbox looks empty — we can come back to this anytime.",
    },
    firstAction: {
      intro: "Want to try handling your first email?",
      introLoading: "Here's one email I picked for you — want to take a look?",
      afterReveal: "Here's something you might want to look at.",
      choiceHint: "Reply, mark done, or skip — your choice.",
      findAnother: "I can also find another one if this isn't useful.",
      reply: "Reply",
      done: "Done",
      refresh: "Find another",
      skip: "Skip",
      ackReply: "Got it — sending you into reply mode.",
      ackDone: "Nice — I'll mark this as handled.",
      ackSkip: "No problem — I'll find another one.",
      ackRefresh: "Found something that might work better…",
      ackSkipNoMore: "That's okay — you're almost set up.",
    },
    personalize: {
      prompt: "Now let's look at something else.",
      body: (sender) => `How should I treat emails from ${sender} going forward?`,
      save: "Sounds good",
    },
    release: {
      title: "You're all set.",
      body: "Your inbox is ready — categories, focus mode, and gentle suggestions are waiting for you.",
      cta: "Go to my inbox",
    },
    categories: {
      worth_your_attention: "Worth your attention",
      good_to_know: "Good to know",
      promotions: "Promotions",
      newsletters: "Newsletters",
    },
    transitions: {
      preferences: "Great — let's keep going.",
      first_action: "Want to try handling your first email?",
      personalize: "One more thing — then you're done.",
      release: "You're almost set up.",
    },
  },
  it: {
    headline: "Configuriamo la inbox insieme.",
    connect: {
      prompt: "Per prima cosa, colleghiamo Gmail.",
      body: "Handled lavora su Gmail — la posta resta sempre tua.",
      connectGmail: "Collega Gmail",
      connected: "Gmail collegato",
      continue: "Perfetto — andiamo avanti.",
      secondInbox: "Aggiungi seconda inbox",
      secondInboxLocked: "Pro — aggiungi un'altra inbox dopo",
      connecting: "Connessione…",
      checkingConnection: "Verifico la connessione Gmail…",
    },
    preferences: {
      prompt: "Su chi dovrei tenere d'occhio per te?",
      subtitle: "Facoltativo — tocca chi non vuoi perdere, o lo capiamo strada facendo.",
      importantHint: "Qualcuno che merita attenzione?",
      promoHint: "Qualcuno che preferisci vedere meno?",
      importantCount: (n) => (n === 0 ? "Nessuno selezionato" : `${n} selezionati`),
      promoCount: (n) => (n === 0 ? "Nessuno selezionato" : `${n} selezionati`),
      continue: "Va bene",
      skip: "Salta per ora",
      noneOfThese: "Nessuno di questi",
      showDifferent: "Mostrami altri",
      waitingForMail: "Recupero qualche mittente dalla inbox…",
      emptyInboxSkip: "La inbox sembra vuota — possiamo tornare su questo quando vuoi.",
    },
    firstAction: {
      intro: "Vuoi provare a gestire la prima email?",
      introLoading: "Ecco una email che ho scelto per te — vuoi darle un'occhiata?",
      afterReveal: "Ecco qualcosa che potrebbe interessarti.",
      choiceHint: "Rispondi, segna come fatto o salta — decidi tu.",
      findAnother: "Posso cercarne un'altra se questa non serve.",
      reply: "Rispondi",
      done: "Fatto",
      refresh: "Cercane un'altra",
      skip: "Salta",
      ackReply: "Ok — ti metto in modalità risposta.",
      ackDone: "Bene — la segno come gestita.",
      ackSkip: "Nessun problema — ne cerco un'altra.",
      ackRefresh: "Ho trovato qualcosa che potrebbe andare meglio…",
      ackSkipNoMore: "Va bene — hai quasi finito.",
    },
    personalize: {
      prompt: "Ora diamo un'occhiata ad altro.",
      body: (sender) => `Come devo trattare le email da ${sender} in futuro?`,
      save: "Va bene",
    },
    release: {
      title: "Tutto pronto.",
      body: "La tua inbox è pronta — categorie, focus mode e suggerimenti ti aspettano.",
      cta: "Vai alla mia inbox",
    },
    categories: {
      worth_your_attention: "Merita attenzione",
      good_to_know: "Buono a sapersi",
      promotions: "Promozioni",
      newsletters: "Newsletter",
    },
    transitions: {
      preferences: "Perfetto — andiamo avanti.",
      first_action: "Vuoi provare a gestire la prima email?",
      personalize: "Un'ultima cosa — poi hai finito.",
      release: "Hai quasi finito.",
    },
  },
};

export function buildContinuityCue(
  memory: OnboardingPreferencesMemory,
  locale: ConversationLocale,
): string | null {
  const en = {
    focusImportant:
      "Earlier you chose to focus on certain senders — I'm keeping that in mind.",
    preferMinimal:
      "You tend to prefer fewer promotional emails — I'll keep things minimal.",
    learnAsGo: "No worries — we'll learn what matters as you go.",
  };
  const it = {
    focusImportant:
      "Prima hai scelto di concentrarti su certi mittenti — lo tengo a mente.",
    preferMinimal:
      "Preferisci meno email promozionali — terrò le cose essenziali.",
    learnAsGo: "Nessun problema — impareremo strada facendo.",
  };
  const copy = locale === "it" ? it : en;

  if (memory.importantCount > 0) return copy.focusImportant;
  if (memory.promoCount > 0) return copy.preferMinimal;
  if (memory.skipped || memory.noneOfThese) return copy.learnAsGo;
  return null;
}
