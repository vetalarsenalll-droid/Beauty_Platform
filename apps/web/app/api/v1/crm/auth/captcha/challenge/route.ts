import { jsonOk } from "@/lib/api";
import { createCaptchaChallenge } from "@/lib/captcha";

export async function POST(request: Request) {
  const data = createCaptchaChallenge({
    request,
    scope: "auth:crm-register-start",
  });

  return jsonOk(data);
}

