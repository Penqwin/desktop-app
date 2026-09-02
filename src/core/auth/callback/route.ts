// src/app/core/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { sanitizeInternalPath } from '@/utils/security/safe-path'
import { sendEmail } from '@/services/email/resend-service'
import { WelcomeEmailHtml, WelcomeEmailText } from '@/services/email/templates/welcome-email'
import * as React from 'react'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeInternalPath(searchParams.get('next'), '/')

  if (code) {
    const supabase = await createClient()

    // This exchanges the temporary GitHub/Google code for a permanent session cookie
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // ── Onboarding email ────────────────────────────────────────────────────
      // Retrieve the newly authenticated user's details
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user && !user.user_metadata?.welcome_email_sent && user.email) {
        // Derive display name from OAuth metadata, falling back to email prefix
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email.split('@')[0]

        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/dashboard`

        // Fire-and-forget: do NOT await so the redirect is instant for the user
        sendEmail({
          to: user.email,
          subject: 'Welcome to Penqwin! 🎉',
          react: React.createElement(WelcomeEmailHtml, { name, loginUrl: dashboardUrl }),
          text: WelcomeEmailText({ name, loginUrl: dashboardUrl }),
        })
          .then(async (result) => {
            if (result.success) {
              // Mark the user so they never receive this email again
              await supabase.auth.updateUser({
                data: { welcome_email_sent: true },
              })
              console.log(`[auth-callback] Welcome email sent to ${user.email}`)
            } else {
              console.error('[auth-callback] Welcome email failed:', result.error)
            }
          })
          .catch((err) => {
            console.error('[auth-callback] Unexpected error sending welcome email:', err)
          })
      }
      // ── End onboarding email ─────────────────────────────────────────────────

      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // If there's no code or an exchange error, send them to a failure page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}