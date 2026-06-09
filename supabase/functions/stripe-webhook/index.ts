// TampaRestore - Stripe Webhook
// Handles checkout.session.completed to mark commissions as paid

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

Deno.serve(async (req) => {
  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature') || ''

    // Verify webhook signature
    if (STRIPE_WEBHOOK_SECRET) {
      const isValid = await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET)
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 })
      }
    }

    const event = JSON.parse(body)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const metadata = session.metadata || {}
      const commissionId = metadata.commission_id
      const leadId = metadata.lead_id
      const contractorEmail = metadata.contractor_email

      if (commissionId) {
        const timestamp = new Date().toISOString()
        await fetch(`${SUPABASE_URL}/rest/v1/commissions?id=eq.${commissionId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: 'completed',
            paid_at: timestamp,
            stripe_payment_intent_id: session.payment_intent || session.id,
          })
        })
        console.log(`Commission ${commissionId} marked as paid`)
      }

      if (contractorEmail) {
        // Send receipt confirmation
        const gmailUser = Deno.env.get('GMAIL_USER') || 'tylerbelislefl@gmail.com'
        const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''
        if (gmailAppPassword) {
          const amount = (session.amount_total || 0) / 100
          await sendEmail(gmailUser, gmailAppPassword, contractorEmail,
            '💰 Payment Received - TampaRestore Pro Leads',
            `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
              <div style="background:#059669;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="color:white;font-size:20px;margin:0;">💰 Payment Successful</h1>
              </div>
              <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p style="font-size:16px;">Your payment of <strong>$${amount}</strong> has been received.</p>
                <p>You can now receive new leads.</p>
                <hr>
                <p style="font-size:13px;color:#666;">Lead ID: ${leadId || 'N/A'}</p>
              </div>
            </div>`)
        }
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object
      const metadata = pi.metadata || {}
      const commissionId = metadata.commission_id
      if (commissionId) {
        const timestamp = new Date().toISOString()
        await fetch(`${SUPABASE_URL}/rest/v1/commissions?id=eq.${commissionId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: 'completed',
            paid_at: timestamp,
            stripe_payment_intent_id: pi.id,
          })
        })
        console.log(`PaymentIntent ${pi.id} - commission ${commissionId} marked as paid`)
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object
      const metadata = pi.metadata || {}
      const commissionId = metadata.commission_id
      if (commissionId) {
        await fetch(`${SUPABASE_URL}/rest/v1/commissions?id=eq.${commissionId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ status: 'failed' })
        })
      }
      const gmailUser = Deno.env.get('GMAIL_USER') || 'tylerbelislefl@gmail.com'
      const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''
      if (gmailAppPassword && metadata.contractor_email) {
        await sendEmail(gmailUser, gmailAppPassword, metadata.contractor_email,
          '❌ Payment Failed - Update Your Card',
          `<p>Your payment of $${(pi.amount || 0) / 100} failed.</p>
           <p>Please update your payment method to continue receiving leads.</p>`)
      }
    }

    return new Response('ok', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Webhook error: ' + error.message, { status: 400 })
  }
})

async function verifyStripeSignature(body: string, sig: string, secret: string): Promise<boolean> {
  try {
    const parts = sig.split(',').reduce((acc: Record<string, string>, p) => {
      const [k, v] = p.trim().split('=')
      acc[k] = v
      return acc
    }, {})
    const payloadSig = parts['v1'] || ''
    if (!payloadSig) return false

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      hexToBytes(payloadSig),
      new TextEncoder().encode(body)
    )
    return valid
  } catch {
    return false
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function sendEmail(user: string, password: string, to: string, subject: string, html: string) {
  try {
    const conn = await Deno.connect({ hostname: 'smtp.gmail.com', port: 587 })
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const readResponse = async (): Promise<string> => {
      const buffer = new Uint8Array(1024)
      const n = await conn.read(buffer)
      return decoder.decode(buffer.slice(0, n))
    }
    const send = async (data: string) => { await conn.write(encoder.encode(data)) }
    await readResponse()
    await send('EHLO localhost\r\n'); await readResponse()
    await send('STARTTLS\r\n'); await readResponse()
    const tlsConn = await Deno.startTls(conn, { hostname: 'smtp.gmail.com' })
    const te = new TextEncoder(); const td = new TextDecoder()
    const ts = async (d: string) => { await tlsConn.write(te.encode(d)) }
    const tr = async (): Promise<string> => { const b = new Uint8Array(1024); const n = await tlsConn.read(b); return td.decode(b.slice(0, n)) }
    await ts('EHLO localhost\r\n'); await tr()
    await ts('AUTH LOGIN\r\n'); await tr()
    await ts(btoa(user) + '\r\n'); await tr()
    await ts(btoa(password) + '\r\n')
    const auth = await tr()
    if (!auth.includes('235')) { tlsConn.close(); return false }
    await ts('MAIL FROM:<' + user + '>\r\n'); await tr()
    await ts('RCPT TO:<' + to + '>\r\n'); await tr()
    await ts('DATA\r\n')
    await ts(`From: <${user}>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.\r\n`)
    await tr()
    await ts('QUIT\r\n')
    tlsConn.close()
    return true
  } catch (e) { console.error('sendEmail failed:', e); return false }
}
