/** Emergency stabilization — post-login always lands on inbox. */
export const POST_LOGIN_DESTINATION = "/emails";

export function getPostLoginDestination(_requestedNext?: string | null): string {
  return POST_LOGIN_DESTINATION;
}

/** Single client redirect after password login (OAuth redirect is server-side). */
export function redirectToInboxAfterLogin(): void {
  window.location.replace(POST_LOGIN_DESTINATION);
}
