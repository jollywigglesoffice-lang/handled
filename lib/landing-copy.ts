import type { AppUiLanguage } from "@/app/user-preferences-context";

export type LandingLocale = AppUiLanguage;

export type LandingCopy = {
  continueWithGoogle: string;
  connecting: string;
  seeHowItWorks: string;
  heroTitle: string;
  heroSubtitle: string;
  heroTagline: string;
  heroTaglineAccent: string;
  heroBody: string;
  quoteLine1: string;
  quoteLine2: string;
  howItWorks: string;
  footerTagline: string;
  workflows: Array<{ id: string; title: string; steps: string[] }>;
  transformation: {
    beforeTitle: string;
    afterTitle: string;
    before: string[];
    after: string[];
  };
  socialProof: string[];
  completedCounterLabel: string;
  journey: {
    today: string;
    clearingInbox: string;
    clearingStats: (handled: number, waiting: number) => string;
    inboxZero: string;
    handled: string;
    waitingOnSomeone: string;
    mentalClutter: string;
    categories: Array<{ key: string; label: string }>;
    previewEmails: string[];
  };
};

const copy = {
  en: {
    continueWithGoogle: "Continue with Google",
    connecting: "Connecting…",
    seeHowItWorks: "See how it works",
    heroTitle: "Email that remembers.",
    heroSubtitle: "The best email is the one you never have to think about again.",
    heroTagline: "Stop organizing email.",
    heroTaglineAccent: "Start finishing it.",
    heroBody:
      "Handled helps you finish email in minutes, not hours — with categories you control and AI that learns what you actually do with each message.",
    quoteLine1: "Most email tools organize messages.",
    quoteLine2: "Handled learns what you do with them.",
    howItWorks: "How it works",
    footerTagline: "Finish email. Don't manage it.",
    workflows: [
      {
        id: "school",
        title: "School Email",
        steps: ["Worth your attention", "Done with this", "Saved for reference"],
      },
      {
        id: "accountant",
        title: "Accountant",
        steps: ["Waiting on reply", "Waiting 7 days", "Response received"],
      },
      {
        id: "travel",
        title: "Travel Confirmation",
        steps: ["Suggested action", "Save for reference", "One click", "Handled"],
      },
    ],
    transformation: {
      beforeTitle: "Before Handled",
      afterTitle: "After Handled",
      before: [
        "Thousands of unread emails",
        "Constant re-reading",
        "Forgotten follow-ups",
        "Mental clutter",
      ],
      after: [
        "Inbox Zero workflow",
        "Waiting tracked quietly",
        "Handled history",
        "Clear next actions",
      ],
    },
    socialProof: [
      "Users are reaching Inbox Zero faster.",
      "Most users finish email in one sitting.",
      "The average handled email never needs to be seen again.",
    ],
    completedCounterLabel: "Emails handled with Handled",
    journey: {
      today: "Today",
      clearingInbox: "Clearing inbox…",
      clearingStats: (handled: number, waiting: number) =>
        `${handled} handled · ${waiting} waiting on someone`,
      inboxZero: "Inbox Zero",
      handled: "handled",
      waitingOnSomeone: "waiting on someone",
      mentalClutter: "Mental clutter",
      categories: [
        { key: "attention", label: "Worth your attention" },
        { key: "good_to_know", label: "Good to know" },
        { key: "promotions", label: "Promotions" },
        { key: "newsletters", label: "Newsletters" },
      ],
      previewEmails: [
        "Stripe — Invoice due Friday",
        "Parent council — Field trip form",
      ],
    },
  },
  it: {
    continueWithGoogle: "Continua con Google",
    connecting: "Connessione…",
    seeHowItWorks: "Scopri come funziona",
    heroTitle: "Email che ricorda.",
    heroSubtitle: "La migliore email è quella a cui non devi più pensare.",
    heroTagline: "Smetti di organizzare le email.",
    heroTaglineAccent: "Inizia a chiuderle.",
    heroBody:
      "Handled ti aiuta a finire le email in minuti, non ore — con categorie che controlli tu e un'AI che impara cosa fai davvero con ogni messaggio.",
    quoteLine1: "La maggior parte degli strumenti organizza i messaggi.",
    quoteLine2: "Handled impara cosa ne fai.",
    howItWorks: "Come funziona",
    footerTagline: "Finisci le email. Non gestirle.",
    workflows: [
      {
        id: "school",
        title: "Email scuola",
        steps: ["Da vedere", "Fatto con questa", "Salvata per riferimento"],
      },
      {
        id: "accountant",
        title: "Commercialista",
        steps: ["In attesa di risposta", "In attesa da 7 giorni", "Risposta ricevuta"],
      },
      {
        id: "travel",
        title: "Conferma viaggio",
        steps: ["Azione suggerita", "Salva per riferimento", "Un clic", "Gestita"],
      },
    ],
    transformation: {
      beforeTitle: "Prima di Handled",
      afterTitle: "Dopo Handled",
      before: [
        "Migliaia di email non lette",
        "Riletture continue",
        "Follow-up dimenticati",
        "Caos mentale",
      ],
      after: [
        "Flusso Inbox Zero",
        "Attese tracciate in silenzio",
        "Cronologia gestite",
        "Prossime azioni chiare",
      ],
    },
    socialProof: [
      "Gli utenti raggiungono Inbox Zero più in fretta.",
      "La maggior parte finisce le email in una sessione.",
      "In media, un'email gestita non va più rivista.",
    ],
    completedCounterLabel: "Email gestite con Handled",
    journey: {
      today: "Oggi",
      clearingInbox: "Svuotamento inbox…",
      clearingStats: (handled: number, waiting: number) =>
        `${handled} gestite · ${waiting} in attesa di qualcuno`,
      inboxZero: "Inbox Zero",
      handled: "gestite",
      waitingOnSomeone: "in attesa di qualcuno",
      mentalClutter: "Caos mentale",
      categories: [
        { key: "attention", label: "Da vedere" },
        { key: "good_to_know", label: "Da sapere" },
        { key: "promotions", label: "Promozioni" },
        { key: "newsletters", label: "Newsletter" },
      ],
      previewEmails: [
        "Stripe — Fattura entro venerdì",
        "Consiglio genitori — Modulo gita",
      ],
    },
  },
} satisfies Record<LandingLocale, LandingCopy>;

export function getLandingCopy(locale: LandingLocale): LandingCopy {
  return copy[locale] ?? copy.en;
}
