import { createRbsAccountPaymentProvider } from "./rbs";

export const alfaAccountPaymentProvider = createRbsAccountPaymentProvider({
  code: "alfa",
  displayName: "Alfa-Bank",
  defaultTestUrl: "https://web.rbsuat.com/ab/rest",
  defaultLiveUrl: "https://payment.alfabank.ru/payment/rest",
});
