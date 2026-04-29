export type InboxSectionTitle =
  | "Needs Your Attention"
  | "Handled For You"
  | "Hidden Inbox";

export type FakeEmail = {
  id: string;
  section: InboxSectionTitle;
  sender: string;
  subject: string;
  summary: string;
  category: string;
  aiSummary: string;
  body: string;
  suggestedReply: string;
};

export const fakeEmails: FakeEmail[] = [
  {
    id: "budget-approval-april",
    section: "Needs Your Attention",
    sender: "Maya Chen (Finance)",
    subject: "Can you approve the April ad budget update?",
    summary: "Need your yes by 3 PM so we can finalize this month’s spend.",
    category: "Finance",
    aiSummary:
      "Maya needs same-day approval so Finance can close today’s budget update.",
    body: `Hi Aisha,

We adjusted the April ad budget after final vendor numbers came in. Total spend is still within the monthly cap, but we moved part of events budget to paid social.

Can you approve this before 3 PM so I can lock it in?

Thanks,
Maya`,
    suggestedReply: `Hi Maya,

Approved, thanks for the quick update.

Best,
Aisha`,
  },
  {
    id: "vendor-contract-eu-it",
    section: "Needs Your Attention",
    sender: "Marco Rossi (Legal EU)",
    subject: "Contratto fornitore — conferma entro venerdì",
    summary: "Marco chiede un controllo sul capitolo responsabilità prima della firma.",
    category: "Legal",
    aiSummary:
      "Marco sent the updated vendor agreement and needs confirmation on the liability section before signing Friday.",
    body: `Ciao Aisha,

Ti inoltro la versione aggiornata del contratto fornitore. Potresti confermare che il capitolo sulle responsabilità ti torna, così procediamo con la firma entro venerdì?

Grazie e buona giornata,
Marco`,
    suggestedReply: `Hi Marco,

Thanks — I'll review the liability chapter today and confirm.

Best,
Aisha`,
  },
  {
    id: "maintenance-access-4b",
    section: "Needs Your Attention",
    sender: "Owen Patel (Facilities)",
    subject: "Confirm access to suite 4B tomorrow",
    summary: "Facilities needs a quick confirmation for morning maintenance access.",
    category: "Operations",
    aiSummary:
      "Owen needs your confirmation so the maintenance team can enter 4B tomorrow morning.",
    body: `Hello,

Our team needs to service the ventilation unit in suite 4B tomorrow between 9:00 and 10:30.

Can you confirm access and whether someone from your team can meet us there?

Regards,
Owen`,
    suggestedReply: `Hi Owen,

Access is confirmed for tomorrow morning. Someone from our team will meet you there.

Thanks,
Aisha`,
  },
  {
    id: "invoice-template-resolved",
    section: "Handled For You",
    sender: "Priya Nair (Brightline Media)",
    subject: "Invoice format updated",
    summary: "They confirmed future invoices will follow your template and arrive as PDFs.",
    category: "Admin",
    aiSummary:
      "Handled confirmed billing preferences with Priya, and the issue is now closed.",
    body: `Hello Aisha,

Thanks for clarifying your billing format. We updated our records and will send future invoices as PDF using your preferred layout.

Let us know if anything else should be included.

Best,
Priya`,
    suggestedReply: `Hi team,

Perfect, thank you. No other changes needed.

Best,
Aisha`,
  },
  {
    id: "hotel-confirmation-complete",
    section: "Handled For You",
    sender: "Daniel Ross (Travel Desk)",
    subject: "Hotel booking confirmed for May trip",
    summary: "Reservation is locked and details were sent to your calendar.",
    category: "Travel",
    aiSummary:
      "Daniel confirmed your booking and shared the itinerary; no immediate action needed.",
    body: `Hi Aisha,

Your hotel stay for 14-17 May is confirmed. I added the booking code and address to your calendar invite.

If you want a later check-in, just let me know by Wednesday.

Regards,
Daniel`,
    suggestedReply: `Hi,

Thanks, this looks good.

Best,
Aisha`,
  },
  {
    id: "weekly-product-digest",
    section: "Hidden Inbox",
    sender: "Nina from Product Weekly",
    subject: "5 product updates worth skimming",
    summary: "A short roundup of launches and practical workflows from this week.",
    category: "Newsletter",
    aiSummary: "Useful product newsletter to read later; not urgent.",
    body: `Hi there,

Here are this week’s most useful product updates, including one strong guide on team handoffs and one comparison of note-taking tools.

Reading time is around 10 minutes.

See you next Friday,
Nina`,
    suggestedReply: `No reply needed.`,
  },
  {
    id: "campus-event-highlights",
    section: "Hidden Inbox",
    sender: "Leah Kim (Campus Community)",
    subject: "Meetup recap + next month’s dates",
    summary: "Photos, notes, and upcoming event dates are now posted.",
    category: "Community",
    aiSummary: "Community recap and schedule update; review when you have time.",
    body: `Hi everyone,

Thanks for joining last week’s meetups. We uploaded photos, discussion notes, and the new event calendar.

You can find everything in the portal link below.

Warmly,
Leah`,
    suggestedReply: `No reply needed.`,
  },
];

const sectionOrder: InboxSectionTitle[] = [
  "Needs Your Attention",
  "Handled For You",
  "Hidden Inbox",
];

export function getInboxSections() {
  return sectionOrder.map((title) => ({
    title,
    emails: fakeEmails.filter((email) => email.section === title),
  }));
}

export function getEmailById(id: string) {
  return fakeEmails.find((email) => email.id === id);
}
