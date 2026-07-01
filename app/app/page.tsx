import { redirect } from "next/navigation";
import { POST_LOGIN_DESTINATION } from "@/lib/auth/post-login-destination";

export default function AppEntryPage() {
  redirect(POST_LOGIN_DESTINATION);
}
