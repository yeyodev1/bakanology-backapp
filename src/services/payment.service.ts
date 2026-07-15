import { Payment } from "../models/Payment";
import { User } from "../models/User";
import { cancelUserSubscription } from "./stripe.service";

export async function getHistory(userId: string) {
  const payments = await Payment.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  return {
    history: payments.map((p) => ({
      id: p._id.toString(),
      type: "stripe" as const,
      plan: p.plan as string,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      clientTransactionId: p.clientTransactionId,
      createdAt: p.createdAt,
    })),
  };
}

export async function cancelPendingPayments(userId: string) {
  const result = await Payment.updateMany(
    { user: userId, status: "pending" },
    { status: "canceled" },
  );
  return { canceled: result.modifiedCount };
}

export async function cancelSubscription(userId: string) {
  return cancelUserSubscription(userId);
}
