import { getPaymentProvider } from "./provider";
import type { CreatePaymentInput } from "./types";

export async function createPlatformCheckout(input: CreatePaymentInput) {
  const provider = getPaymentProvider();
  return provider.createPayment(input);
}
