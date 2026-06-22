import type { AppUiLanguage } from "@/app/user-preferences-context";
import {
  calmEmptyMessages,
  calmLoadingMessages,
  calmRetryLabel,
} from "@/lib/calm-system-copy";
import { voiceErrorTitle, voiceTryAgainLabel } from "@/lib/voice";

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
  auth: {
    signIn: string;
    signOut: string;
    continueWithGoogle: string;
    connecting: string;
    redirecting: string;
    welcomeTagline: string;
    signInTitle: string;
    signUpTitle: string;
    betaTitle: string;
    betaSubtitle: string;
    fullSubtitle: string;
    safetyNote: string;
    orDivider: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    pleaseWait: string;
    signInButton: string;
    createAccountButton: string;
    needAccount: string;
    haveAccount: string;
    enterEmailPassword: string;
    oauthFailed: string;
    oauthIncomplete: string;
    authConnectFailed: string;
    signupSuccess: string;
    confirmedTitle: string;
    confirmedBody: string;
    confirmedHint: string;
    confirmedCta: string;
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
    inboxTagline: string;
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
      title: voiceErrorTitle("generic", "en"),
      tryAgain: voiceTryAgainLabel("en"),
      showDetails: "Technical details",
    },
    empty: {
      manageable: calmEmptyMessages("en")[2]!,
      clearedNoise: "The rest is set aside for later.",
      noUnresolved: calmEmptyMessages("en")[0]!,
      nothingOverdue: calmEmptyMessages("en")[2]!,
      noBody: "The message body wasn't available — the thread is still here.",
      noTriageNotes: "Nothing extra to add for this one.",
    },
    loading: {
      openingEmail: "Opening this for you…",
      checkingInbox: "Listening for new messages…",
    },
  },
  sections: {
    needsYourAttention: "Worth your attention",
    handledForYou: "Set aside",
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
    sendSuccess: "Reply sent.",
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
    answerLabel: "Found",
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
    sectionTitle: "Open conversations",
    sectionSubtitle:
      "Gentle reminders for threads still open — only when you want them.",
    sectionCalmNote: "Nothing sends on your behalf — only quiet suggestions.",
    emptyState: "No unresolved conversations at the moment.",
    atRiskTab: "Easy to forget",
    followUpsTab: "Follow-ups",
    waitingOnTab: "Waiting on",
    unresolvedTab: "Unresolved",
    pendingTab: "Still open",
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
  auth: {
    signIn: "Sign in",
    signOut: "Log out",
    continueWithGoogle: "Continue with Google",
    connecting: "Connecting…",
    redirecting: "Redirecting…",
    welcomeTagline: "Handled helps you finish email in minutes, not hours.",
    signInTitle: "Sign in to continue",
    signUpTitle: "Create your account",
    betaTitle: "Get through email faster",
    betaSubtitle: "Sign in with Google and your inbox loads immediately.",
    fullSubtitle: "Save your replies, preferences, usage, and Pro access across devices.",
    safetyNote:
      "🔒 Handled helps draft replies, but never sends emails without your approval.",
    orDivider: "or",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    pleaseWait: "Please wait...",
    signInButton: "Sign in",
    createAccountButton: "Create account",
    needAccount: "Need an account? Create one",
    haveAccount: "Already have an account? Sign in",
    enterEmailPassword: "Enter your email and password.",
    oauthFailed: "Could not start Google sign-in. Please try again.",
    oauthIncomplete: "Google sign-in didn’t complete. Please try again.",
    authConnectFailed: "Could not connect to authentication. Please refresh and try again.",
    signupSuccess:
      "Account created! Please check your email to confirm your account. After confirming, come back here and sign in.",
    confirmedTitle: "Email confirmed",
    confirmedBody: "Your account is ready. Please return to Handled and sign in to continue.",
    confirmedHint:
      "Handled helps you write better replies faster while keeping you in control.",
    confirmedCta: "Go back to Handled",
  },
  home: {
    appLanguageLabel: "App Language",
    appLanguageEnglish: "English",
    appLanguageItalian: "Italiano",
    onboardingLine1: "Paste an email or select one below.",
    onboardingLine2:
      "Generate a reply, edit it, and copy it into your email app.",
    dismiss: "Dismiss",
    organizingInbox: calmLoadingMessages("en")[0]!,
    todayTitle: "Today",
    attentionCountSingle: "conversation may need you",
    attentionCountPlural: "conversations may need you",
    everythingHandled: "Everything else is handled",
    brandTag: "Handled",
    settingsButton: "Settings",
    quickTopLine: "A calmer read on your inbox",
    heroTitle: "Your inbox… Handled",
    inboxTagline: "Everything is here. Handled quietly helps you focus.",
    heroDescription:
      "See what may need you, what is already quiet, and what can stay out of sight for now.",
    allCaughtUp: calmEmptyMessages("en")[2]!,
    everythingHandledEmpty: "The rest is set aside for later.",
    comeBackLater: "New mail will show up when it arrives.",
    loadingMicroMessages: calmLoadingMessages("en"),
    inboxLoadingTitle: calmLoadingMessages("en")[0]!,
    emptyGmailInbox: calmEmptyMessages("en")[1]!,
    inboxErrorTitle: "Your inbox isn't reachable just now",
    connectGmailTitle: "Add your first inbox",
    connectGmailBody:
      "Sign in with Google once. After that, attach more inboxes anytime — no extra logins.",
    handledSectionEmpty: "Nothing queued here — suggestions appear when they help.",
    handledToday: "Today",
    completedSuffix: "completed",
  },
};

const it: UiCopy = {
  common: {
    backToInbox: "← Torna alla inbox",
  },
  calm: {
    errors: {
      title: voiceErrorTitle("generic", "it"),
      tryAgain: voiceTryAgainLabel("it"),
      showDetails: "Dettagli tecnici",
    },
    empty: {
      manageable: calmEmptyMessages("it")[2]!,
      clearedNoise: "Il resto è messo da parte per dopo.",
      noUnresolved: calmEmptyMessages("it")[0]!,
      nothingOverdue: calmEmptyMessages("it")[2]!,
      noBody: "Il testo non era disponibile — il thread resta qui.",
      noTriageNotes: "Niente da aggiungere per questa.",
    },
    loading: {
      openingEmail: "La sto aprendo per te…",
      checkingInbox: "Ascolto i nuovi messaggi…",
    },
  },
  sections: {
    needsYourAttention: "Da vedere",
    handledForYou: "Messi da parte",
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
    sendSuccess: "Risposta inviata.",
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
    answerLabel: "Trovato",
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
    sectionTitle: "Conversazioni aperte",
    sectionSubtitle:
      "Promemoria leggeri per thread ancora aperti — solo quando vuoi.",
    sectionCalmNote: "Niente parte senza di te — solo suggerimenti quieti.",
    emptyState: "Nessuna conversazione irrisolta al momento.",
    atRiskTab: "Da non dimenticare",
    followUpsTab: "Follow-up",
    waitingOnTab: "In attesa",
    unresolvedTab: "Aperte",
    pendingTab: "Ancora aperti",
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
  auth: {
    signIn: "Accedi",
    signOut: "Esci",
    continueWithGoogle: "Continua con Google",
    connecting: "Connessione…",
    redirecting: "Reindirizzamento…",
    welcomeTagline: "Handled ti aiuta a finire le email in minuti, non ore.",
    signInTitle: "Accedi per continuare",
    signUpTitle: "Crea il tuo account",
    betaTitle: "Finisci le email più in fretta",
    betaSubtitle: "Accedi con Google e la inbox si carica subito.",
    fullSubtitle:
      "Salva risposte, preferenze, utilizzo e accesso Pro su tutti i dispositivi.",
    safetyNote:
      "🔒 Handled prepara bozze, ma non invia email senza la tua approvazione.",
    orDivider: "oppure",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    showPassword: "Mostra password",
    hidePassword: "Nascondi password",
    pleaseWait: "Attendi...",
    signInButton: "Accedi",
    createAccountButton: "Crea account",
    needAccount: "Non hai un account? Creane uno",
    haveAccount: "Hai già un account? Accedi",
    enterEmailPassword: "Inserisci email e password.",
    oauthFailed: "Impossibile avviare l'accesso con Google. Riprova.",
    oauthIncomplete: "Accesso Google non completato. Riprova.",
    authConnectFailed:
      "Impossibile connettersi all'autenticazione. Aggiorna la pagina e riprova.",
    signupSuccess:
      "Account creato! Controlla la email per confermare. Poi torna qui e accedi.",
    confirmedTitle: "Email confermata",
    confirmedBody:
      "Il tuo account è pronto. Torna su Handled e accedi per continuare.",
    confirmedHint:
      "Handled ti aiuta a scrivere risposte migliori più in fretta, sempre sotto il tuo controllo.",
    confirmedCta: "Torna su Handled",
  },
  home: {
    appLanguageLabel: "Lingua app",
    appLanguageEnglish: "English",
    appLanguageItalian: "Italiano",
    onboardingLine1: "Incolla una email o selezionane una qui sotto.",
    onboardingLine2:
      "Genera una risposta, modificala e copiala nella tua app email.",
    dismiss: "Chiudi",
    organizingInbox: calmLoadingMessages("it")[0]!,
    todayTitle: "Oggi",
    attentionCountSingle: "conversazione potrebbe richiederti",
    attentionCountPlural: "conversazioni potrebbero richiederti",
    everythingHandled: "Tutto il resto e gestito",
    brandTag: "Handled",
    settingsButton: "Impostazioni",
    quickTopLine: "Gestisci le email in pochi secondi",
    heroTitle: "La tua inbox… Gestita",
    inboxTagline: "Tutto è qui. Handled ti aiuta a focalizzarti, con calma.",
    heroDescription:
      "Uno spazio calmo per vedere cosa richiede attenzione, cosa e gia stato gestito e cosa puo restare fuori vista.",
    allCaughtUp: calmEmptyMessages("it")[2]!,
    everythingHandledEmpty: "Il resto è messo da parte per dopo.",
    comeBackLater: "Le nuove email compariranno quando arrivano.",
    loadingMicroMessages: calmLoadingMessages("it"),
    inboxLoadingTitle: calmLoadingMessages("it")[0]!,
    emptyGmailInbox: calmEmptyMessages("it")[1]!,
    inboxErrorTitle: "La inbox non è raggiungibile adesso",
    connectGmailTitle: "Aggiungi la prima inbox",
    connectGmailBody:
      "Accedi con Google una volta. Poi allega altre inbox quando vuoi — senza altri login.",
    handledSectionEmpty:
      "Niente in coda — i suggerimenti compaiono quando servono.",
    handledToday: "Oggi",
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
