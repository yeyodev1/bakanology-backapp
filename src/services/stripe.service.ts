import Stripe from "stripe";
import { Payment } from "../models/Payment";
import { User } from "../models/User";
import { CustomError } from "../errors/customError.error";
import { hashPassword } from "../helpers/password.helper";
import { sendPaymentWelcomeEmail, sendPaymentConfirmationEmail } from "../helpers/email.helper";
import crypto from "crypto";

function getStripeKey(): string {
  const isProd = process.env.NODE_ENV === "production";
  return isProd
    ? (process.env.STRIPE_SECRET_KEY as string)
    : (process.env.STRIPE_TEST_SECRET_KEY as string);
}

function getWebhookSecret(): string | undefined {
  const isProd = process.env.NODE_ENV === "production";
  return isProd
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_TEST_WEBHOOK_SECRET;
}

const stripe = new Stripe(getStripeKey());

function generatePassword() {
  return crypto.randomBytes(8).toString("hex");
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

async function findOrCreateGuestUser(input: {
  email: string;
  name: string;
  lastName: string;
}) {
  const normalizedEmail = input.email.toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });

  if (user) return { user, isNew: false, plainPassword: null };

  const plainPassword = generatePassword();
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
  });

  return { user, isNew: true, plainPassword };
}

export async function createCheckoutSession(input: {
  email: string;
  name: string;
  lastName: string;
  origin?: string;
}) {
  const { user, isNew, plainPassword } = await findOrCreateGuestUser(input);
  const amount = Number(process.env.LIFETIME_PRICE) || 297;
  const userId = user._id.toString();
  const clientTransactionId = `${userId}-${Date.now()}`;

  await Payment.create({
    user: userId,
    plan: "lifetime",
    amount,
    currency: "USD",
    clientTransactionId,
    status: "pending",
    isNewUser: isNew,
    plainPassword,
    origin: input.origin || null,
  });

  const successUrl = `${input.origin || process.env.FRONTEND_URL || ""}/pay-response?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${input.origin || process.env.FRONTEND_URL || ""}/`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount * 100,
          product_data: {
            name: "Acceso de por vida — Bakanology Academy",
            description: "Pago único, acceso vitalicio. Incluye todas las actualizaciones futuras.",
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: clientTransactionId,
    customer_email: input.email,
    metadata: {
      clientTransactionId,
      userId,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await Payment.updateOne(
    { clientTransactionId },
    { stripeSessionId: session.id },
  );

  return { url: session.url, sessionId: session.id, isNewUser: isNew, plainPassword, clientTransactionId };
}

export async function verifySession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session) throw new CustomError("Session not found", 404);

  let payment = await Payment.findOne({ stripeSessionId: sessionId });

  if (!payment) {
    const clientTransactionId = session.metadata?.clientTransactionId;
    if (clientTransactionId) {
      payment = await Payment.findOne({ clientTransactionId });
    }
  }

  if (!payment) throw new CustomError("Payment record not found", 404);

  if (payment.stripeSessionId !== sessionId) {
    payment.stripeSessionId = sessionId;
    await payment.save();
  }

  if (session.payment_status === "paid" && payment.status === "pending") {
    payment.status = "approved";
    payment.stripePaymentIntentId = session.payment_intent as string;
    await payment.save();

    const user = await User.findById(payment.user);
    if (user) {
      user.accessUntil = new Date("2100-01-01T00:00:00Z");
      user.subscriptionStatus = "active";
      user.stripeCustomerId = session.customer as string;
      user.foundingMember = true;
      await user.save();

      const baseUrl = payment.origin || process.env.FRONTEND_URL || "";
      const loginUrl = `${baseUrl}/login`;
      try {
        if (payment.isNewUser && payment.plainPassword) {
          await sendPaymentWelcomeEmail(
            user.email,
            user.name,
            payment.plainPassword,
            loginUrl,
          );
        } else {
          await sendPaymentConfirmationEmail(user.email, user.name, loginUrl);
        }
      } catch (err) {
        console.error("Failed to send payment email:", err);
      }
    }

    return { status: "approved", isNewUser: payment.isNewUser, plainPassword: payment.isNewUser ? payment.plainPassword : undefined, email: user?.email, stripePaymentStatus: session.payment_status };
  }

  if (payment.plan === "lifetime" && session.payment_status === "paid") {
    const user = await User.findById(payment.user);
    if (user && !user.foundingMember) {
      user.foundingMember = true;
      await user.save();
    }
  }

  return { status: payment.status, isNewUser: false, email: (await User.findById(payment.user))?.email, stripePaymentStatus: session.payment_status };
}

export async function handleWebhook(rawBody: string, signature: string) {
  const secret = getWebhookSecret();
  if (!secret) {
    console.warn("No Stripe webhook secret set, skipping webhook verification");
    return { received: true };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new CustomError("Webhook signature verification failed", 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const clientTransactionId = session.metadata?.clientTransactionId;
    if (!clientTransactionId) return { received: true };

    const payment = await Payment.findOne({ clientTransactionId });
    if (!payment || payment.status !== "pending") return { received: true };

    payment.status = "approved";
    payment.stripeSessionId = session.id;
    payment.stripePaymentIntentId = session.payment_intent as string;
    await payment.save();

    const user = await User.findById(payment.user);
    if (user) {
      user.accessUntil = new Date("2100-01-01T00:00:00Z");
      user.subscriptionStatus = "active";
      user.stripeCustomerId = session.customer as string;
      user.foundingMember = true;
      await user.save();

      const baseUrl = payment.origin || process.env.FRONTEND_URL || "";
      const loginUrl = `${baseUrl}/login`;
      try {
        if (payment.isNewUser && payment.plainPassword) {
          await sendPaymentWelcomeEmail(
            user.email,
            user.name,
            payment.plainPassword,
            loginUrl,
          );
        } else {
          await sendPaymentConfirmationEmail(user.email, user.name, loginUrl);
        }
      } catch (err) {
        console.error("Failed to send payment email:", err);
      }
    }
  }

  return { received: true };
}

export async function resendWelcomeEmail(sessionId: string) {
  const payment = await Payment.findOne({ stripeSessionId: sessionId });
  if (!payment) throw new CustomError("Payment not found", 404);
  if (payment.status !== "approved") throw new CustomError("Payment not approved yet", 400);

  const user = await User.findById(payment.user);
  if (!user) throw new CustomError("User not found", 404);

  const baseUrl = payment.origin || process.env.FRONTEND_URL || "";
  const loginUrl = `${baseUrl}/login`;

  if (payment.isNewUser && payment.plainPassword) {
    await sendPaymentWelcomeEmail(
      user.email,
      user.name,
      payment.plainPassword,
      loginUrl,
    );
  } else {
    await sendPaymentConfirmationEmail(user.email, user.name, loginUrl);
  }

  return { resent: true, email: user.email };
}
