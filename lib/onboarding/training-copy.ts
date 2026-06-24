import type { GuidedOnboardingStep } from "@/lib/onboarding/guided-steps";
import { voiceOnboardingHeadline } from "@/lib/voice";

export type TrainingLocale = "en" | "it";

type TrainingStepCopy = {
  prompt: string;
  explanation: string;
  addToCategory: string;
  showMore: string;
  skip: string;
  continue: string;
  remaining: (n: number) => string;
  classified: (n: number) => string;
  waitingForMail: string;
  emptyInbox: string;
  suggestion: (label: string) => string;
};

export const CATEGORY_TRAINING_COPY: Record<
  TrainingLocale,
  {
    headline: string;
    intro: {
      prompt: string;
      body: string;
      continue: string;
      skip: string;
    };
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
    worth_your_attention: TrainingStepCopy;
    good_to_know: TrainingStepCopy;
    promotions: TrainingStepCopy;
    newsletters: TrainingStepCopy;
    release: {
      title: string;
      body: string;
      cta: string;
    };
    transitions: Partial<Record<GuidedOnboardingStep, string>>;
  }
> = {
  en: {
    headline: voiceOnboardingHeadline("en"),
    intro: {
      prompt: "We'll organize your inbox together.",
      body: "You'll teach Handled how you sort email — one category at a time. Nothing is pre-sorted; you decide.",
      continue: "Let's start",
      skip: "Skip for now",
    },
    connect: {
      prompt: "First, connect the inbox you want to organize.",
      body: "Handled reads metadata only — sender, subject, and snippet — to suggest examples. You choose every category.",
      connectGmail: "Connect Gmail",
      connected: "Gmail connected",
      continue: "Continue",
      secondInbox: "Add another inbox",
      secondInboxLocked: "Coming soon",
      connecting: "Opening Google…",
      checkingConnection: "Checking connection…",
    },
    worth_your_attention: {
      prompt: "Worth your attention",
      explanation: "Emails you should actively care about or respond to.",
      addToCategory: "Belongs here",
      showMore: "Show more examples",
      skip: "Skip this step",
      continue: "Continue",
      remaining: (n) =>
        n === 1 ? "1 email still unclassified" : `${n} emails still unclassified`,
      classified: (n) =>
        n === 1 ? "1 sender added to this category" : `${n} senders added to this category`,
      waitingForMail: "Loading examples from your inbox…",
      emptyInbox: "Your inbox looks empty — you can skip and finish setup.",
      suggestion: (label) => `Suggestion: ${label}`,
    },
    good_to_know: {
      prompt: "Good to know",
      explanation: "Useful updates, but no immediate action needed.",
      addToCategory: "Belongs here",
      showMore: "Show more examples",
      skip: "Skip this step",
      continue: "Continue",
      remaining: (n) =>
        n === 1 ? "1 email still unclassified" : `${n} emails still unclassified`,
      classified: (n) =>
        n === 1 ? "1 sender added to this category" : `${n} senders added to this category`,
      waitingForMail: "Loading more examples…",
      emptyInbox: "No remaining examples — continue when ready.",
      suggestion: (label) => `Suggestion: ${label}`,
    },
    promotions: {
      prompt: "Promotions",
      explanation: "Marketing, deals, and sales emails.",
      addToCategory: "Belongs here",
      showMore: "Show more examples",
      skip: "Skip this step",
      continue: "Continue",
      remaining: (n) =>
        n === 1 ? "1 email still unclassified" : `${n} emails still unclassified`,
      classified: (n) =>
        n === 1 ? "1 sender added to this category" : `${n} senders added to this category`,
      waitingForMail: "Loading more examples…",
      emptyInbox: "No remaining examples — continue when ready.",
      suggestion: (label) => `Suggestion: ${label}`,
    },
    newsletters: {
      prompt: "Newsletters",
      explanation: "Recurring digests and subscription content.",
      addToCategory: "Belongs here",
      showMore: "Show more examples",
      skip: "Skip this step",
      continue: "Continue",
      remaining: (n) =>
        n === 1 ? "1 email still unclassified" : `${n} emails still unclassified`,
      classified: (n) =>
        n === 1 ? "1 sender added to this category" : `${n} senders added to this category`,
      waitingForMail: "Loading more examples…",
      emptyInbox: "No remaining examples — continue when ready.",
      suggestion: (label) => `Suggestion: ${label}`,
    },
    release: {
      title: "Your inbox is ready.",
      body: "Handled will use what you taught it. You can always adjust categories later.",
      cta: "Open my inbox",
    },
    transitions: {
      intro: "Great — let's teach Handled your categories.",
      train_worth_your_attention: "Start with what deserves your attention.",
      train_good_to_know: "Next: updates that are useful but not urgent.",
      train_promotions: "Now let's sort marketing and deals.",
      train_newsletters: "Last step: recurring newsletters and digests.",
      release: "All set — opening your inbox.",
    },
  },
  it: {
    headline: voiceOnboardingHeadline("it"),
    intro: {
      prompt: "Organizziamo la tua inbox insieme.",
      body: "Insegnerai a Handled come classifichi le email — una categoria alla volta. Niente è pre-assegnato: decidi tu.",
      continue: "Iniziamo",
      skip: "Salta per ora",
    },
    connect: {
      prompt: "Per prima cosa, collega l'inbox da organizzare.",
      body: "Handled legge solo metadati — mittente, oggetto e anteprima — per suggerire esempi. Scegli tu ogni categoria.",
      connectGmail: "Collega Gmail",
      connected: "Gmail collegato",
      continue: "Continua",
      secondInbox: "Aggiungi un'altra inbox",
      secondInboxLocked: "In arrivo",
      connecting: "Apro Google…",
      checkingConnection: "Verifico la connessione…",
    },
    worth_your_attention: {
      prompt: "Da tenere d'occhio",
      explanation: "Email a cui prestare attenzione o a cui rispondere.",
      addToCategory: "Appartiene qui",
      showMore: "Mostra altri esempi",
      skip: "Salta questo passaggio",
      continue: "Continua",
      remaining: (n) =>
        n === 1 ? "1 email ancora da classificare" : `${n} email ancora da classificare`,
      classified: (n) =>
        n === 1 ? "1 mittente aggiunto a questa categoria" : `${n} mittenti aggiunti a questa categoria`,
      waitingForMail: "Carico esempi dalla tua inbox…",
      emptyInbox: "La inbox sembra vuota — puoi saltare e finire la configurazione.",
      suggestion: (label) => `Suggerimento: ${label}`,
    },
    good_to_know: {
      prompt: "Buono a sapersi",
      explanation: "Aggiornamenti utili, senza azione immediata.",
      addToCategory: "Appartiene qui",
      showMore: "Mostra altri esempi",
      skip: "Salta questo passaggio",
      continue: "Continua",
      remaining: (n) =>
        n === 1 ? "1 email ancora da classificare" : `${n} email ancora da classificare`,
      classified: (n) =>
        n === 1 ? "1 mittente aggiunto a questa categoria" : `${n} mittenti aggiunti a questa categoria`,
      waitingForMail: "Carico altri esempi…",
      emptyInbox: "Nessun esempio rimasto — continua quando vuoi.",
      suggestion: (label) => `Suggerimento: ${label}`,
    },
    promotions: {
      prompt: "Promozioni",
      explanation: "Marketing, offerte e email promozionali.",
      addToCategory: "Appartiene qui",
      showMore: "Mostra altri esempi",
      skip: "Salta questo passaggio",
      continue: "Continua",
      remaining: (n) =>
        n === 1 ? "1 email ancora da classificare" : `${n} email ancora da classificare`,
      classified: (n) =>
        n === 1 ? "1 mittente aggiunto a questa categoria" : `${n} mittenti aggiunti a questa categoria`,
      waitingForMail: "Carico altri esempi…",
      emptyInbox: "Nessun esempio rimasto — continua quando vuoi.",
      suggestion: (label) => `Suggerimento: ${label}`,
    },
    newsletters: {
      prompt: "Newsletter",
      explanation: "Digest ricorrenti e contenuti in abbonamento.",
      addToCategory: "Appartiene qui",
      showMore: "Mostra altri esempi",
      skip: "Salta questo passaggio",
      continue: "Continua",
      remaining: (n) =>
        n === 1 ? "1 email ancora da classificare" : `${n} email ancora da classificare`,
      classified: (n) =>
        n === 1 ? "1 mittente aggiunto a questa categoria" : `${n} mittenti aggiunti a questa categoria`,
      waitingForMail: "Carico altri esempi…",
      emptyInbox: "Nessun esempio rimasto — continua quando vuoi.",
      suggestion: (label) => `Suggerimento: ${label}`,
    },
    release: {
      title: "La tua inbox è pronta.",
      body: "Handled userà ciò che gli hai insegnato. Potrai sempre modificare le categorie.",
      cta: "Apri la mia inbox",
    },
    transitions: {
      intro: "Perfetto — insegniamo a Handled le tue categorie.",
      train_worth_your_attention: "Iniziamo da ciò che merita attenzione.",
      train_good_to_know: "Poi: aggiornamenti utili ma non urgenti.",
      train_promotions: "Ora ordiniamo marketing e offerte.",
      train_newsletters: "Ultimo passaggio: newsletter e digest ricorrenti.",
      release: "Tutto pronto — apro la tua inbox.",
    },
  },
};

export function trainingStepCopyKey(
  step: "train_worth_your_attention" | "train_good_to_know" | "train_promotions" | "train_newsletters",
): "worth_your_attention" | "good_to_know" | "promotions" | "newsletters" {
  return step.replace("train_", "") as
    | "worth_your_attention"
    | "good_to_know"
    | "promotions"
    | "newsletters";
}
