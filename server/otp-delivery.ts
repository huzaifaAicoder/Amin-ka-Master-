import { ENV } from "./_core/env";

type DeliveryInput = {
  destination: string;
  code: string;
  expiresInMinutes: number;
};

export type OtpDeliveryResult =
  | { delivered: true; provider: "development" | "msg91" | "resend" }
  | { delivered: false; provider: "unconfigured" | "msg91" | "resend" };

export function isOtpDeliveryConfigured() {
  const provider = process.env.OTP_DELIVERY_PROVIDER?.trim().toLowerCase();
  if (provider === "msg91") return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID);
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY && process.env.OTP_EMAIL_FROM);
  return !ENV.isProduction && provider === "development";
}

/**
 * Delivers a password-recovery code without ever returning it to a mobile client.
 * MSG91 is included for Indian mobile delivery; Resend supports verified email domains.
 */
export async function deliverPasswordResetOtp(input: DeliveryInput): Promise<OtpDeliveryResult> {
  const provider = process.env.OTP_DELIVERY_PROVIDER?.trim().toLowerCase();
  const message = `Your Amin Ka Master password recovery code is ${input.code}. It expires in ${input.expiresInMinutes} minutes. Do not share this code.`;

  if (provider === "msg91") {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const mobile = input.destination.replace(/^\+91/, "").replace(/\D/g, "");
    if (!authKey || !templateId || !/^\d{10}$/.test(mobile)) return { delivered: false, provider: "msg91" };
    try {
      const response = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: { authkey: authKey, "content-type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          short_url: "0",
          recipients: [{ mobiles: `91${mobile}`, otp: input.code, expiry: String(input.expiresInMinutes) }],
        }),
      });
      return response.ok ? { delivered: true, provider: "msg91" } : { delivered: false, provider: "msg91" };
    } catch {
      return { delivered: false, provider: "msg91" };
    }
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.OTP_EMAIL_FROM;
    if (!apiKey || !from || !input.destination.includes("@")) return { delivered: false, provider: "resend" };
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [input.destination], subject: "Your Amin Ka Master recovery code", text: message }),
      });
      return response.ok ? { delivered: true, provider: "resend" } : { delivered: false, provider: "resend" };
    } catch {
      return { delivered: false, provider: "resend" };
    }
  }

  if (!ENV.isProduction && provider === "development") {
    console.info(`[OTP development delivery] destination=${input.destination} code=${input.code} expiresInMinutes=${input.expiresInMinutes}`);
    return { delivered: true, provider: "development" };
  }

  return { delivered: false, provider: "unconfigured" };
}
