import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const BRAND = "Bakanology Academy";

export async function sendVerificationEmail(
  to: string,
  token: string,
  frontendUrl: string,
): Promise<void> {
  const link = `${frontendUrl}/verificar-email?token=${token}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Verifica tu cuenta — ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Confirma tu correo electrónico</h2>
        <p>Gracias por registrarte en <strong>${BRAND}</strong>. Haz clic en el botón para verificar tu cuenta:</p>
        <a href="${link}" style="display: inline-block; margin: 16px 0; padding: 14px 24px; background: #e6285c; color: #fff; text-decoration: none; border-radius: 6px;">Verificar mi cuenta</a>
        <p style="font-size: 14px; color: #666;">O copia y pega este enlace en tu navegador:</p>
        <p style="font-size: 14px; word-break: break-all;">${link}</p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">Este enlace expira en 24 horas.</p>
      </div>
    `,
  });
}

export async function sendLoginEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Nuevo inicio de sesión — ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Hola, ${name}</h2>
        <p>Acabas de iniciar sesión en tu cuenta de <strong>${BRAND}</strong>.</p>
        <p style="font-size: 14px; color: #666;">Si no fuiste tú, por favor cambia tu contraseña de inmediato.</p>
      </div>
    `,
  });
}

export async function sendAdminInviteEmail(
  to: string,
  name: string,
  password: string,
  verificationLink: string,
): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Tu invitación a ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Bienvenido, ${name}</h2>
        <p>Has sido invitado a unirte a <strong>${BRAND}</strong>.</p>
        <p>Tus credenciales de acceso son:</p>
        <ul style="font-size: 14px; color: #666;">
          <li><strong>Correo:</strong> ${to}</li>
          <li><strong>Contraseña:</strong> ${password}</li>
        </ul>
        <p>Para activar tu cuenta, verifica tu correo haciendo clic en el siguiente botón:</p>
        <a href="${verificationLink}" style="display: inline-block; margin: 16px 0; padding: 14px 24px; background: #e6285c; color: #fff; text-decoration: none; border-radius: 6px;">Verificar mi cuenta</a>
        <p style="font-size: 14px; color: #666;">O copia y pega este enlace:</p>
        <p style="font-size: 14px; word-break: break-all;">${verificationLink}</p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">Este enlace expira en 24 horas. Te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
      </div>
    `,
  });
}

export async function sendAccessExtendedEmail(
  to: string,
  name: string,
  accessUntil: Date,
): Promise<void> {
  const dateLabel = accessUntil.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Tu acceso fue extendido — ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Hola, ${name}</h2>
        <p>Tu acceso a <strong>${BRAND}</strong> ha sido extendido exitosamente.</p>
        <p style="font-size: 16px; margin: 16px 0;">Ahora tienes acceso activo hasta el <strong>${dateLabel}</strong>.</p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">Si tienes preguntas, escríbenos por WhatsApp.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string,
): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Restablece tu contraseña — ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Hola, ${name}</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${BRAND}</strong>.</p>
        <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
        <a href="${resetUrl}" style="display: inline-block; margin: 16px 0; padding: 14px 24px; background: #e6285c; color: #fff; text-decoration: none; border-radius: 6px;">Restablecer contraseña</a>
        <p style="font-size: 14px; color: #666;">O copia y pega este enlace:</p>
        <p style="font-size: 14px; word-break: break-all;">${resetUrl}</p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetConfirmationEmail(
  to: string,
  name: string,
): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Contraseña actualizada — ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Hola, ${name}</h2>
        <p>Tu contraseña de <strong>${BRAND}</strong> fue actualizada correctamente.</p>
        <p style="font-size: 14px; color: #666;">Si no fuiste tú quien realizó este cambio, por favor contacta a soporte de inmediato.</p>
      </div>
    `,
  });
}

export async function sendPaymentWelcomeEmail(
  to: string,
  name: string,
  password: string,
  loginUrl: string,
): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Bienvenido a ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #191423; font-size: 24px; margin: 0;">${BRAND}</h1>
        </div>

        <h2 style="color: #111;">¡Bienvenido, ${name}!</h2>
        <p style="font-size: 15px; line-height: 1.6;">Tu pago fue procesado correctamente y ya tienes <strong>acceso de por vida</strong> a todos los cursos, CRM y actualizaciones futuras.</p>

        <div style="background: #f5f3ef; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #666;"><strong>Tus credenciales de acceso:</strong></p>
          <p style="margin: 0; font-size: 14px; color: #333;"><strong>Correo:</strong> ${to}</p>
          <p style="margin: 4px 0 0; font-size: 14px; color: #333;"><strong>Contraseña:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${password}</code></p>
        </div>

        <a href="${loginUrl}" style="display: block; text-align: center; margin: 20px 0; padding: 14px 24px; background: #e6285c; color: #fff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Iniciar sesión</a>

        <p style="font-size: 13px; color: #999; text-align: center;">O copia este enlace en tu navegador:<br><span style="word-break: break-all;">${loginUrl}</span></p>

        <div style="background: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; padding: 12px; margin: 20px 0; font-size: 13px; color: #856404;">
          <strong>📌 ¿No encuentras el correo?</strong><br>
          Revisa tu carpeta de <strong>Spam / Correo no deseado</strong>.<br>
          Si está ahí, márcalo como "No es spam" para asegurar la entrega.
        </div>

        <p style="font-size: 12px; color: #999; margin-top: 16px;">Te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
      </div>
    `,
  });
}

export async function sendPaymentConfirmationEmail(
  to: string,
  name: string,
  loginUrl: string,
): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Pago confirmado — ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #191423; font-size: 24px; margin: 0;">${BRAND}</h1>
        </div>

        <h2 style="color: #111;">¡Pago confirmado, ${name}!</h2>
        <p style="font-size: 15px; line-height: 1.6;">Tu pago fue procesado correctamente y tu <strong>acceso de por vida</strong> está activo. Ya puedes acceder a todos los cursos, CRM y actualizaciones futuras.</p>

        <a href="${loginUrl}" style="display: block; text-align: center; margin: 20px 0; padding: 14px 24px; background: #e6285c; color: #fff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Ir a mi dashboard</a>

        <p style="font-size: 13px; color: #999; text-align: center;">O copia este enlace en tu navegador:<br><span style="word-break: break-all;">${loginUrl}</span></p>

        <div style="background: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; padding: 12px; margin: 20px 0; font-size: 13px; color: #856404;">
          <strong>📌 ¿No encuentras el correo?</strong><br>
          Revisa tu carpeta de <strong>Spam / Correo no deseado</strong>.<br>
          Si está ahí, márcalo como "No es spam" para asegurar la entrega.
        </div>

        <p style="font-size: 12px; color: #999; margin-top: 16px;">Gracias por ser parte de ${BRAND}.</p>
      </div>
    `,
  });
}

export async function sendManualPaymentReceiptEmail(
  to: string,
  name: string,
  plan: "monthly" | "annual",
  amount: number,
  accessUntil: Date,
  receiptUrl: string,
): Promise<void> {
  const planLabel = plan === "annual" ? "anualidad" : "mensualidad";
  const dateLabel = accessUntil.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL as string,
    to,
    subject: `Comprobante de pago registrado — ${BRAND}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Hola, ${name}</h2>
        <p>Hemos registrado tu pago por <strong>USD ${amount}</strong> correspondiente a la ${planLabel}.</p>
        <p style="font-size: 16px; margin: 16px 0;">Tu acceso está activo hasta el <strong>${dateLabel}</strong>.</p>
        <p>Puedes ver el comprobante aquí:</p>
        <a href="${receiptUrl}" style="display: inline-block; margin: 16px 0; padding: 14px 24px; background: #e6285c; color: #fff; text-decoration: none; border-radius: 6px;">Ver comprobante</a>
        <p style="font-size: 14px; word-break: break-all;">${receiptUrl}</p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">Gracias por ser parte de ${BRAND}.</p>
      </div>
    `,
  });
}
