import crypto from "crypto";
import Stripe from "stripe";
import { Payment, type IPayment } from "../models/Payment";
import { User } from "../models/User";
import type { IUser } from "../models/User";
import { CustomError } from "../errors/customError.error";
import { hashPassword } from "../helpers/password.helper";
import { sendPaymentWelcomeEmail, sendPaymentConfirmationEmail } from "../helpers/email.helper";

type CheckoutPlan = "monthly" | "lifetime";
type CheckoutExtra = "crm" | "telegram_vip";
type PriceCode = "MONTHLY" | "LIFETIME" | "TELEGRAM_VIP" | "CRM";
const PUBLIC_ACADEMY_URL = "https://bakanology.com/";

const LIVE_PRICE_IDS: Record<PriceCode, string> = {
  MONTHLY: "price_1TtWoZ606jnHEf4npZbARL2N",
  LIFETIME: "price_1Tp9xH606jnHEf4n1IYf6OO2",
  TELEGRAM_VIP: "price_1TtWuV606jnHEf4nJnC1VAUC",
  CRM: "price_1TtWvh606jnHEf4nohCH3MC7",
};

function getStripeKey(): string {
  const key = process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY;
  if (!key) throw new Error("Stripe secret key is not configured");
  return key;
}

function getWebhookSecret(): string | undefined {
  return process.env.NODE_ENV === "production"
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_TEST_WEBHOOK_SECRET;
}

function readPrice(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getPriceId(code: PriceCode): string | undefined {
  const isProd = process.env.NODE_ENV === "production";
  return isProd
    ? process.env[`STRIPE_${code}_PRICE_ID`] || LIVE_PRICE_IDS[code]
    : process.env[`STRIPE_TEST_${code}_PRICE_ID`];
}

function normalizePlan(value: unknown): CheckoutPlan {
  if (value === "monthly" || value === "lifetime") return value;
  throw new CustomError("Invalid checkout plan", 400);
}

function normalizeExtras(value: unknown, plan: CheckoutPlan): CheckoutExtra[] {
  if (plan === "lifetime" || !Array.isArray(value)) return [];
  const allowed = new Set<CheckoutExtra>(["crm", "telegram_vip"]);
  return [...new Set(value.filter((item): item is CheckoutExtra => allowed.has(item)))];
}

function resolveReturnOrigin(candidate?: string): string {
  const fallback = process.env.FRONTEND_URL || "http://localhost:5173";
  if (!candidate) return fallback;
  try {
    const origin = new URL(candidate).origin;
    const allowed = new Set([
      fallback,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "https://testing-storybrand-frontend.bakano.ec",
      "https://bakanology-funnel.vercel.app",
      "https://bakanology-funnel.netlify.app",
      "https://bakanology.bakano.ec",
      "https://bakanology.com",
      "https://www.bakanology.com",
    ]);
    return allowed.has(origin) ? origin : fallback;
  } catch {
    return fallback;
  }
}

function generatePassword() {
  return crypto.randomBytes(8).toString("hex");
}

function stripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

const stripe = new Stripe(getStripeKey());

async function findOrCreateGuestUser(input: { email: string; name: string; lastName: string }) {
  const normalizedEmail = input.email.toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });
  if (user) {
    const recoverableCheckout = await Payment.findOne({
      user: user._id,
      status: { $in: ["pending", "failed", "canceled"] },
      isNewUser: true,
      plainPassword: { $nin: [null, ""] },
    }).sort({ createdAt: -1 });
    if (recoverableCheckout) {
      return { user, isNew: true, plainPassword: recoverableCheckout.plainPassword, lockAcquired: false };
    }
    return { user, isNew: false, plainPassword: null, lockAcquired: false };
  }

  const plainPassword = generatePassword();
  try {
    user = await User.create({
      name: input.name.trim(),
      lastName: input.lastName.trim(),
      email: normalizedEmail,
      password: await hashPassword(plainPassword),
      isVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      subscriptionStatus: "none",
      accessUntil: null,
      checkoutLockUntil: new Date(Date.now() + 60_000),
      createdByCheckout: true,
    });
    return { user, isNew: true, plainPassword, lockAcquired: true };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    user = await User.findOne({ email: normalizedEmail });
    if (!user) throw error;
    return { user, isNew: false, plainPassword: null, lockAcquired: false };
  }
}

async function acquireCheckoutLock(userId: string) {
  const now = new Date();
  const checkoutLockUntil = new Date(now.getTime() + 60_000);
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { checkoutLockUntil: null },
        { checkoutLockUntil: { $exists: false } },
        { checkoutLockUntil: { $lte: now } },
      ],
    },
    { checkoutLockUntil },
    { new: true },
  );
  if (!user) throw new CustomError("Another checkout is already being prepared for this account", 409);
  return user;
}

async function cancelPendingCheckouts(userId: string) {
  const pendingPayments = await Payment.find({ user: userId, status: "pending" });
  for (const payment of pendingPayments) {
    if (payment.stripeSessionId) {
      const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
      if (session.status === "complete") {
        throw new CustomError("A payment for this account is already being completed", 409);
      }
    }
    payment.status = "canceled";
    await payment.save();
  }
}

function buildLineItems(plan: CheckoutPlan, extras: CheckoutExtra[], offer: "academy" | "funnel") {
  const monthlyPrice = readPrice("FUNNEL_MONTHLY_PRICE", 37);
  const lifetimePrice = offer === "funnel"
    ? readPrice("FUNNEL_LIFETIME_PRICE", 297)
    : readPrice("LIFETIME_PRICE", 297);
  const crmPrice = readPrice("CRM_PRICE", 15);
  const telegramPrice = readPrice("TELEGRAM_VIP_PRICE", 15);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const monthlyPriceId = getPriceId("MONTHLY");
  const lifetimePriceId = getPriceId("LIFETIME");
  const crmPriceId = getPriceId("CRM");
  const telegramPriceId = getPriceId("TELEGRAM_VIP");

  if (plan === "monthly") {
    lineItems.push(monthlyPriceId ? { price: monthlyPriceId, quantity: 1 } : {
      price_data: {
        currency: "usd",
        unit_amount: monthlyPrice * 100,
        recurring: { interval: "month" },
        product_data: {
          name: "Bakanology — Membresía mensual",
          description: "Acceso mensual al Método Bakano y sus actualizaciones.",
        },
      },
      quantity: 1,
    });
    if (extras.includes("crm")) {
      lineItems.push(crmPriceId ? { price: crmPriceId, quantity: 1 } : {
        price_data: {
          currency: "usd",
          unit_amount: crmPrice * 100,
          product_data: { name: "CRM Bakanology", description: "Activación del CRM para gestionar prospectos." },
        },
        quantity: 1,
      });
    }
    if (extras.includes("telegram_vip")) {
      lineItems.push(telegramPriceId ? { price: telegramPriceId, quantity: 1 } : {
        price_data: {
          currency: "usd",
          unit_amount: telegramPrice * 100,
          product_data: { name: "Telegram VIP", description: "Acceso al grupo privado de dueños de negocio." },
        },
        quantity: 1,
      });
    }
  } else {
    const lifetimePriceData: Stripe.Checkout.SessionCreateParams.LineItem = {
      price_data: {
        currency: "usd",
        unit_amount: lifetimePrice * 100,
        product_data: {
          name: offer === "academy" ? "Acceso de por vida — Bakanology Academy" : "Bakanology — Acceso de por vida",
          description: "Pago único. Incluye CRM Bakanology, Telegram VIP y actualizaciones futuras.",
        },
      },
      quantity: 1,
    };
    lineItems.push(offer === "funnel" && lifetimePriceId
      ? { price: lifetimePriceId, quantity: 1 }
      : lifetimePriceData);
  }

  return {
    lineItems,
    amount: plan === "monthly"
      ? monthlyPrice + (extras.includes("crm") ? crmPrice : 0) + (extras.includes("telegram_vip") ? telegramPrice : 0)
      : lifetimePrice,
  };
}

export async function createCheckoutSession(input: {
  email: string;
  name: string;
  lastName: string;
  origin?: string;
  plan?: unknown;
  extras?: unknown;
  offer?: "academy" | "funnel";
}) {
  const normalizedEmail = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new CustomError("Invalid email address", 400);
  }
  const offer = input.offer || "academy";
  const plan = offer === "academy" ? "lifetime" : normalizePlan(input.plan);
  const extras = normalizeExtras(input.extras, plan);
  const guest = await findOrCreateGuestUser(input);
  const { user, lockAcquired } = guest;
  const userId = user._id.toString();
  const lockedUser = lockAcquired ? user : await acquireCheckoutLock(userId);
  try {
    if (lockedUser.stripeSubscriptionId) {
      throw new CustomError("This account already has an active monthly subscription", 409);
    }
    if (lockedUser.foundingMember) {
      throw new CustomError("This account already has lifetime access", 409);
    }
    await cancelPendingCheckouts(userId);

    let isNew = guest.isNew;
    let plainPassword = guest.plainPassword;
    if (!isNew && lockedUser.createdByCheckout && lockedUser.subscriptionStatus === "none") {
      const hasPaymentHistory = await Payment.exists({ user: userId });
      if (!hasPaymentHistory) {
        plainPassword = generatePassword();
        lockedUser.password = await hashPassword(plainPassword);
        lockedUser.isVerified = true;
        await lockedUser.save();
        isNew = true;
      }
    }

    const { lineItems, amount } = buildLineItems(plan, extras, offer);
    const clientTransactionId = `${userId}-${Date.now()}`;
    const origin = resolveReturnOrigin(input.origin);
    const payment = await Payment.create({
      user: userId,
      plan,
      extras,
      amount,
      currency: "USD",
      clientTransactionId,
      status: "pending",
      isNewUser: isNew,
      plainPassword,
      origin,
    });
    if (plainPassword) {
      await Payment.updateMany(
        { user: userId, _id: { $ne: payment._id }, status: { $in: ["failed", "canceled"] } },
        { plainPassword: null },
      );
    }

    const metadata = { clientTransactionId, userId, plan, extras: extras.join(",") };
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: plan === "monthly" ? "subscription" : "payment",
      line_items: lineItems,
      client_reference_id: clientTransactionId,
      customer_email: normalizedEmail,
      metadata,
      success_url: `${origin}/pay-response?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#oferta`,
    };
    if (plan === "monthly") params.subscription_data = { metadata };
    else params.customer_creation = "always";

    const session = await stripe.checkout.sessions.create(params);
    await Payment.updateOne({ clientTransactionId }, { stripeSessionId: session.id });
    return { url: session.url, sessionId: session.id, clientTransactionId };
  } finally {
    await User.updateOne({ _id: userId }, { checkoutLockUntil: null });
  }
}

async function sendAccessEmail(payment: IPayment, user: IUser) {
  if (payment.isNewUser && payment.plainPassword) {
    await sendPaymentWelcomeEmail(user.email, user.name, payment.plainPassword, PUBLIC_ACADEMY_URL);
  } else {
    await sendPaymentConfirmationEmail(user.email, user.name, PUBLIC_ACADEMY_URL);
  }
}

async function getSubscriptionAccessUntil(subscriptionId: string): Promise<Date> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const periodEnd = Math.max(...subscription.items.data.map(item => item.current_period_end));
  if (!Number.isFinite(periodEnd) || periodEnd <= 0) {
    throw new Error("Stripe subscription has no valid billing period");
  }
  return new Date(periodEnd * 1000);
}

async function approveCheckout(payment: IPayment, session: Stripe.Checkout.Session, requireEmail = false) {
  const subscriptionId = stripeId(session.subscription);
  const paymentIntentId = stripeId(session.payment_intent);
  const user = await User.findById(payment.user);
  if (!user) throw new Error("Checkout user is missing");
  if (payment.plan === "monthly") {
    if (!subscriptionId) throw new Error("Monthly checkout has no Stripe subscription");
    if (user.foundingMember || (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscriptionId)) {
      await stripe.subscriptions.cancel(subscriptionId);
      await Payment.updateOne({ _id: payment._id }, { status: "canceled", stripeSubscriptionId: subscriptionId });
      throw new CustomError("This account already has active access", 409);
    }
  } else if (user.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    user.stripeSubscriptionId = null;
  }
  let approved = await Payment.findByIdAndUpdate(
    payment._id,
    { status: "approved", stripeSessionId: session.id, stripePaymentIntentId: paymentIntentId, stripeSubscriptionId: subscriptionId },
    { new: true },
  );
  if (!approved) throw new Error("Checkout fulfillment record is missing");

  if (!approved.fulfilledAt) {
    if (approved.plan !== "monthly") {
      user.accessUntil = new Date("2100-01-01T00:00:00Z");
      user.foundingMember = true;
      user.entitlements = ["crm", "telegram_vip"];
    } else {
      if (!subscriptionId) throw new Error("Monthly checkout has no Stripe subscription");
      user.accessUntil = await getSubscriptionAccessUntil(subscriptionId);
      user.stripeSubscriptionId = subscriptionId;
      user.entitlements = [...new Set([...(user.entitlements || []), ...approved.extras])];
    }
    user.subscriptionStatus = "active";
    const customerId = stripeId(session.customer);
    if (customerId) user.stripeCustomerId = customerId;
    await user.save();
    approved = await Payment.findByIdAndUpdate(approved._id, { fulfilledAt: new Date() }, { new: true });
    if (!approved) throw new Error("Checkout fulfillment could not be recorded");
  }

  if (!approved.emailSentAt) {
    try {
      await sendAccessEmail(approved, user);
      await Payment.updateOne({ _id: approved._id }, { emailSentAt: new Date() });
    } catch (error) {
      console.error("Failed to send payment email:", error);
      if (requireEmail) throw error;
    }
  }
  return user;
}

export async function verifySession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  let payment = await Payment.findOne({ stripeSessionId: sessionId });
  if (!payment && session.metadata?.clientTransactionId) {
    payment = await Payment.findOne({ clientTransactionId: session.metadata.clientTransactionId });
  }
  if (!payment) throw new CustomError("Payment record not found", 404);

  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  const user = paid ? await approveCheckout(payment, session) : await User.findById(payment.user);
  payment = await Payment.findById(payment._id);
  let plainPassword: string | undefined;
  if (paid && payment?.isNewUser && payment.plainPassword && !payment.credentialsViewedAt) {
    const claimedCredentials = await Payment.findOneAndUpdate(
      { _id: payment._id, credentialsViewedAt: null },
      { credentialsViewedAt: new Date() },
    );
    plainPassword = claimedCredentials?.plainPassword || undefined;
    if (claimedCredentials?.emailSentAt) {
      await Payment.updateMany({ user: payment.user, isNewUser: true }, { plainPassword: null });
    }
  }
  return {
    status: payment?.status || "pending",
    isNewUser: payment?.isNewUser || false,
    plainPassword,
    email: user?.email,
    stripePaymentStatus: session.payment_status,
  };
}

async function handleRenewalInvoice(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle") return;
  const subscription = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = stripeId(subscription || null);
  if (!subscriptionId) return;
  const original = await Payment.findOne({ stripeSubscriptionId: subscriptionId }).sort({ createdAt: 1 });
  if (!original) return;
  const clientTransactionId = `stripe-invoice-${invoice.id}`;
  let renewal = await Payment.findOne({ clientTransactionId });
  if (!renewal) {
    try {
      renewal = await Payment.create({
        user: original.user,
        plan: "monthly",
        extras: [],
        amount: invoice.amount_paid / 100,
        currency: "USD",
        status: "approved",
        stripeSubscriptionId: subscriptionId,
        clientTransactionId,
        isNewUser: false,
        origin: original.origin,
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      renewal = await Payment.findOne({ clientTransactionId });
    }
  }
  if (!renewal || renewal.fulfilledAt) return;

  const user = await User.findById(original.user);
  if (!user) throw new Error("Subscription user not found");
  const periodEnd = Math.max(...invoice.lines.data.map(line => line.period.end));
  if (!Number.isFinite(periodEnd) || periodEnd <= 0) {
    throw new Error("Stripe invoice has no valid billing period");
  }
  const accessUntil = new Date(periodEnd * 1000);
  if (!user.accessUntil || user.accessUntil < accessUntil) user.accessUntil = accessUntil;
  user.subscriptionStatus = "active";
  await user.save();
  await Payment.updateOne({ _id: renewal._id, fulfilledAt: null }, { fulfilledAt: new Date() });
}

async function updateSubscriptionStatus(subscriptionId: string, status: "pending" | "canceled") {
  const user = await User.findOne({ stripeSubscriptionId: subscriptionId });
  if (!user) return;
  user.subscriptionStatus = status;
  if (status === "canceled") user.stripeSubscriptionId = null;
  await user.save();
}

export async function handleWebhook(rawBody: Buffer | string | undefined, signature: string) {
  const secret = getWebhookSecret();
  if (!secret) throw new CustomError("Stripe webhook secret is not configured", 500);
  if (!rawBody) throw new CustomError("Stripe webhook body is missing", 400);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new CustomError("Webhook signature verification failed", 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const payment = session.metadata?.clientTransactionId
      ? await Payment.findOne({ clientTransactionId: session.metadata.clientTransactionId })
      : null;
    if (payment && paid) await approveCheckout(payment, session, true);
  } else if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const payment = session.metadata?.clientTransactionId
      ? await Payment.findOne({ clientTransactionId: session.metadata.clientTransactionId })
      : null;
    if (payment) await approveCheckout(payment, session, true);
  } else if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.clientTransactionId) {
      await Payment.updateOne(
        { clientTransactionId: session.metadata.clientTransactionId, status: "pending" },
        { status: "failed" },
      );
    }
  } else if (event.type === "invoice.paid") {
    await handleRenewalInvoice(event.data.object as Stripe.Invoice);
  } else if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscription = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = stripeId(subscription || null);
    if (subscriptionId) await updateSubscriptionStatus(subscriptionId, "pending");
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await updateSubscriptionStatus(subscription.id, "canceled");
  }
  return { received: true };
}

export async function cancelUserSubscription(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new CustomError("User not found", 404);
  if (!user.stripeSubscriptionId) throw new CustomError("No active monthly subscription found", 400);
  await stripe.subscriptions.cancel(user.stripeSubscriptionId);
  user.stripeSubscriptionId = null;
  user.subscriptionStatus = "canceled";
  await user.save();
  return { email: user.email, subscriptionStatus: user.subscriptionStatus };
}

export async function resendWelcomeEmail(sessionId: string) {
  const payment = await Payment.findOne({ stripeSessionId: sessionId });
  if (!payment) throw new CustomError("Payment not found", 404);
  if (payment.status !== "approved") throw new CustomError("Payment not approved yet", 400);
  const user = await User.findById(payment.user);
  if (!user) throw new CustomError("User not found", 404);
  await sendAccessEmail(payment, user);
  await Payment.updateOne(
    { _id: payment._id },
    {
      emailSentAt: new Date(),
      ...(payment.credentialsViewedAt ? { plainPassword: null } : {}),
    },
  );
  if (payment.credentialsViewedAt) {
    await Payment.updateMany({ user: payment.user, isNewUser: true }, { plainPassword: null });
  }
  return { resent: true, email: user.email };
}
