import { resolveSenderIdentity } from "@/lib/sender-identity";

/** Do two inbox sender lines refer to the same person/org? */
export function senderLinesMatch(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const idA = resolveSenderIdentity(a);
  const idB = resolveSenderIdentity(b);

  if (idA.email && idB.email && idA.email === idB.email) return true;
  if (idA.ruleKey && idB.ruleKey && idA.ruleKey === idB.ruleKey) return true;

  return false;
}
