"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import {
  OnboardingEmailCard,
  type OnboardingEmailCardHandle,
} from "@/app/emails/inbox-onboarding-flow";
import { LiveProcessingPanel } from "@/app/onboarding/live-processing-panel";
import { useFirstActionLiveReveal } from "@/app/onboarding/use-first-action-live-reveal";
import {
  EmotionalContextLine,
  EmotionalFallbackPanel,
  MicroReassuranceLine,
} from "@/app/onboarding/emotional-guidance-lines";
import {
  EMOTIONAL_FALLBACK,
  pickMicroReassurance,
  resolveOnboardingEmotionalContext,
  shouldShowMicroReassurance,
} from "@/lib/onboarding/emotional-guidance";
import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";
import {
  buildOnboardingSenderCandidates,
  type SenderCandidate,
} from "@/lib/onboarding/build-sender-candidates";
import {
  buildFirstTimeOnboardingQueue,
  MIN_ONBOARDING_EXAMPLES,
  needsMoreOnboardingExamples,
} from "@/lib/onboarding/build-queue";
import {
  GUIDED_ONBOARDING_STEPS,
  type GuidedOnboardingStep,
  stepNumber,
} from "@/lib/onboarding/guided-steps";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";
import {
  loadClientSenderPreferences,
  mergeSenderPreferences,
  preferenceFromSender,
  saveClientSenderPreferences,
} from "@/lib/inbox-sender-preferences";
import { useMemoryCollect } from "@/app/hooks/use-memory-collect";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import { trackEvent } from "@/lib/analytics";

export type GuidedOnboardingFlowProps = {
  locale: "en" | "it";
  inboxMode: "loading" | "no_google" | "gmail" | "gmail_empty" | "gmail_error";
  signedIn: boolean;
  connectedAccountCount: number;
  messages: GmailCardMessage[];
  readStateMap: ReadStateMap;
  isCompleted: (id: string) => boolean;
  onFinished: () => void;
  /** Broaden inbox fetch when Step 3 needs more example emails. */
  onFetchMoreExamples?: () => Promise<void>;
};

const COPY = {
  en: {
    headline: "Let's set up your inbox in 60 seconds",
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    connect: {
      title: "Connect your inbox",
      body: "Handled works on top of Gmail — your mail stays yours.",
      connectGmail: "Connect Gmail",
      connected: "Gmail connected",
      continue: "Continue",
      secondInbox: "Add second inbox",
      secondInboxLocked: "Pro — add another inbox later",
      connecting: "Connecting…",
      checkingConnection: "Checking your Gmail connection…",
    },
    preferences: {
      title: "Tell Handled what matters to you",
      subtitle: "Optional — pick anyone you never want to miss, or skip and teach Handled later.",
      importantHint: "Tap senders that matter (optional)",
      promoHint: "Optional: senders to de-prioritize",
      importantCount: (n: number) =>
        n === 0 ? "No one selected yet" : `${n} selected`,
      promoCount: (n: number) =>
        n === 0 ? "None de-prioritized" : `${n} de-prioritized`,
      continue: "Continue",
      skip: "Skip for now",
      noneOfThese: "None of these matter",
      showDifferent: "Show me different suggestions",
      waitingForMail: "Pulling senders from your inbox…",
      emptyInboxSkip: "Your inbox is empty — skip for now and add senders later.",
      clusterShowing: (label: string) => `Showing: ${label}`,
    },
    firstAction: {
      title: "Handle your first email",
      hint: "Handled is here to help you breathe through your inbox — one gentle step at a time.",
      reply: "Reply",
      done: "Done",
      fetchingMore: "Not enough signals — fetching more examples…",
      noEmailTitle: "No examples loaded yet",
      noEmailBody: "Refresh to pull more from your inbox, or skip and explore on your own.",
      refreshExamples: "Refresh",
      skipStep: "Skip step",
      useWhatIHave: "Use what I have",
      exampleCount: (n: number) =>
        n === 1 ? "1 example ready" : `${n} examples ready`,
      resultLabel: "Suggested starting email",
    },
    personalize: {
      title: "How should Handled treat this sender?",
      body: (sender: string) => `Emails from ${sender}`,
      save: "Save & continue",
    },
    release: {
      title: "You're ready for your full inbox 🎉",
      body: "Categories, Focus Mode, and smart suggestions are unlocked.",
      cta: "Go to my inbox",
    },
    categories: {
      worth_your_attention: "Needs my attention",
      good_to_know: "Good to know",
      promotions: "Promotions",
      newsletters: "Newsletters",
    } as Record<string, string>,
  },
  it: {
    headline: "Configura la inbox in 60 secondi",
    stepOf: (n: number, total: number) => `Passo ${n} di ${total}`,
    connect: {
      title: "Collega la tua inbox",
      body: "Handled lavora su Gmail — la posta resta tua.",
      connectGmail: "Collega Gmail",
      connected: "Gmail collegato",
      continue: "Continua",
      secondInbox: "Aggiungi seconda inbox",
      secondInboxLocked: "Pro — aggiungi un'altra inbox dopo",
      connecting: "Connessione…",
      checkingConnection: "Verifica connessione Gmail…",
    },
    preferences: {
      title: "Dì a Handled cosa conta per te",
      subtitle: "Facoltativo — scegli chi non vuoi perdere, oppure salta e insegna dopo.",
      importantHint: "Tocca i mittenti che contano (facoltativo)",
      promoHint: "Facoltativo: mittenti da deprioritizzare",
      importantCount: (n: number) =>
        n === 0 ? "Nessuno selezionato" : `${n} selezionati`,
      promoCount: (n: number) =>
        n === 0 ? "Nessuno deprioritizzato" : `${n} deprioritizzati`,
      continue: "Continua",
      skip: "Salta per ora",
      noneOfThese: "Nessuno di questi conta",
      showDifferent: "Mostrami altri suggerimenti",
      waitingForMail: "Recupero mittenti dalla inbox…",
      emptyInboxSkip: "Inbox vuota — salta per ora e aggiungi mittenti dopo.",
      clusterShowing: (label: string) => `In evidenza: ${label}`,
    },
    firstAction: {
      title: "Gestisci la prima email",
      hint: "Handled ti aiuta a respirare con la inbox — un passo gentile alla volta.",
      reply: "Rispondi",
      done: "Fatto",
      fetchingMore: "Segnali insufficienti — recupero altri esempi…",
      noEmailTitle: "Nessun esempio caricato",
      noEmailBody: "Aggiorna per recuperare altre email, oppure salta e esplora da solo.",
      refreshExamples: "Aggiorna",
      skipStep: "Salta passo",
      useWhatIHave: "Usa quelli disponibili",
      exampleCount: (n: number) =>
        n === 1 ? "1 esempio pronto" : `${n} esempi pronti`,
      resultLabel: "Email suggerita per iniziare",
    },
    personalize: {
      title: "Come deve trattare Handled questo mittente?",
      body: (sender: string) => `Email da ${sender}`,
      save: "Salva e continua",
    },
    release: {
      title: "Sei pronto per l'inbox completa 🎉",
      body: "Categorie, Focus Mode e suggerimenti sono sbloccati.",
      cta: "Vai alla mia inbox",
    },
    categories: {
      worth_your_attention: "Richiede attenzione",
      good_to_know: "Buono a sapersi",
      promotions: "Promozioni",
      newsletters: "Newsletter",
    } as Record<string, string>,
  },
} as const;

const PERSONALIZE_OPTIONS: InboxAiCategory[] = [
  "worth_your_attention",
  "good_to_know",
  "promotions",
  "newsletters",
];

export function GuidedOnboardingFlow({
  locale,
  inboxMode,
  signedIn,
  connectedAccountCount,
  messages,
  readStateMap,
  isCompleted,
  onFinished,
  onFetchMoreExamples,
}: GuidedOnboardingFlowProps) {
  const t = COPY[locale];
  const { collectCategoryCorrection } = useMemoryCollect();
  const totalSteps = GUIDED_ONBOARDING_STEPS.length;
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent("guided_onboarding_started");
  }, []);

  const gmailConnected =
    signedIn &&
    (connectedAccountCount > 0 ||
      inboxMode === "gmail" ||
      inboxMode === "gmail_empty" ||
      inboxMode === "gmail_error");
  const checkingConnection = signedIn && inboxMode === "loading" && !gmailConnected;
  const [step, setStep] = useState<GuidedOnboardingStep>("connect");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [importantSenders, setImportantSenders] = useState<Set<string>>(() => new Set());
  const [promoSenders, setPromoSenders] = useState<Set<string>>(() => new Set());
  const [senderRefreshIndex, setSenderRefreshIndex] = useState(0);
  const [exampleRefreshIndex, setExampleRefreshIndex] = useState(0);
  const [examplesFetching, setExamplesFetching] = useState(false);
  const examplesFetchAttemptedRef = useRef(false);
  const [actionEmail, setActionEmail] = useState<GmailCardMessage | null>(null);
  const [personalizeCategory, setPersonalizeCategory] = useState<InboxAiCategory | null>(null);

  const incompleteMessages = useMemo(
    () => messages.filter((m) => !isCompleted(m.id)),
    [messages, isCompleted],
  );

  const exampleQueue = useMemo(
    () =>
      buildFirstTimeOnboardingQueue(messages, isCompleted, {
        refreshIndex: exampleRefreshIndex,
      }),
    [messages, isCompleted, exampleRefreshIndex],
  );

  const needsMoreExamples = useMemo(
    () => needsMoreOnboardingExamples(exampleQueue, incompleteMessages.length),
    [exampleQueue, incompleteMessages.length],
  );

  const senderCandidates = useMemo(
    () => buildOnboardingSenderCandidates(messages, { refreshIndex: senderRefreshIndex }),
    [messages, senderRefreshIndex],
  );

  const inboxSettled =
    inboxMode === "gmail" || inboxMode === "gmail_empty" || inboxMode === "gmail_error";
  const emptyInbox = inboxMode === "gmail_empty";
  const preferencesReady = inboxSettled && (messages.length > 0 || emptyInbox);

  const pickActionEmail = useCallback(() => {
    return exampleQueue[0] ?? incompleteMessages[0] ?? null;
  }, [exampleQueue, incompleteMessages]);

  const requestMoreExamples = useCallback(async () => {
    if (!onFetchMoreExamples || examplesFetching) return;
    setExamplesFetching(true);
    try {
      await onFetchMoreExamples();
    } finally {
      setExamplesFetching(false);
    }
  }, [onFetchMoreExamples, examplesFetching]);

  useEffect(() => {
    if (step !== "first_action") return;
    setActionEmail(pickActionEmail());
  }, [step, pickActionEmail]);

  useEffect(() => {
    if (step !== "first_action") return;
    if (!onFetchMoreExamples) return;
    if (examplesFetchAttemptedRef.current && !needsMoreExamples) return;
    if (exampleQueue.length >= MIN_ONBOARDING_EXAMPLES) return;
    if (examplesFetching) return;

    examplesFetchAttemptedRef.current = true;
    void requestMoreExamples();
  }, [
    step,
    onFetchMoreExamples,
    needsMoreExamples,
    exampleQueue.length,
    examplesFetching,
    requestMoreExamples,
  ]);

  const persistSenderPrefs = useCallback(
    (sender: string, category: InboxAiCategory, label: string) => {
      const merged = mergeSenderPreferences(
        loadClientSenderPreferences(),
        preferenceFromSender(sender, category, label),
      );
      saveClientSenderPreferences(merged);
    },
    [],
  );

  const savePreferenceStep = useCallback(() => {
    for (const sender of importantSenders) {
      persistSenderPrefs(
        sender,
        "worth_your_attention",
        locale === "it" ? "Onboarding: importante" : "Onboarding: important",
      );
    }
    for (const sender of promoSenders) {
      persistSenderPrefs(
        sender,
        "promotions",
        locale === "it" ? "Onboarding: ignora" : "Onboarding: ignore",
      );
    }
    trackEvent("guided_onboarding_preferences_saved", {
      important: importantSenders.size,
      promotional: promoSenders.size,
      skipped: false,
      none_of_these: false,
    });
  }, [importantSenders, promoSenders, persistSenderPrefs, locale]);

  const goToStep = useCallback((next: GuidedOnboardingStep) => {
    setStep(next);
    trackEvent("guided_onboarding_step", { step: next });
  }, []);

  const handleConnectGmail = useCallback(async () => {
    setOauthLoading(true);
    try {
      await startGoogleOAuth("/emails");
    } finally {
      setOauthLoading(false);
    }
  }, []);

  const toggleImportant = useCallback((sender: string) => {
    setImportantSenders((prev) => {
      const next = new Set(prev);
      if (next.has(sender)) {
        next.delete(sender);
      } else if (next.size < 3) {
        next.add(sender);
        setPromoSenders((p) => {
          const n = new Set(p);
          n.delete(sender);
          return n;
        });
      }
      return next;
    });
  }, []);

  const togglePromo = useCallback((sender: string) => {
    setPromoSenders((prev) => {
      const next = new Set(prev);
      if (next.has(sender)) {
        next.delete(sender);
      } else if (next.size < 3 && !importantSenders.has(sender)) {
        next.add(sender);
      }
      return next;
    });
  }, [importantSenders]);

  const advanceFromPreferences = useCallback(
    (opts?: { skipped?: boolean; noneOfThese?: boolean }) => {
      if (opts?.skipped || opts?.noneOfThese) {
        if (opts.noneOfThese) {
          trackEvent("guided_onboarding_no_senders_matter");
        }
        if (opts.skipped) {
          trackEvent("guided_onboarding_preferences_skipped");
        }
        trackEvent("guided_onboarding_preferences_saved", {
          important: 0,
          promotional: 0,
          skipped: Boolean(opts.skipped),
          none_of_these: Boolean(opts.noneOfThese),
        });
      } else {
        savePreferenceStep();
      }
      const email = pickActionEmail();
      setActionEmail(email);
      goToStep("first_action");
    },
    [savePreferenceStep, pickActionEmail, goToStep],
  );

  const handlePreferencesContinue = useCallback(() => {
    advanceFromPreferences();
  }, [advanceFromPreferences]);

  const handleSkipPreferences = useCallback(() => {
    setImportantSenders(new Set());
    setPromoSenders(new Set());
    advanceFromPreferences({ skipped: true });
  }, [advanceFromPreferences]);

  const handleNoneOfTheseMatter = useCallback(() => {
    setImportantSenders(new Set());
    setPromoSenders(new Set());
    advanceFromPreferences({ noneOfThese: true });
  }, [advanceFromPreferences]);

  const handleRefreshSenders = useCallback(() => {
    setSenderRefreshIndex((n) => n + 1);
    trackEvent("guided_onboarding_sender_refresh", {
      refresh_index: senderRefreshIndex + 1,
    });
  }, [senderRefreshIndex]);

  const handleRefreshExamples = useCallback(() => {
    setExampleRefreshIndex((n) => n + 1);
    examplesFetchAttemptedRef.current = false;
    trackEvent("guided_onboarding_examples_refresh", {
      refresh_index: exampleRefreshIndex + 1,
    });
    void requestMoreExamples();
  }, [exampleRefreshIndex, requestMoreExamples]);

  const handleSkipFirstAction = useCallback(() => {
    trackEvent("guided_onboarding_first_action_skipped");
    goToStep("release");
  }, [goToStep]);

  const handleFirstActionDone = useCallback(() => {
    if (actionEmail) {
      goToStep("personalize");
    } else {
      goToStep("release");
    }
  }, [actionEmail, goToStep]);

  const handlePersonalizeSave = useCallback(async () => {
    if (!actionEmail || !personalizeCategory) return;
    persistSenderPrefs(
      actionEmail.sender,
      personalizeCategory,
      locale === "it" ? "Onboarding: personalizzato" : "Onboarding: personalized",
    );
    void collectCategoryCorrection({
      emailId: actionEmail.id,
      accountId: actionEmail.accountId,
      sender: actionEmail.sender,
      subject: actionEmail.subject,
      guessedCategory: actionEmail.category,
      chosenCategory: personalizeCategory,
      scope: "sender",
      context: "inbox",
    });
    goToStep("release");
  }, [actionEmail, personalizeCategory, persistSenderPrefs, locale, goToStep]);

  const gmailConnectedDisplay = gmailConnected;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          {t.headline}
        </h2>
        <p className="text-sm text-gray-500">{t.stepOf(stepNumber(step), totalSteps)}</p>
      </div>

      {step === "connect" ? (
        <ConnectStep
          t={t.connect}
          gmailConnected={gmailConnectedDisplay}
          checkingConnection={checkingConnection}
          oauthLoading={oauthLoading}
          connectedAccountCount={connectedAccountCount}
          onConnect={() => void handleConnectGmail()}
          onContinue={() => goToStep("preferences")}
        />
      ) : null}

      {step === "preferences" ? (
        <PreferencesStep
          t={t.preferences}
          locale={locale}
          messagesReady={preferencesReady}
          emptyInbox={emptyInbox}
          clusterLabel={senderCandidates.clusterLabel[locale]}
          importantCandidates={senderCandidates.importantCandidates}
          promotionalCandidates={senderCandidates.promotionalCandidates}
          importantSenders={importantSenders}
          promoSenders={promoSenders}
          onToggleImportant={toggleImportant}
          onTogglePromo={togglePromo}
          onContinue={handlePreferencesContinue}
          onSkip={handleSkipPreferences}
          onNoneOfThese={handleNoneOfTheseMatter}
          onRefresh={handleRefreshSenders}
        />
      ) : null}

      {step === "first_action" ? (
        <FirstActionStep
          t={t.firstAction}
          locale={locale}
          actionEmail={actionEmail}
          messagePool={messages}
          exampleCount={exampleQueue.length}
          examplesFetching={examplesFetching}
          sequenceKey={exampleRefreshIndex}
          readStateMap={readStateMap}
          onAdvance={handleFirstActionDone}
          onRefresh={handleRefreshExamples}
          onSkip={handleSkipFirstAction}
        />
      ) : null}

      {step === "personalize" && actionEmail ? (
        <PersonalizeStep
          t={t.personalize}
          categories={t.categories}
          sender={actionEmail.sender}
          selected={personalizeCategory}
          onSelect={setPersonalizeCategory}
          onSave={() => void handlePersonalizeSave()}
          locale={locale}
        />
      ) : null}

      {step === "release" ? (
        <ReleaseStep t={t.release} onFinish={onFinished} />
      ) : null}
    </div>
  );
}

function FirstActionStep({
  t,
  locale,
  actionEmail,
  messagePool,
  exampleCount,
  examplesFetching,
  sequenceKey,
  readStateMap,
  onAdvance,
  onRefresh,
  onSkip,
}: {
  t: (typeof COPY)["en" | "it"]["firstAction"];
  locale: "en" | "it";
  actionEmail: GmailCardMessage | null;
  messagePool: GmailCardMessage[];
  exampleCount: number;
  examplesFetching: boolean;
  sequenceKey: number;
  readStateMap: ReadStateMap;
  onAdvance: () => void;
  onRefresh: () => void;
  onSkip: () => void;
}) {
  const cardRef = useRef<OnboardingEmailCardHandle>(null);
  const live = useFirstActionLiveReveal({
    locale,
    active: true,
    exampleCount,
    hasEmail: Boolean(actionEmail),
    examplesFetching,
    sequenceKey,
  });

  const emailReady = live.phase === "revealed";
  const actionsEnabled = emailReady && Boolean(actionEmail);

  const emotionalLine = useMemo(() => {
    if (!actionEmail || !emailReady) return null;
    return resolveOnboardingEmotionalContext(actionEmail, locale, {
      pool: messagePool,
    });
  }, [actionEmail, emailReady, locale, messagePool]);

  const reassuranceLine = useMemo(
    () => pickMicroReassurance(locale, sequenceKey),
    [locale, sequenceKey],
  );

  const showReassurance = shouldShowMicroReassurance(
    exampleCount,
    live.isProcessing || examplesFetching,
  );

  const fallbackCopy = EMOTIONAL_FALLBACK[locale];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900">{t.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{t.hint}</p>
      </div>

      <LiveProcessingPanel
        locale={locale}
        activeLineId={live.activeLineId}
        activeLineIndex={live.activeLineIndex}
        totalLines={live.totalLines}
        showResultBanner={live.showResultBanner}
        compact={emailReady}
      />

      {showReassurance ? <MicroReassuranceLine line={reassuranceLine} /> : null}

      {!emailReady ? (
        <EmailRevealSkeleton locale={locale} />
      ) : actionEmail ? (
        <div className="calm-fade-in space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent/80">
            {t.resultLabel}
          </p>
          <OnboardingEmailCard
            ref={cardRef}
            message={actionEmail}
            locale={locale}
            readStateMap={readStateMap}
            onAdvance={onAdvance}
            hidePrimaryActions
          />
          {emotionalLine ? <EmotionalContextLine line={emotionalLine} /> : null}
        </div>
      ) : (
        <EmotionalFallbackPanel title={fallbackCopy.title} body={fallbackCopy.body} />
      )}

      <FirstActionControls
        t={t}
        onReply={() => cardRef.current?.triggerReply()}
        onDone={() => cardRef.current?.triggerDone()}
        onRefresh={onRefresh}
        onSkip={onSkip}
        actionsEnabled={actionsEnabled}
        refreshBusy={examplesFetching || live.isProcessing}
      />
    </section>
  );
}

function EmailRevealSkeleton({ locale }: { locale: "en" | "it" }) {
  return (
    <div
      className="rounded-2xl border border-gray-100 bg-white px-5 py-6 shadow-sm"
      aria-hidden
    >
      <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
      <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-gray-50" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-50" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-50" />
      </div>
      <p className="mt-5 text-xs text-gray-400">
        {locale === "it" ? "Preparazione risultato…" : "Preparing your result…"}
      </p>
    </div>
  );
}

function FirstActionControls({
  t,
  onReply,
  onDone,
  onRefresh,
  onSkip,
  actionsEnabled,
  refreshBusy,
}: {
  t: (typeof COPY)["en" | "it"]["firstAction"];
  onReply: () => void;
  onDone: () => void;
  onRefresh: () => void;
  onSkip: () => void;
  actionsEnabled: boolean;
  refreshBusy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
      <button
        type="button"
        onClick={onReply}
        disabled={!actionsEnabled}
        className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
      >
        {t.reply}
      </button>
      <button
        type="button"
        onClick={onDone}
        disabled={!actionsEnabled}
        className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-accent/30 hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
      >
        {t.done}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshBusy}
        className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
      >
        {t.refreshExamples}
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
      >
        {t.skipStep}
      </button>
    </div>
  );
}

function ConnectStep({
  t,
  gmailConnected,
  checkingConnection,
  oauthLoading,
  connectedAccountCount,
  onConnect,
  onContinue,
}: {
  t: (typeof COPY)["en" | "it"]["connect"];
  gmailConnected: boolean;
  checkingConnection: boolean;
  oauthLoading: boolean;
  connectedAccountCount: number;
  onConnect: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-medium text-gray-900">{t.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{t.body}</p>

      {gmailConnected ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-800">
          <span aria-hidden>✓</span>
          {t.connected}
          {connectedAccountCount > 0 ? (
            <span className="text-emerald-600/80">
              ({connectedAccountCount} account{connectedAccountCount === 1 ? "" : "s"})
            </span>
          ) : null}
        </div>
      ) : checkingConnection ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          {t.checkingConnection}
        </div>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          disabled={oauthLoading}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {oauthLoading ? t.connecting : t.connectGmail}
        </button>
      )}

      <div className="mt-4">
        <button
          type="button"
          disabled
          title={t.secondInboxLocked}
          className="w-full cursor-not-allowed rounded-xl border border-dashed border-gray-200 px-4 py-2.5 text-sm text-gray-400"
        >
          {t.secondInbox} · {t.secondInboxLocked}
        </button>
      </div>

      {gmailConnected ? (
        <button type="button" onClick={onContinue} className="btn-primary mt-6 w-full">
          {t.continue}
        </button>
      ) : null}
    </section>
  );
}

function PreferencesStep({
  t,
  locale,
  messagesReady,
  emptyInbox,
  clusterLabel,
  importantCandidates,
  promotionalCandidates,
  importantSenders,
  promoSenders,
  onToggleImportant,
  onTogglePromo,
  onContinue,
  onSkip,
  onNoneOfThese,
  onRefresh,
}: {
  t: (typeof COPY)["en" | "it"]["preferences"];
  locale: "en" | "it";
  messagesReady: boolean;
  emptyInbox: boolean;
  clusterLabel: string;
  importantCandidates: SenderCandidate[];
  promotionalCandidates: SenderCandidate[];
  importantSenders: Set<string>;
  promoSenders: Set<string>;
  onToggleImportant: (sender: string) => void;
  onTogglePromo: (sender: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onNoneOfThese: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900">{t.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{t.subtitle}</p>

        {emptyInbox ? (
          <p className="mt-3 text-sm text-gray-500">{t.emptyInboxSkip}</p>
        ) : !messagesReady ? (
          <p className="mt-4 text-sm text-gray-400">{t.waitingForMail}</p>
        ) : (
          <>
            <p className="mt-3 text-xs font-medium text-gray-400">
              {t.clusterShowing(clusterLabel)}
            </p>
            <p className="mt-2 text-sm text-gray-500">{t.importantHint}</p>
            <p className="mt-1 text-xs font-medium text-accent">
              {t.importantCount(importantSenders.size)}
            </p>
            <SenderChipList
              candidates={importantCandidates}
              selected={importantSenders}
              onToggle={onToggleImportant}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                {t.showDifferent}
              </button>
              <button
                type="button"
                onClick={onNoneOfThese}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                {t.noneOfThese}
              </button>
            </div>
          </>
        )}
      </div>

      {!emptyInbox && messagesReady ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">{t.promoHint}</p>
          <p className="mt-2 text-xs font-medium text-gray-400">{t.promoCount(promoSenders.size)}</p>
          <SenderChipList
            candidates={promotionalCandidates}
            selected={promoSenders}
            onToggle={onTogglePromo}
            muted
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onContinue}
          disabled={!messagesReady}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {t.continue}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={!messagesReady}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {t.skip}
        </button>
      </div>
    </section>
  );
}

function SenderChipList({
  candidates,
  selected,
  onToggle,
  muted,
}: {
  candidates: SenderCandidate[];
  selected: Set<string>;
  onToggle: (sender: string) => void;
  muted?: boolean;
}) {
  if (candidates.length === 0) {
    return (
      <p className="mt-4 text-sm text-gray-400">
        No senders in this group — try different suggestions or skip for now.
      </p>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {candidates.map((c) => {
        const active = selected.has(c.sender);
        return (
          <li key={c.sender}>
            <button
              type="button"
              onClick={() => onToggle(c.sender)}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                active
                  ? "border-accent bg-accent-muted/30 ring-1 ring-accent/20"
                  : muted
                    ? "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                    : "border-gray-100 bg-white hover:border-accent/30"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  active ? "border-accent bg-accent text-white" : "border-gray-300 text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-gray-900">{c.sender}</span>
                <span className="block truncate text-xs text-gray-500">{c.sampleSubject}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PersonalizeStep({
  t,
  categories,
  sender,
  selected,
  onSelect,
  onSave,
  locale,
}: {
  t: (typeof COPY)["en" | "it"]["personalize"];
  categories: Record<string, string>;
  sender: string;
  selected: InboxAiCategory | null;
  onSelect: (cat: InboxAiCategory) => void;
  onSave: () => void;
  locale: "en" | "it";
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-medium text-gray-900">{t.title}</h3>
      <p className="mt-1 text-sm text-gray-500">{t.body(sender)}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {PERSONALIZE_OPTIONS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onSelect(cat)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              selected === cat
                ? "border-accent bg-accent-muted/30 text-accent"
                : "border-gray-200 text-gray-700 hover:border-accent/30"
            }`}
          >
            {categories[cat] ?? inboxCategorySectionTitle(cat, locale)}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={!selected}
        className="btn-primary mt-6 w-full disabled:opacity-50"
      >
        {t.save}
      </button>
    </section>
  );
}

function ReleaseStep({
  t,
  onFinish,
}: {
  t: (typeof COPY)["en" | "it"]["release"];
  onFinish: () => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center shadow-sm">
      <h3 className="text-xl font-semibold text-gray-900">{t.title}</h3>
      <p className="mt-2 text-sm text-gray-500">{t.body}</p>
      <button type="button" onClick={onFinish} className="btn-primary mt-8 w-full sm:w-auto">
        {t.cta}
      </button>
    </section>
  );
}
