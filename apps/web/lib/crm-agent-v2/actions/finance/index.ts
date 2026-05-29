import type { CrmAgentActionDefinition } from "../types";
import { financeFindUnpaidAction } from "./finance.find-unpaid";
import { financeReconcileAppointmentAction } from "./finance.reconcile-appointment";
import { financeRevenueByLocationAction } from "./finance.revenue-by-location";
import { financeRevenueByServiceAction } from "./finance.revenue-by-service";
import { financeRevenueBySpecialistAction } from "./finance.revenue-by-specialist";
import { financeViewClientBalanceAction } from "./finance.view-client-balance";
import { financeViewPaymentsAction } from "./finance.view-payments";
import { financeViewReceiptsAction } from "./finance.view-receipts";
import { financeViewRefundsAction } from "./finance.view-refunds";
import { financeViewRevenueAction } from "./finance.view-revenue";
import { paymentIntentCancelAction } from "./payment-intent.cancel";
import { paymentIntentCreateAction } from "./payment-intent.create";
import { paymentIntentSearchAction } from "./payment-intent.search";
import { receiptResendAction } from "./receipt.resend";
import { receiptViewAction } from "./receipt.view";
import { refundCreateAction } from "./refund.create";

export const financeActions: CrmAgentActionDefinition[] = [
  financeFindUnpaidAction,
  financeReconcileAppointmentAction,
  financeRevenueByLocationAction,
  financeRevenueByServiceAction,
  financeRevenueBySpecialistAction,
  financeViewClientBalanceAction,
  financeViewPaymentsAction,
  financeViewReceiptsAction,
  financeViewRefundsAction,
  financeViewRevenueAction,
  paymentIntentCancelAction,
  paymentIntentCreateAction,
  paymentIntentSearchAction,
  receiptResendAction,
  receiptViewAction,
  refundCreateAction,
];
