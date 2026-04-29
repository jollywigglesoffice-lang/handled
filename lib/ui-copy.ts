import type { AppUiLanguage } from "@/app/user-preferences-context";

export type UiLocale = "en" | "it" | "es" | "fr" | "de";

type UiCopy = {
  common: {
    backToInbox: string;
  };
  sections: {
    needsYourAttention: string;
    handledForYou: string;
    hiddenInbox: string;
  };
  emailActions: {
    actionsTitle: string;
    replyLanguageLabel: string;
    generatingReplies: string;
    contextQuickApproval: string;
    contextLowPriority: string;
    contextNeedsResponse: string;
    chooseReplyTitle: string;
    chooseReplyDescription: string;
    recommendedLabel: string;
    yourMessageLabel: string;
    regenerateButton: string;
    regenerateButtonBusy: string;
    refineButton: string;
    refineButtonBusy: string;
    copyButton: string;
    copiedButton: string;
    sendButton: string;
    sendSuccess: string;
    editReplyButton: string;
    remindLaterButton: string;
    ignoreButton: string;
    statusPreparing: string;
    statusTimeoutFallback: string;
    statusNetworkFallback: string;
    statusInvalidJson: string;
    statusGenerateFailed: string;
    statusChooseReply: string;
    statusUnexpectedFallback: string;
    statusCopyFailed: string;
    statusReminderSaved: string;
    statusIgnored: string;
    statusRefining: string;
    statusRefineTimeout: string;
    statusRefineNetwork: string;
    statusRefineInvalidJson: string;
    statusRefineFailed: string;
    statusRefinedDone: string;
    statusRefineUnexpected: string;
    draftPlaceholder: string;
    usageLimitMessage: string;
  };
  personalization: {
    repliesTitle: string;
    replyLanguageLabel: string;
    replyLanguageHelp: string;
    yourNameLabel: string;
    yourNamePlaceholder: string;
    toneLabel: string;
    tones: {
      casual: string;
      professional: string;
      friendly: string;
    };
    languages: {
      english: string;
      italian: string;
      spanish: string;
      french: string;
      german: string;
    };
  };
  modeSelector: {
    legend: string;
    modes: {
      assistMe: {
        name: string;
        description: string;
      };
      cleanMyInbox: {
        name: string;
        description: string;
      };
      handleItForMe: {
        name: string;
        description: string;
      };
    };
  };
  emailDetail: {
    sender: string;
    subject: string;
    aiSummary: string;
    fullEmailBody: string;
  };
  settingsPage: {
    headingTag: string;
    title: string;
    safetyNote: string;
    modesTitle: string;
  };
  home: {
    appLanguageLabel: string;
    appLanguageEnglish: string;
    appLanguageItalian: string;
    onboardingLine1: string;
    onboardingLine2: string;
    dismiss: string;
    organizingInbox: string;
    todayTitle: string;
    attentionCountSingle: string;
    attentionCountPlural: string;
    everythingHandled: string;
    brandTag: string;
    settingsButton: string;
    quickTopLine: string;
    heroTitle: string;
    heroDescription: string;
    allCaughtUp: string;
    everythingHandledEmpty: string;
    comeBackLater: string;
    loadingMicroMessages: string[];
    handledToday: string;
    completedSuffix: string;
  };
};

const en: UiCopy = {
  common: {
    backToInbox: "← Back to inbox",
  },
  sections: {
    needsYourAttention: "Needs Your Attention",
    handledForYou: "Handled For You",
    hiddenInbox: "Hidden Inbox",
  },
  emailActions: {
    actionsTitle: "Actions",
    replyLanguageLabel: "Reply Language",
    generatingReplies: "Generating short reply options...",
    contextQuickApproval: "Quick approval",
    contextLowPriority: "Low priority",
    contextNeedsResponse: "Needs response",
    chooseReplyTitle: "Choose a reply",
    chooseReplyDescription: "Pick the version that feels most natural to you.",
    recommendedLabel: "Recommended",
    yourMessageLabel: "Your message",
    regenerateButton: "Regenerate Reply",
    regenerateButtonBusy: "Generating…",
    refineButton: "Refine",
    refineButtonBusy: "Refining…",
    copyButton: "Copy Reply",
    copiedButton: "Copied!",
    sendButton: "Send Reply",
    sendSuccess: "Reply sent ✔",
    editReplyButton: "Edit Reply",
    remindLaterButton: "Remind Me Later",
    ignoreButton: "Ignore",
    statusPreparing: "Preparing short reply options...",
    statusTimeoutFallback: "That took too long — here are backup replies you can use.",
    statusNetworkFallback: "Something went wrong — here are backup replies you can use.",
    statusInvalidJson: "Could not read the server response — using backup replies.",
    statusGenerateFailed: "Could not generate short reply options — using backups.",
    statusChooseReply: "Choose a reply.",
    statusUnexpectedFallback: "Something went wrong — here are backup replies you can use.",
    statusCopyFailed: "Could not copy to clipboard.",
    statusReminderSaved: "Reminder saved for later review.",
    statusIgnored: "Email ignored for now.",
    statusRefining: "Refining your selected reply...",
    statusRefineTimeout: "Refine timed out — kept a simple fallback in its place.",
    statusRefineNetwork: "Could not reach the server — kept a simple fallback in its place.",
    statusRefineInvalidJson: "Could not read the server response — using a backup line.",
    statusRefineFailed: "Could not refine this reply — using a backup line.",
    statusRefinedDone: "Reply refined. You can refine again if needed.",
    statusRefineUnexpected: "Something went wrong — using a backup line.",
    draftPlaceholder: "Edit your reply here…",
    usageLimitMessage: "You've handled a lot today. Want unlimited access?",
  },
  personalization: {
    repliesTitle: "Replies",
    replyLanguageLabel: "Reply Language",
    replyLanguageHelp: "Generated reply text uses this language.",
    yourNameLabel: "Your name",
    yourNamePlaceholder: "How you sign off",
    toneLabel: "Tone for replies",
    tones: {
      casual: "Casual",
      professional: "Professional",
      friendly: "Friendly",
    },
    languages: {
      english: "English",
      italian: "Italian",
      spanish: "Spanish",
      french: "French",
      german: "German",
    },
  },
  modeSelector: {
    legend: "Choose your mode",
    modes: {
      assistMe: {
        name: "Assist Me",
        description:
          "Stay in control with gentle support. Handled drafts and organizes, and you make final decisions.",
      },
      cleanMyInbox: {
        name: "Clean My Inbox",
        description:
          "Feel lighter faster. Handled sorts and clears low-priority email while you review key actions.",
      },
      handleItForMe: {
        name: "Handle It For Me",
        description:
          "Reduce decision fatigue. Handled prepares actions end-to-end and asks only for explicit approval before sending.",
      },
    },
  },
  emailDetail: {
    sender: "Sender",
    subject: "Subject",
    aiSummary: "AI summary",
    fullEmailBody: "Full email body",
  },
  settingsPage: {
    headingTag: "Handled Settings",
    title: "Preferences",
    safetyNote: "The app never sends emails without explicit user approval.",
    modesTitle: "Modes",
  },
  home: {
    appLanguageLabel: "App Language",
    appLanguageEnglish: "English",
    appLanguageItalian: "Italiano",
    onboardingLine1: "Paste an email or select one below.",
    onboardingLine2:
      "Generate a reply, edit it, and copy it into your email app.",
    dismiss: "Dismiss",
    organizingInbox: "Organizing your inbox…",
    todayTitle: "Today",
    attentionCountSingle: "email needs your attention",
    attentionCountPlural: "emails need your attention",
    everythingHandled: "Everything else is handled",
    brandTag: "Handled",
    settingsButton: "Settings",
    quickTopLine: "Handle your emails in seconds",
    heroTitle: "Your inbox. Handled.",
    heroDescription:
      "A calm space to see what needs your attention, what has already been taken care of, and what can stay out of sight for now.",
    allCaughtUp: "You're all caught up.",
    everythingHandledEmpty: "Everything is handled.",
    comeBackLater: "Come back later for new emails.",
    loadingMicroMessages: [
      "We've got it handled.",
      "Only what matters.",
      "Nothing urgent right now.",
      "Take a breath.",
      "You're in control.",
    ],
    handledToday: "Handled Today",
    completedSuffix: "completed",
  },
};

const it: UiCopy = {
  common: {
    backToInbox: "← Torna alla inbox",
  },
  sections: {
    needsYourAttention: "Richiedono attenzione",
    handledForYou: "Gestite per te",
    hiddenInbox: "Inbox nascosta",
  },
  emailActions: {
    actionsTitle: "Azioni",
    replyLanguageLabel: "Lingua della risposta",
    generatingReplies: "Generazione di risposte brevi in corso...",
    contextQuickApproval: "Approvazione rapida",
    contextLowPriority: "Bassa priorita",
    contextNeedsResponse: "Serve risposta",
    chooseReplyTitle: "Scegli una risposta",
    chooseReplyDescription: "Scegli la versione che ti sembra piu naturale.",
    recommendedLabel: "Consigliata",
    yourMessageLabel: "Il tuo messaggio",
    regenerateButton: "Rigenera risposta",
    regenerateButtonBusy: "Generazione...",
    refineButton: "Migliora",
    refineButtonBusy: "Miglioramento...",
    copyButton: "Copia risposta",
    copiedButton: "Copiata!",
    sendButton: "Invia risposta",
    sendSuccess: "Risposta inviata ✔",
    editReplyButton: "Modifica risposta",
    remindLaterButton: "Ricordamelo dopo",
    ignoreButton: "Ignora",
    statusPreparing: "Preparazione di risposte brevi in corso...",
    statusTimeoutFallback:
      "Ci sta mettendo troppo — ecco risposte di backup da usare.",
    statusNetworkFallback:
      "Qualcosa e andato storto — ecco risposte di backup da usare.",
    statusInvalidJson:
      "Impossibile leggere la risposta del server — uso risposte di backup.",
    statusGenerateFailed:
      "Impossibile generare risposte brevi — uso risposte di backup.",
    statusChooseReply: "Scegli una risposta.",
    statusUnexpectedFallback:
      "Qualcosa e andato storto — ecco risposte di backup da usare.",
    statusCopyFailed: "Impossibile copiare negli appunti.",
    statusReminderSaved: "Promemoria salvato per dopo.",
    statusIgnored: "Email ignorata per ora.",
    statusRefining: "Sto migliorando la risposta selezionata...",
    statusRefineTimeout:
      "Timeout durante il miglioramento — ho mantenuto una versione semplice.",
    statusRefineNetwork:
      "Impossibile raggiungere il server — ho mantenuto una versione semplice.",
    statusRefineInvalidJson:
      "Impossibile leggere la risposta del server — uso una frase di backup.",
    statusRefineFailed:
      "Impossibile migliorare questa risposta — uso una frase di backup.",
    statusRefinedDone: "Risposta migliorata. Puoi migliorarla ancora se vuoi.",
    statusRefineUnexpected:
      "Qualcosa e andato storto — uso una frase di backup.",
    draftPlaceholder: "Modifica qui la tua risposta...",
    usageLimitMessage: "Hai gestito molto oggi. Vuoi accesso illimitato?",
  },
  personalization: {
    repliesTitle: "Risposte",
    replyLanguageLabel: "Lingua della risposta",
    replyLanguageHelp: "Il testo generato usa questa lingua.",
    yourNameLabel: "Il tuo nome",
    yourNamePlaceholder: "Come firmi i messaggi",
    toneLabel: "Tono delle risposte",
    tones: {
      casual: "Informale",
      professional: "Professionale",
      friendly: "Amichevole",
    },
    languages: {
      english: "Inglese",
      italian: "Italiano",
      spanish: "Spagnolo",
      french: "Francese",
      german: "Tedesco",
    },
  },
  modeSelector: {
    legend: "Scegli la tua modalita",
    modes: {
      assistMe: {
        name: "Assistimi",
        description:
          "Mantieni il controllo con un supporto leggero. Handled prepara e organizza, tu prendi le decisioni finali.",
      },
      cleanMyInbox: {
        name: "Pulisci la mia inbox",
        description:
          "Alleggerisci piu in fretta. Handled ordina e pulisce le email a bassa priorita mentre tu rivedi le azioni importanti.",
      },
      handleItForMe: {
        name: "Gestiscilo per me",
        description:
          "Riduci la fatica decisionale. Handled prepara le azioni end-to-end e chiede approvazione esplicita prima dell'invio.",
      },
    },
  },
  emailDetail: {
    sender: "Mittente",
    subject: "Oggetto",
    aiSummary: "Riepilogo AI",
    fullEmailBody: "Testo completo dell'email",
  },
  settingsPage: {
    headingTag: "Impostazioni Handled",
    title: "Preferenze",
    safetyNote:
      "L'app non invia mai email senza approvazione esplicita dell'utente.",
    modesTitle: "Modalita",
  },
  home: {
    appLanguageLabel: "Lingua app",
    appLanguageEnglish: "English",
    appLanguageItalian: "Italiano",
    onboardingLine1: "Incolla una email o selezionane una qui sotto.",
    onboardingLine2:
      "Genera una risposta, modificala e copiala nella tua app email.",
    dismiss: "Chiudi",
    organizingInbox: "Sto organizzando la tua inbox...",
    todayTitle: "Oggi",
    attentionCountSingle: "email richiede la tua attenzione",
    attentionCountPlural: "email richiedono la tua attenzione",
    everythingHandled: "Tutto il resto e gestito",
    brandTag: "Handled",
    settingsButton: "Impostazioni",
    quickTopLine: "Gestisci le email in pochi secondi",
    heroTitle: "La tua inbox. Gestita.",
    heroDescription:
      "Uno spazio calmo per vedere cosa richiede attenzione, cosa e gia stato gestito e cosa puo restare fuori vista.",
    allCaughtUp: "Hai gia fatto tutto.",
    everythingHandledEmpty: "E tutto gestito.",
    comeBackLater: "Torna piu tardi per nuove email.",
    loadingMicroMessages: [
      "Ci pensiamo noi.",
      "Solo cio che conta.",
      "Nulla di urgente adesso.",
      "Respira.",
      "Hai il controllo.",
    ],
    handledToday: "Gestite oggi",
    completedSuffix: "completate",
  },
};

const uiCopyByLocale: Record<UiLocale, UiCopy> = {
  en,
  it,
  es: en,
  fr: en,
  de: en,
};

export function uiLocaleFromLanguage(uiLanguage: AppUiLanguage): UiLocale {
  return uiLanguage === "it" ? "it" : "en";
}

export function getUiCopy(locale: UiLocale): UiCopy {
  return uiCopyByLocale[locale] ?? en;
}
