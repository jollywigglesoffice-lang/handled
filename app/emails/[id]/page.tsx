import { notFound } from "next/navigation";
import { EmailDetailView } from "./email-detail-view";
import { fakeEmails, getEmailById } from "@/lib/fake-emails";

type EmailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export function generateStaticParams() {
  return fakeEmails.map((email) => ({ id: email.id }));
}

export default async function EmailDetailPage({ params }: EmailDetailPageProps) {
  const { id } = await params;
  const email = getEmailById(id);

  if (!email) {
    notFound();
  }

  return <EmailDetailView email={email} />;
}

