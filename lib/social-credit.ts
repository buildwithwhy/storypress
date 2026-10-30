import { z } from "zod";

// Growth credit on share artifacts: a short URL drawn on every share image.
// The founder swaps the destination by setting STORYPRESS_CREDIT_URL; without
// it the request origin is the floor. The URL reaches the client only through
// the services payload — no production host is ever written into client code,
// so check-client-hosts.mjs stays untouched.
export const socialCreditSchema = z.object({ url: z.string().min(1) });
export type SocialCredit = z.infer<typeof socialCreditSchema>;
export function socialCredit(env: Record<string, string | undefined>, requestOrigin: string): SocialCredit {
  return { url: env.STORYPRESS_CREDIT_URL?.trim() || requestOrigin };
}
