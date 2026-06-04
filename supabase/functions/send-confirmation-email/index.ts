import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const RESEND_FROM = "sales.planner@resend.dev"

interface WebhookPayload {
  type: string
  data: {
    id: string
    email: string
    user_metadata?: Record<string, any>
    confirmation_token?: string
  }
}

const emailTemplate = (confirmationUrl: string, email: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
      .header { text-align: center; margin-bottom: 40px; }
      .logo { font-size: 28px; margin-bottom: 10px; }
      .title { color: #1E5BA8; font-size: 24px; margin: 10px 0; }
      .subtitle { color: #666; font-size: 14px; }
      .content { background: #f9fafb; padding: 30px; border-radius: 8px; margin: 30px 0; }
      .content p { color: #333; line-height: 1.6; margin: 0 0 15px 0; }
      .button-container { text-align: center; margin: 30px 0; }
      .button { display: inline-block; background: linear-gradient(to right, #1E5BA8, #00D9FF); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
      .footer p { margin: 5px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="logo">📅</div>
        <h1 class="title">Sales Planner</h1>
        <p class="subtitle">90-Day Sales Visit Planner</p>
      </div>

      <!-- Main Content -->
      <div class="content">
        <p>Ciao! 👋</p>
        <p>Benvenuto in <strong>Sales Planner</strong>. Clicca il bottone qui sotto per confermare il tuo account e iniziare subito a pianificare le tue visite di vendita.</p>

        <div class="button-container">
          <a href="${confirmationUrl}" class="button">✓ Conferma Email</a>
        </div>

        <p style="font-size: 13px; color: #666; margin-top: 30px;">
          Oppure copia e incolla questo link nel browser:<br>
          <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; word-break: break-all;">${confirmationUrl}</code>
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>Se non hai creato questo account, ignora questa email.</p>
        <p>© 2024 Sales Planner • Bacardi</p>
      </div>
    </div>
  </body>
</html>
`

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const payload: WebhookPayload = await req.json()

    console.log("Webhook received:", payload.type)

    // Only send email on signup
    if (payload.type !== "user_signup") {
      return new Response(JSON.stringify({ message: "Not a signup event" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { email, confirmation_token } = payload.data

    if (!email || !confirmation_token) {
      throw new Error("Missing email or confirmation token")
    }

    // Build confirmation URL
    const baseUrl = Deno.env.get("SITE_URL") || "http://localhost:5173"
    const confirmationUrl = `${baseUrl}/#access_token=${confirmation_token}&type=recovery`

    // Send email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: email,
        subject: "Conferma il tuo account Sales Planner",
        html: emailTemplate(confirmationUrl, email),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Resend error: ${error}`)
    }

    const result = await response.json()
    console.log("Email sent:", result)

    return new Response(JSON.stringify({ success: true, messageId: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error sending email:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
