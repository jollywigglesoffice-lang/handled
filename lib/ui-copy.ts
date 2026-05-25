import type { AppUiLanguage } from "@/app/user-preferences-context";

export type UiLocale = "en" | "it" | "es" | "fr" | "de";

type UiCopy = {
  common: {
    backToInbox: string;
  };
  calm: {
    errors: {
      title: string;
      tryAgain: string;
      showDetails: string;
    };
    empty: {
      manageable: string;
      clearedNoise: string;
      noUnresolved: string;
      nothingOverdue: string;
      noBody: string;
      noTriageNotes: string;
    };
    loading: {
      openingEmail: string;
      checkingInbox: string;
    };
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
  identity: {
    title: string;
    description: string;
    displayNameLabel: string;
    displayNameHelp: string;
    displayNamePlaceholder: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    businessTitleLabel: string;
    businessTitlePlaceholder: string;
    companyNameLabel: string;
    companyNamePlaceholder: string;
    communicationStyleLabel: string;
    communicationStyleHelp: string;
    communicationStyles: {
      balanced: string;
      professional: string;
      casual: string;
    };
    defaultSignOffLabel: string;
    defaultSignOffHelp: string;
    customSignOffLabel: string;
    customSignOffHelp: string;
    customSignOffPlaceholder: string;
    signatureBlockLabel: string;
    signatureBlockHelp: string;
    signatureBlockPlaceholder: string;
    includeSignOffLabel: string;
    includeSignOffHelp: string;
    previewLabel: string;
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
  relationship: {
    assignTitle: string;
    assignHint: string;
    assignLink: string;
    dismiss: string;
    settingsTitle: string;
    settingsSubtitle: string;
    emptySettings: string;
  };
  contextualSearch: {
    eyebrow: string;
    sectionTitle: string;
    sectionSubtitle: string;
    inputLabel: string;
    placeholder: string;
    filtersLabel: string;
    answerLabel: string;
    resultsLabel: string;
    noResults: string;
    hint: string;
    openEmail: string;
  };
  dailyWorkspace: {
    eyebrow: string;
    sectionTitle: string;
    sectionSubtitle: string;
    calmDayMessage: string;
    emptySection: string;
    openEmail: string;
    fullInboxHint: string;
  };
  dailyBriefing: {
    eyebrow: string;
    sectionTitle: string;
    sectionSubtitle: string;
    sectionCalmNote: string;
    highlightsLabel: string;
    insightsLabel: string;
    groupsLabel: string;
    openGroup: string;
    moreInGroup: string;
  };
  followUp: {
    sectionTitle: string;
    sectionSubtitle: string;
    sectionCalmNote: string;
    emptyState: string;
    atRiskTab: string;
    followUpsTab: string;
    waitingOnTab: string;
    unresolvedTab: string;
    pendingTab: string;
    snoozeButton: string;
    dismissButton: string;
    resolveButton: string;
    draftFollowUpButton: string;
    draftFollowUpBusy: string;
    copyDraftButton: string;
    copiedDraft: string;
    savedReminder: string;
    snoozedReminder: string;
    dismissedReminder: string;
    resolvedReminder: string;
    intelligenceTitle: string;
    remindMeLater: string;
    openEmail: string;
    urgencyLabel: string;
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
    inboxLoadingTitle: string;
    emptyGmailInbox: string;
    inboxErrorTitle: string;
    connectGmailTitle: string;
    connectGmailBody: string;
    handledSectionEmpty: string;
    handledToday: string;
    completedSuffix: string;
  };
};

const en: UiCopy = {
  common: {
    backToInbox: "← Back to inbox",
  },
  calm: {
    errors: {
      title: "Something didn't come through",
      tryAgain: "Try again",
      showDetails: "Technical details",
    },
    empty: {
      manageable: "Everything looks manageable right now.",
      clearedNoise: "Handled cleared the noise.",
      noUnresolved: "No unresolved conversations at the moment.",
      nothingOverdue: "Nothing important appears overdue.",
      noBody: "The message body wasn't available — the thread is still here.",
      noTriageNotes: "Nothing extra to add for this one.",
    },
    loading: {
      openingEmail: "Opening this for you…",
      checkingInbox: "Checking for updates…",
    },
  },
  sections: {
    needsYourAttention: "Needs Your Attention",
    handledForYou: "Handled For You",
    hiddenInbox: "Hidden Inbox",
  },
  emailActions: {
    actionsTitle: "Actions",
    replyLanguageLabel: "Reply Language",
    generatingReplies: "Drafting your reply…",
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
    statusPreparing: "Getting your draft ready…",
    statusTimeoutFallback: "That took a moment — here's a draft you can use.",
    statusNetworkFallback: "Handled couldn't reach the server — here's a draft you can use.",
    statusInvalidJson: "Something interrupted the response — here's a draft you can use.",
    statusGenerateFailed: "Handled couldn't prepare a draft — here's one you can edit.",
    statusChooseReply: "Choose a reply.",
    statusUnexpectedFallback: "Something interrupted the request — here's a draft you can use.",
    statusCopyFailed: "Handled couldn't copy that — try selecting the text manually.",
    statusReminderSaved: "Reminder saved for later review.",
    statusIgnored: "Email ignored for now.",
    statusRefining: "Refining your selected reply...",
    statusRefineTimeout: "That took a moment — kept your draft as-is.",
    statusRefineNetwork: "Handled couldn't reach the server — your draft is unchanged.",
    statusRefineInvalidJson: "Something interrupted the response — your draft is unchanged.",
    statusRefineFailed: "Handled couldn't refine this — your draft is unchanged.",
    statusRefinedDone: "Draft updated — refine again anytime.",
    statusRefineUnexpected: "Something interrupted the request — your draft is unchanged.",
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
  identity: {
    title: "Your identity",
    description:
      "How Handled signs your replies — name, role, and sign-off so drafts sound like you.",
    displayNameLabel: "Display name",
    displayNameHelp: "Short name in sign-offs — e.g. Aisha",
    displayNamePlaceholder: "Aisha",
    fullNameLabel: "Full name",
    fullNamePlaceholder: "Aisha Surodjawan",
    businessTitleLabel: "Title",
    businessTitlePlaceholder: "Founder",
    companyNameLabel: "Company",
    companyNamePlaceholder: "Handled",
    communicationStyleLabel: "Communication style",
    communicationStyleHelp: "Overall voice for replies (works with the tone slider on each email).",
    communicationStyles: {
      balanced: "Balanced — professional but human",
      professional: "Professional — polished and clear",
      casual: "Casual — conversational and warm",
    },
    defaultSignOffLabel: "Default sign-off",
    defaultSignOffHelp: "Used at the end of generated replies unless you set a custom sign-off below.",
    customSignOffLabel: "Custom sign-off (optional)",
    customSignOffHelp: "Overrides the default template — e.g. Thanks, Aisha",
    customSignOffPlaceholder: "Thanks,\nAisha",
    signatureBlockLabel: "Full signature (optional)",
    signatureBlockHelp: "Used for formal or sales emails — e.g. name + title + company",
    signatureBlockPlaceholder: "Aisha Surodjawan\nFounder, Handled",
    includeSignOffLabel: "Include sign-off in generated replies",
    includeSignOffHelp: "When off, replies stay unsigned unless you add a signature manually.",
    previewLabel: "Sign-off preview",
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
    aiSummary: "Summary",
    fullEmailBody: "Full email body",
  },
  relationship: {
    assignTitle: "Who is this to you?",
    assignHint:
      "Handled adapts tone, priority, and reminders based on how you know this sender.",
    assignLink: "Set relationship",
    dismiss: "Not now",
    settingsTitle: "Sender relationships",
    settingsSubtitle:
      "Teach Handled who matters — family, school, VIP clients, and more.",
    emptySettings: "No relationships yet — mark senders from your inbox when you're ready.",
  },
  contextualSearch: {
    eyebrow: "Memory recall",
    sectionTitle: "Ask your inbox",
    sectionSubtitle:
      "Natural-language search across emails, follow-ups, relationships, and Brain.",
    inputLabel: "Search inbox memory",
    placeholder: "e.g. Did Chris reply about pricing?",
    filtersLabel: "Quick filters",
    answerLabel: "Handled found",
    resultsLabel: "Matching memory",
    noResults: "Nothing turned up — try different words or a filter.",
    hint: "Search commitments, people, school, invoices, or unresolved threads.",
    openEmail: "Open email",
  },
  dailyWorkspace: {
    eyebrow: "Daily workspace",
    sectionTitle: "Your day at a glance",
    sectionSubtitle:
      "What needs you, what is waiting, and what you can ignore — not an endless scroll.",
    calmDayMessage: "Everything looks manageable in focus right now.",
    emptySection: "Nothing needs you here — a calm sign.",
    openEmail: "Open",
    fullInboxHint: "Full inbox below when you want every message.",
  },
  dailyBriefing: {
    eyebrow: "Morning digest",
    sectionTitle: "Today's briefing",
    sectionSubtitle:
      "A calm overview of what matters — no alarms, no guilt, just clarity.",
    sectionCalmNote: "Nothing is sent or changed without your approval.",
    highlightsLabel: "At a glance",
    insightsLabel: "Insights",
    groupsLabel: "Grouped for you",
    openGroup: "Open",
    moreInGroup: "+{count} more",
  },
  followUp: {
    sectionTitle: "Follow-ups & memory",
    sectionSubtitle:
      "Calm reminders for open conversations — nothing urgent unless you want it to be.",
    sectionCalmNote: "Handled never sends follow-ups for you — only gentle suggestions.",
    emptyState: "No unresolved conversations at the moment.",
    atRiskTab: "Easy to forget",
    followUpsTab: "Follow-ups",
    waitingOnTab: "Waiting on",
    unresolvedTab: "Unresolved",
    pendingTab: "Pending",
    snoozeButton: "Snooze 3 days",
    dismissButton: "Dismiss",
    resolveButton: "Mark resolved",
    draftFollowUpButton: "Draft follow-up",
    draftFollowUpBusy: "Drafting…",
    copyDraftButton: "Copy draft",
    copiedDraft: "Copied",
    savedReminder: "Saved",
    snoozedReminder: "Snoozed",
    dismissedReminder: "Dismissed",
    resolvedReminder: "Resolved",
    intelligenceTitle: "From this thread",
    remindMeLater: "Remind me later",
    openEmail: "Open email",
    urgencyLabel: "Priority",
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
    organizingInbox: "Preparing your inbox…",
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
    allCaughtUp: "Everything looks manageable right now.",
    everythingHandledEmpty: "Handled cleared the noise.",
    comeBackLater: "New mail will show up when it arrives.",
    loadingMicroMessages: [
      "Preparing your inbox…",
      "Looking for what actually matters…",
      "Getting things organized…",
    ],
    inboxLoadingTitle: "Preparing your inbox…",
    emptyGmailInbox: "Your Gmail inbox is quiet — nothing to sort right now.",
    inboxErrorTitle: "Handled couldn't load your inbox",
    connectGmailTitle: "Connect Gmail when you're ready",
    connectGmailBody:
      "Sign in with Google so Handled can read your inbox calmly — read-only, nothing sends without you.",
    handledSectionEmpty: "Nothing queued here — Handled will surface suggestions when they help.",
    handledToday: "Handled Today",
    completedSuffix: "completed",
  },
};

const it: UiCopy = {
  common: {
    backToInbox: "← Torna alla inbox",
  },
  calm: {
    errors: {
      title: "Qualcosa non e arrivato",
      tryAgain: "Riprova",
      showDetails: "Dettagli tecnici",
    },
    empty: {
      manageable: "Tutto sembra gestibile adesso.",
      clearedNoise: "Handled ha filtrato il rumore.",
      noUnresolved: "Nessuna conversazione irrisolta al momento.",
      nothingOverdue: "Niente di importante sembra in ritardo.",
      noBody: "Il testo non era disponibile — il thread resta qui.",
      noTriageNotes: "Niente da aggiungere per questa.",
    },
    loading: {
      openingEmail: "La sto aprendo per te…",
      checkingInbox: "Controllo gli aggiornamenti…",
    },
  },
  sections: {
    needsYourAttention: "Richiedono attenzione",
    handledForYou: "Gestite per te",
    hiddenInbox: "Inbox nascosta",
  },
  emailActions: {
    actionsTitle: "Azioni",
    replyLanguageLabel: "Lingua della risposta",
    generatingReplies: "Sto preparando la bozza…",
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
    statusPreparing: "Preparo la bozza…",
    statusTimeoutFallback: "Ci ha messo un attimo — ecco una bozza da usare.",
    statusNetworkFallback:
      "Handled non ha raggiunto il server — ecco una bozza da usare.",
    statusInvalidJson:
      "Qualcosa ha interrotto la risposta — ecco una bozza da usare.",
    statusGenerateFailed:
      "Handled non ha preparato la bozza — ecco una bozza da modificare.",
    statusChooseReply: "Scegli una risposta.",
    statusUnexpectedFallback:
      "Qualcosa ha interrotto la richiesta — ecco una bozza da usare.",
    statusCopyFailed: "Handled non ha copiato — prova a selezionare il testo.",
    statusReminderSaved: "Promemoria salvato per dopo.",
    statusIgnored: "Email ignorata per ora.",
    statusRefining: "Sto migliorando la risposta selezionata...",
    statusRefineTimeout: "Ci ha messo un attimo — la bozza resta com'e.",
    statusRefineNetwork:
      "Handled non ha raggiunto il server — la bozza resta com'e.",
    statusRefineInvalidJson:
      "Qualcosa ha interrotto la risposta — la bozza resta com'e.",
    statusRefineFailed:
      "Handled non ha migliorato la bozza — resta com'e.",
    statusRefinedDone: "Bozza aggiornata — puoi rifinirla ancora.",
    statusRefineUnexpected:
      "Qualcosa ha interrotto la richiesta — la bozza resta com'e.",
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
  identity: {
    title: "La tua identita",
    description:
      "Come Handled firma le tue risposte — nome, ruolo e chiusura per bozze che suonano come te.",
    displayNameLabel: "Nome visualizzato",
    displayNameHelp: "Nome breve in firma — es. Aisha",
    displayNamePlaceholder: "Aisha",
    fullNameLabel: "Nome completo",
    fullNamePlaceholder: "Aisha Surodjawan",
    businessTitleLabel: "Ruolo",
    businessTitlePlaceholder: "Founder",
    companyNameLabel: "Azienda",
    companyNamePlaceholder: "Handled",
    communicationStyleLabel: "Stile di comunicazione",
    communicationStyleHelp: "Voce generale (si combina con il cursore tono su ogni email).",
    communicationStyles: {
      balanced: "Equilibrato — professionale ma umano",
      professional: "Professionale — curato e chiaro",
      casual: "Informale — conversazionale e caldo",
    },
    defaultSignOffLabel: "Chiusura predefinita",
    defaultSignOffHelp: "In fondo alle risposte generate, salvo chiusura personalizzata.",
    customSignOffLabel: "Chiusura personalizzata (opzionale)",
    customSignOffHelp: "Sostituisce il modello — es. Grazie, Aisha",
    customSignOffPlaceholder: "Grazie,\nAisha",
    signatureBlockLabel: "Firma completa (opzionale)",
    signatureBlockHelp: "Per email formali o commerciali",
    signatureBlockPlaceholder: "Aisha Surodjawan\nFounder, Handled",
    includeSignOffLabel: "Includi firma nelle risposte generate",
    includeSignOffHelp: "Se disattivato, le bozze restano senza firma.",
    previewLabel: "Anteprima firma",
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
    aiSummary: "Riepilogo",
    fullEmailBody: "Testo completo dell'email",
  },
  relationship: {
    assignTitle: "Chi e per te?",
    assignHint:
      "Handled adatta tono, priorita e promemoria in base a come conosci questo mittente.",
    assignLink: "Imposta relazione",
    dismiss: "Non ora",
    settingsTitle: "Relazioni con i mittenti",
    settingsSubtitle:
      "Insegna a Handled chi conta — famiglia, scuola, clienti VIP e altro.",
    emptySettings:
      "Nessuna relazione ancora — segna i mittenti dalla inbox quando vuoi.",
  },
  contextualSearch: {
    eyebrow: "Memoria",
    sectionTitle: "Chiedi alla inbox",
    sectionSubtitle:
      "Ricerca in linguaggio naturale su email, follow-up, relazioni e Brain.",
    inputLabel: "Cerca nella memoria inbox",
    placeholder: "es. Chris ha risposto sul pricing?",
    filtersLabel: "Filtri rapidi",
    answerLabel: "Handled ha trovato",
    resultsLabel: "Risultati",
    noResults: "Nessun risultato — prova altre parole o un filtro.",
    hint: "Cerca impegni, persone, scuola, fatture o thread aperti.",
    openEmail: "Apri email",
  },
  dailyWorkspace: {
    eyebrow: "Workspace giornaliero",
    sectionTitle: "La tua giornata",
    sectionSubtitle:
      "Cosa richiede te, cosa e in attesa e cosa puoi ignorare — non uno scroll infinito.",
    calmDayMessage: "In focus tutto sembra gestibile adesso.",
    emptySection: "Qui non serve nulla — buon segno.",
    openEmail: "Apri",
    fullInboxHint: "Inbox completa sotto, quando ti serve ogni messaggio.",
  },
  dailyBriefing: {
    eyebrow: "Digest del mattino",
    sectionTitle: "Briefing di oggi",
    sectionSubtitle:
      "Panoramica calma di cosa conta — niente allarmi, niente sensi di colpa.",
    sectionCalmNote: "Nulla viene inviato o modificato senza la tua approvazione.",
    highlightsLabel: "In sintesi",
    insightsLabel: "Osservazioni",
    groupsLabel: "Raggruppati per te",
    openGroup: "Apri",
    moreInGroup: "+{count} altre",
  },
  followUp: {
    sectionTitle: "Follow-up e memoria",
    sectionSubtitle:
      "Promemoria calmi per conversazioni aperte — niente urgenza artificiale.",
    sectionCalmNote: "Handled non invia mai follow-up al posto tuo — solo suggerimenti.",
    emptyState: "Nessuna conversazione irrisolta al momento.",
    atRiskTab: "Da non dimenticare",
    followUpsTab: "Follow-up",
    waitingOnTab: "In attesa",
    unresolvedTab: "Aperte",
    pendingTab: "In sospeso",
    snoozeButton: "Posticipa 3 giorni",
    dismissButton: "Nascondi",
    resolveButton: "Segna risolto",
    draftFollowUpButton: "Bozza follow-up",
    draftFollowUpBusy: "Sto scrivendo…",
    copyDraftButton: "Copia bozza",
    copiedDraft: "Copiata",
    savedReminder: "Salvato",
    snoozedReminder: "Posticipato",
    dismissedReminder: "Nascosto",
    resolvedReminder: "Risolto",
    intelligenceTitle: "Da questo thread",
    remindMeLater: "Ricordamelo dopo",
    openEmail: "Apri email",
    urgencyLabel: "Priorita",
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
    organizingInbox: "Preparo la tua inbox…",
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
    allCaughtUp: "Tutto sembra gestibile adesso.",
    everythingHandledEmpty: "Handled ha filtrato il rumore.",
    comeBackLater: "Le nuove email compariranno quando arrivano.",
    loadingMicroMessages: [
      "Preparo la tua inbox…",
      "Cerco cio che conta davvero…",
      "Metto tutto in ordine…",
    ],
    inboxLoadingTitle: "Preparo la tua inbox…",
    emptyGmailInbox: "La tua Gmail e tranquilla — niente da ordinare ora.",
    inboxErrorTitle: "Handled non ha caricato la inbox",
    connectGmailTitle: "Collega Gmail quando vuoi",
    connectGmailBody:
      "Accedi con Google cosi Handled legge la inbox con calma — solo lettura, nulla parte senza di te.",
    handledSectionEmpty:
      "Niente in coda — Handled suggerira quando puo aiutare.",
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
