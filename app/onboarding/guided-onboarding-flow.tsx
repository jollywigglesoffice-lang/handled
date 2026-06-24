"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { CategoryTrainingStep } from "@/app/onboarding/category-training-step";
import { GuideMessage } from "@/app/onboarding/guide-message";
import { useMemoryCollect } from "@/app/hooks/use-memory-collect";
import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";
import { persistEmailOverrideToAccount } from "@/lib/email-overrides/client-sync";
import {
  applyTrainingClassification,
  countClassificationsForCategory,
  countUnclassified,
  emptyTrainingClassifications,
  pickTrainingExamples,
  getTrainingHint,
  TRAINING_PAGE_SIZE,
  type TrainingClassifications,
} from "@/lib/onboarding/category-training";
import {
  nextGuidedStep,
  trainingStepCategory,
  type GuidedOnboardingStep,
  type TrainingOnboardingStep,
  TRAINING_ONBOARDING_STEPS,
} from "@/lib/onboarding/guided-steps";
import {
  CATEGORY_TRAINING_COPY,
  trainingStepCopyKey,
} from "@/lib/onboarding/training-copy";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  loadClientSenderPreferences,
  mergeSenderPreferences,
  preferenceFromSender,
  saveClientSenderPreferences,
} from "@/lib/inbox-sender-preferences";
import { trackEvent } from "@/lib/analytics";
import { recordOnboardingComplete } from "@/lib/emotional-memory";
import { recordOnboardingHesitation } from "@/lib/inbox-stress";
import { MIN_ONBOARDING_EXAMPLES } from "@/lib/onboarding/build-queue";
import {
  clearOnboardingProgressStorage,
  readOnboardingProgress,
  readOnboardingTrainingState,
  saveOnboardingProgress,
  saveOnboardingTrainingState,
} from "@/lib/onboarding/progress-storage";
import { ONBOARDING_RESET_EVENT } from "@/lib/onboarding/reset";

function loadInitialOnboardingState(): {
  step: GuidedOnboardingStep;
  classifications: TrainingClassifications;
  refreshIndexByStep: Record<string, number>;
} {
  const progress = readOnboardingProgress();
  const training = readOnboardingTrainingState();
  return {
    step: progress?.step ?? "connect",
    classifications: training?.classifications ?? emptyTrainingClassifications(),
    refreshIndexByStep: training?.refreshIndexByStep ?? {},
  };
}

export type GuidedOnboardingFlowProps = {
  locale: "en" | "it";
  inboxMode: "loading" | "no_google" | "gmail" | "gmail_empty" | "gmail_error";
  signedIn: boolean;
  connectedAccountCount: number;
  messages: GmailCardMessage[];
  isCompleted: (id: string) => boolean;
  onFinished: () => void;
  onFetchMoreExamples?: () => Promise<void>;
};

function isTrainingStep(step: GuidedOnboardingStep): step is TrainingOnboardingStep {
  return (TRAINING_ONBOARDING_STEPS as readonly string[]).includes(step);
}

export function GuidedOnboardingFlow({
  locale,
  inboxMode,
  signedIn,
  connectedAccountCount,
  messages,
  isCompleted,
  onFinished,
  onFetchMoreExamples,
}: GuidedOnboardingFlowProps) {
  const t = CATEGORY_TRAINING_COPY[locale];
  const { collectCategoryCorrection } = useMemoryCollect();
  const startedRef = useRef(false);
  const flowStartedAtRef = useRef(Date.now());
  const examplesFetchInitRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    flowStartedAtRef.current = Date.now();
    trackEvent("guided_onboarding_started");
  }, []);

  const gmailConnected =
    signedIn &&
    (connectedAccountCount > 0 ||
      inboxMode === "gmail" ||
      inboxMode === "gmail_empty" ||
      inboxMode === "gmail_error");
  const checkingConnection = signedIn && inboxMode === "loading" && !gmailConnected;

  const initialStateRef = useRef(loadInitialOnboardingState());

  const [step, setStep] = useState<GuidedOnboardingStep>(initialStateRef.current.step);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [classifications, setClassifications] = useState<TrainingClassifications>(
    initialStateRef.current.classifications,
  );
  const [refreshIndexByStep, setRefreshIndexByStep] = useState<Record<string, number>>(
    initialStateRef.current.refreshIndexByStep,
  );
  const [examplesFetching, setExamplesFetching] = useState(false);
  const [transitionLine, setTransitionLine] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      recordOnboardingHesitation();
    }, 120_000);
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    saveOnboardingProgress({ step, updatedAt: new Date().toISOString() });
  }, [step]);

  useEffect(() => {
    saveOnboardingTrainingState({
      classifications,
      refreshIndexByStep,
      updatedAt: new Date().toISOString(),
    });
  }, [classifications, refreshIndexByStep]);

  useEffect(() => {
    const onReset = () => {
      setStep("connect");
      setClassifications(emptyTrainingClassifications());
      setRefreshIndexByStep({});
      setTransitionLine(null);
      startedRef.current = false;
      examplesFetchInitRef.current = false;
      flowStartedAtRef.current = Date.now();
    };
    window.addEventListener(ONBOARDING_RESET_EVENT, onReset);
    return () => window.removeEventListener(ONBOARDING_RESET_EVENT, onReset);
  }, []);

  const inboxSettled =
    inboxMode === "gmail" || inboxMode === "gmail_empty" || inboxMode === "gmail_error";
  const emptyInbox = inboxMode === "gmail_empty";
  const messagesReady = inboxSettled && (messages.length > 0 || emptyInbox);

  const remainingUnclassified = useMemo(
    () => countUnclassified(messages, classifications, isCompleted),
    [messages, classifications, isCompleted],
  );

  const currentTrainingCategory = isTrainingStep(step) ? trainingStepCategory(step) : null;

  const refreshIndex = refreshIndexByStep[step] ?? 0;

  const trainingExamples = useMemo(() => {
    if (!currentTrainingCategory) return [];
    return pickTrainingExamples(messages, classifications, {
      isCompleted,
      refreshIndex,
    });
  }, [messages, classifications, isCompleted, refreshIndex, currentTrainingCategory]);

  const classifiedInCurrentStep = currentTrainingCategory
    ? countClassificationsForCategory(classifications, currentTrainingCategory)
    : 0;

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
    if (!isTrainingStep(step)) {
      examplesFetchInitRef.current = false;
      return;
    }
    if (examplesFetchInitRef.current) return;
    if (!onFetchMoreExamples) return;
    if (messages.length >= MIN_ONBOARDING_EXAMPLES) return;

    examplesFetchInitRef.current = true;
    void requestMoreExamples();
  }, [step, onFetchMoreExamples, messages.length, requestMoreExamples]);

  const goToStep = useCallback(
    (next: GuidedOnboardingStep) => {
      const line = t.transitions[next];
      if (line) setTransitionLine(line);
      setStep(next);
      trackEvent("guided_onboarding_step", { step: next });
    },
    [t.transitions],
  );

  const advanceStep = useCallback(() => {
    const next = nextGuidedStep(step);
    if (next) goToStep(next);
  }, [step, goToStep]);

  const handleConnectGmail = useCallback(async () => {
    setOauthLoading(true);
    try {
      await startGoogleOAuth("/emails");
    } finally {
      setOauthLoading(false);
    }
  }, []);

  const persistSenderPref = useCallback(
    (sender: string, category: InboxAiCategory) => {
      const label =
        locale === "it" ? `Onboarding: ${category}` : `Onboarding: ${category}`;
      const merged = mergeSenderPreferences(
        loadClientSenderPreferences(),
        preferenceFromSender(sender, category, label),
      );
      saveClientSenderPreferences(merged);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("handled-sender-preferences-changed"));
      }
    },
    [locale],
  );

  const handleClassify = useCallback(
    (message: GmailCardMessage, category: InboxAiCategory) => {
      setClassifications((prev) => applyTrainingClassification(prev, message, category));
      persistSenderPref(message.sender, category);

      const hint = getTrainingHint(message);
      void persistEmailOverrideToAccount({
        emailId: message.id,
        overriddenCategory: category,
        originalCategory: hint,
        accountId: message.accountId,
      });

      void collectCategoryCorrection({
        emailId: message.id,
        accountId: message.accountId,
        sender: message.sender,
        subject: message.subject,
        guessedCategory: hint ?? "good_to_know",
        chosenCategory: category,
        scope: "sender",
        context: "inbox",
      });

      trackEvent("guided_onboarding_training_classified", {
        category,
        step,
      });
    },
    [persistSenderPref, collectCategoryCorrection, step],
  );

  const handleShowMore = useCallback(() => {
    setRefreshIndexByStep((prev) => ({
      ...prev,
      [step]: (prev[step] ?? 0) + 1,
    }));
    trackEvent("guided_onboarding_training_show_more", { step });
    if (remainingUnclassified <= TRAINING_PAGE_SIZE && onFetchMoreExamples) {
      void requestMoreExamples();
    }
  }, [step, remainingUnclassified, onFetchMoreExamples, requestMoreExamples]);

  const handleSkipStep = useCallback(() => {
    trackEvent("guided_onboarding_training_skipped", { step });
    advanceStep();
  }, [step, advanceStep]);

  const finishOnboarding = useCallback(() => {
    recordOnboardingComplete({
      preferencesMemory: {
        skipped: false,
        noneOfThese: false,
        importantCount: countClassificationsForCategory(
          classifications,
          "worth_your_attention",
        ),
        promoCount: countClassificationsForCategory(classifications, "promotions"),
      },
      durationMs: Date.now() - flowStartedAtRef.current,
      senderRefreshCount: 0,
    });
    trackEvent("guided_onboarding_training_complete", {
      classified_senders: Object.keys(classifications.senders).length,
      classified_emails: Object.keys(classifications.emails).length,
      remaining_unclassified: remainingUnclassified,
    });
    clearOnboardingProgressStorage();
    onFinished();
  }, [classifications, remainingUnclassified, onFinished]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          {t.headline}
        </h2>
        {transitionLine ? <GuideMessage variant="ack">{transitionLine}</GuideMessage> : null}
      </div>

      {step === "connect" ? (
        <ConnectStep
          t={t.connect}
          gmailConnected={gmailConnected}
          checkingConnection={checkingConnection}
          oauthLoading={oauthLoading}
          connectedAccountCount={connectedAccountCount}
          onConnect={() => void handleConnectGmail()}
          onContinue={() => goToStep("intro")}
        />
      ) : null}

      {step === "intro" ? (
        <IntroStep
          t={t.intro}
          onContinue={() => goToStep("train_worth_your_attention")}
          onSkip={() => goToStep("release")}
        />
      ) : null}

      {isTrainingStep(step) ? (
        <CategoryTrainingStep
          copy={t[trainingStepCopyKey(step)]}
          locale={locale}
          category={trainingStepCategory(step)}
          examples={trainingExamples}
          classifications={classifications}
          remainingCount={remainingUnclassified}
          classifiedInStep={classifiedInCurrentStep}
          messagesReady={messagesReady}
          emptyInbox={emptyInbox}
          examplesFetching={examplesFetching}
          onClassify={(message) => handleClassify(message, trainingStepCategory(step))}
          onShowMore={handleShowMore}
          onSkip={handleSkipStep}
          onContinue={advanceStep}
        />
      ) : null}

      {step === "release" ? (
        <ReleaseStep t={t.release} onFinish={finishOnboarding} />
      ) : null}
    </div>
  );
}

function IntroStep({
  t,
  onContinue,
  onSkip,
}: {
  t: (typeof CATEGORY_TRAINING_COPY)["en"]["intro"];
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="space-y-4">
      <GuideMessage>{t.prompt}</GuideMessage>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm leading-relaxed text-gray-500">{t.body}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onContinue} className="btn-primary flex-1">
            {t.continue}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {t.skip}
          </button>
        </div>
      </div>
    </section>
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
  t: (typeof CATEGORY_TRAINING_COPY)["en"]["connect"];
  gmailConnected: boolean;
  checkingConnection: boolean;
  oauthLoading: boolean;
  connectedAccountCount: number;
  onConnect: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="space-y-4">
      <GuideMessage>{t.prompt}</GuideMessage>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm leading-relaxed text-gray-500">{t.body}</p>

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
      </div>
    </section>
  );
}

function ReleaseStep({
  t,
  onFinish,
}: {
  t: (typeof CATEGORY_TRAINING_COPY)["en"]["release"];
  onFinish: () => void;
}) {
  return (
    <section className="space-y-4">
      <GuideMessage>{t.title}</GuideMessage>
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-sm text-gray-500">{t.body}</p>
        <button type="button" onClick={onFinish} className="btn-primary mt-8 w-full sm:w-auto">
          {t.cta}
        </button>
      </div>
    </section>
  );
}
