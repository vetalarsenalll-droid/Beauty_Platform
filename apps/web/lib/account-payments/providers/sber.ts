import { createRbsAccountPaymentProvider } from "./rbs";

export const sberAccountPaymentProvider = createRbsAccountPaymentProvider({
  code: "sber",
  displayName: "Sber",
  defaultTestUrl: "https://3dsec.sberbank.ru/payment/rest",
  defaultLiveUrl: "https://securepayments.sberbank.ru/payment/rest",
});
