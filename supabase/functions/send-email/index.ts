// TampaRestore - Send Email Edge Function
// Charge-per-lead: auto-pay charges card, manual creates pending invoice
// Gate: max 3 unpaid pending commissions before blocking

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const ANON_KEY = Deno.env.get('ANON_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''

const MAX_PENDING_COMMISSIONS = 3
const PRICE_DEFAULTS: Record<string, number> = {
  'website': 100,
  'handyman': 35,
  'electrician': 65,
  'hvac': 75,
  'plumber': 55,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    const name = params.get('name') || ''
    const phone = params.get('phone') || ''
    const email = params.get('email') || ''
    const city = params.get('city') || ''
    const damageType = params.get('damage-type') || ''
    const description = params.get('description') || ''
    const source = params.get('source') || 'website'

    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const gmailUser = Deno.env.get('GMAIL_USER') || 'tylerbelislefl@gmail.com'
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''
    const actionBaseUrl = `${SUPABASE_URL}/functions/v1/contractor-action`

    console.log('send-email: source:', source, 'gmail:', !!gmailAppPassword, 'stripe:', !!STRIPE_SECRET_KEY)

    if (!gmailAppPassword) {
      return new Response(JSON.stringify({ error: 'GMAIL_APP_PASSWORD not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const TRADE_CONFIG: Record<string, { name: string; emoji: string; color: string; header: string; subject: string }> = {
      'website':  { name: 'Tampa Restore', emoji: '💧', color: '#D92B2B', header: 'NEW WATER DAMAGE LEAD', subject: 'New Lead' },
      'handyman': { name: 'Handyman', emoji: '🔧', color: '#059669', header: 'NEW HANDYMAN SERVICE REQUEST', subject: 'Handyman Lead' },
      'electrician': { name: 'Electrician', emoji: '⚡', color: '#D97706', header: 'NEW ELECTRICAL SERVICE REQUEST', subject: 'Electrician Lead' },
      'hvac':    { name: 'HVAC', emoji: '❄️', color: '#2563EB', header: 'NEW HVAC SERVICE REQUEST', subject: 'HVAC Lead' },
      'plumber': { name: 'Plumber', emoji: '🔩', color: '#0D9488', header: 'NEW PLUMBING SERVICE REQUEST', subject: 'Plumber Lead' },
    }
    const trade = TRADE_CONFIG[source] || TRADE_CONFIG['website']
    const accentColor = trade.color

    // Get lead_id from DB - find most recent lead matching name + phone
    let leadId = ''
    let contractorEmail = ''
    let usedContractor: any = null
    
    if (SUPABASE_KEY) {
      const leadRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?phone=eq.${phone}&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
          }
        }
      )
      const leads = await leadRes.json()
      if (leads && leads.length > 0) {
        leadId = leads[0].id
        contractorEmail = leads[0].assigned_contractor_email || ''
        console.log('Found lead:', leadId, 'contractor:', contractorEmail)
      }
    }

    // If no contractor assigned, find one with payment
    if (!contractorEmail && SUPABASE_KEY) {
      let contractors: any[] = await fetchContractors(source)

      if (contractors && contractors.length > 0) {
        // Gate check: filter out those with 3+ unpaid commissions
        const available = await getAvailableContractors(contractors)
        console.log(`Available contractors after gate: ${available.length}/${contractors.length}`)

        // Try each available contractor until one pays or we run out
        for (const c of available) {
          const price = c.price_per_lead || PRICE_DEFAULTS[source] || 75
          const autoPay = c.auto_pay === true
          const hasCard = !!c.stripe_customer_id && !!c.stripe_payment_method_id

          console.log(`Trying contractor ${c.email}: autoPay=${autoPay}, hasCard=${hasCard}, price=$${price}`)

          if (autoPay && hasCard && STRIPE_SECRET_KEY) {
            // Auto-pay: attempt charge (retry up to 3 times)
            const charged = await attemptAutoPay(c, leadId, source, price, trade)
            if (charged) {
              contractorEmail = c.email
              usedContractor = c
              console.log('Auto-pay succeeded for:', contractorEmail)
              break
            } else {
              console.log('Auto-pay failed for:', c.email, '- trying next contractor')
              // Notify contractor their card declined
              if (gmailAppPassword) {
                await sendEmailGmailSmtp(gmailUser, gmailAppPassword, c.email,
                  `❌ Payment Declined - Update Your Card`,
                  `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
                    <div style="background:#DC2626;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
                      <h1 style="color:white;font-size:18px;margin:0;">❌ Card Declined</h1>
                    </div>
                    <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                      <p>We tried to charge <strong>$${price}</strong> for a new ${trade.emoji} lead but your card was declined.</p>
                      <p>Update your payment method to keep receiving leads.</p>
                      <p>This lead has been passed to the next available contractor.</p>
                    </div>
                  </div>`)
              }
              continue
            }
          } else {
            // Manual: create pending commission, send lead immediately
            const commissionId = crypto.randomUUID()
            const created = await supFetch('/rest/v1/commissions', {
              method: 'POST',
              body: JSON.stringify({
                id: commissionId,
                lead_id: leadId,
                contractor_email: c.email,
                trade: source,
                amount: price,
                status: 'pending',
                created_at: new Date().toISOString(),
              })
            })
            if (created.ok) {
              contractorEmail = c.email
              usedContractor = c
              console.log('Manual: pending commission created for:', contractorEmail)
              break
            }
          }
        }

        if (!contractorEmail) {
          console.log('All contractors failed payment or blocked by gate for trade:', source)
          await sendEmailGmailSmtp(
            gmailUser, gmailAppPassword, adminEmail,
            `⚠️ All ${source} contractors unavailable for ${name}`,
            `<p>No contractor could be assigned:</p>
             <ul>
               <li>Some have 3+ unpaid invoices (gate blocked)</li>
               <li>Others had payment failures (card declined)</li>
             </ul>
             <p><strong>Lead:</strong> ${name} - ${phone}</p>
             <p><strong>City:</strong> ${city}</p>
             <p>Resolve outstanding payments or add more contractors.</p>`
          )
        }
      }
    }

    // Fallback to default if no contractor found
    if (!contractorEmail) {
      contractorEmail = 'ctbelisle@gmail.com'
      console.log('Using default contractor:', contractorEmail)
    }

    // Assign lead to contractor in DB
    if (leadId && SUPABASE_KEY && usedContractor) {
      await supFetch(`/rest/v1/leads?id=eq.${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigned_contractor_email: contractorEmail,
          sent_to_contractor_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'sent',
        })
      })
    }

    // Record events on the lead
    if (leadId && SUPABASE_KEY) {
      try {
        const events = [{ type: 'sent', contractor: contractorEmail, timestamp: new Date().toISOString() }]
        const getRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=events`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json'
            }
          }
        )
        const existing = await getRes.json()
        if (existing && existing.length > 0 && Array.isArray(existing[0].events)) {
          events.push(...existing[0].events)
        }
        await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ events })
        })
      } catch (evErr) {
        console.error('Failed to record event:', evErr)
      }
    }

    // Build confirm/decline buttons
    let buttonsHtml = ''
    if (leadId) {
      const confirmUrl = `${actionBaseUrl}?action=confirm&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}&apikey=${ANON_KEY}`
      const declineUrl = `${actionBaseUrl}?action=decline&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}&apikey=${ANON_KEY}`
      
      buttonsHtml = `
        <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
          <p style="margin-bottom: 15px; font-size: 16px;"><strong>Quick Actions:</strong></p>
          <a href="${confirmUrl}" style="display: inline-block; background: ${accentColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin-right: 12px;">[ACCEPTED] I Will Call This Lead</a>
          <a href="${declineUrl}" style="display: inline-block; background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">[DECLINE] Pass to Next Contractor</a>
          <p style="margin-top: 15px; font-size: 12px; color: #666;">Or reply with CONFIRMED or DECLINED</p>
        </div>
      `
    }

    const leadHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: ${accentColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; font-size: 20px; margin: 0;">${trade.emoji} ${trade.header}</h1>
        </div>
        <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;"><strong>Name:</strong> ${name}</p>
          <p style="font-size: 16px;"><strong>Phone:</strong> <a href="tel:${phone}" style="color: ${accentColor}; font-weight: bold;">${phone}</a></p>
          <p style="font-size: 16px;"><strong>Email:</strong> ${email || 'N/A'}</p>
          <p style="font-size: 16px;"><strong>City:</strong> ${city}</p>
          <p style="font-size: 16px;"><strong>Service:</strong> ${damageType || 'N/A'}</p>
          <p style="font-size: 16px;"><strong>Description:</strong> ${description || 'N/A'}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: ${accentColor}; font-weight: bold; font-size: 18px;">⚠️ CALL THIS LEAD WITHIN 5 MINUTES!</p>
          ${buttonsHtml}
        </div>
      </div>
    `

    const adminHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: ${accentColor}; padding: 16px 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; font-size: 18px; margin: 0;">${trade.emoji} New ${trade.name} Lead</h2>
        </div>
        <div style="padding: 20px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>City:</strong> ${city}</p>
          <p><strong>Service:</strong> ${damageType || 'N/A'}</p>
          <p><strong>Source:</strong> <span style="color:${accentColor};font-weight:bold;">${trade.emoji} ${trade.name}</span></p>
          <p><strong>Contractor:</strong> ${contractorEmail}</p>
          <p><strong>Lead ID:</strong> ${leadId || 'N/A'}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `

    // Send to contractor
    const contractorSubject = `${trade.emoji} ${trade.subject} - ${name} - ${city}`
    const contractorStatus = await sendEmailGmailSmtp(
      gmailUser,
      gmailAppPassword,
      contractorEmail,
      contractorSubject,
      leadHtml
    )
    console.log('Contractor email result:', contractorStatus, 'to:', contractorEmail)

    // Send to admin
    const adminSubject = `${trade.emoji} New ${trade.name} Lead: ${name}`
    const adminStatus = await sendEmailGmailSmtp(
      gmailUser,
      gmailAppPassword,
      adminEmail,
      adminSubject,
      adminHtml
    )
    console.log('Admin email result:', adminStatus)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Emails sent',
      leadId,
      contractorEmail
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Fetch active contractors by trade (with fallbacks)
async function fetchContractors(source: string): Promise<any[]> {
  if (!SUPABASE_KEY) return []

  // Try trade-specific first
  let res = await fetch(
    `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&trade=eq.${source}&order=priority.asc`,
    {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }
  )
  let contractors = await res.json()

  if (!contractors || contractors.length === 0) {
    res = await fetch(
      `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&or=(trade.eq.,trade.is.null)&order=priority.asc`,
      {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
      }
    )
    contractors = await res.json()
  }

  if (!contractors || contractors.length === 0) {
    res = await fetch(
      `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&order=priority.asc`,
      {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
      }
    )
    contractors = await res.json()
  }

  return contractors || []
}

// Count pending commissions for a contractor
async function countPendingCommissions(contractorEmail: string): Promise<number> {
  try {
    if (!SUPABASE_KEY) return 0
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/commissions?contractor_email=eq.${encodeURIComponent(contractorEmail)}&status=eq.pending&select=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        }
      }
    )
    const data = await res.json()
    return Array.isArray(data) ? data.length : 0
  } catch (e) {
    console.error('Count pending failed:', e)
    return 0
  }
}

// Gate: only allow contractors with < MAX_PENDING_COMMISSIONS unpaid
async function getAvailableContractors(contractors: any[]): Promise<any[]> {
  const available: any[] = []
  for (const c of contractors) {
    const pending = await countPendingCommissions(c.email)
    if (pending < MAX_PENDING_COMMISSIONS) {
      available.push(c)
    } else {
      console.log(`Gate blocked ${c.email}: ${pending} pending commissions`)
    }
  }
  return available.length > 0 ? available : contractors
}

// Attempt auto-pay charge (up to 3 retries)
async function attemptAutoPay(contractor: any, leadId: string, source: string, amount: number, trade: any): Promise<boolean> {
  if (!STRIPE_SECRET_KEY || !contractor.stripe_customer_id || !contractor.stripe_payment_method_id) return false

  // Create commission record first (so webhook can reference it)
  const commissionId = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  await supFetch('/rest/v1/commissions', {
    method: 'POST',
    body: JSON.stringify({
      id: commissionId,
      lead_id: leadId,
      contractor_email: contractor.email,
      trade: source,
      amount,
      status: 'pending',
      created_at: timestamp,
    })
  })

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const pi = await stripeFetch('/v1/payment_intents', {
        amount: Math.round(amount * 100),
        currency: 'usd',
        customer: contractor.stripe_customer_id,
        payment_method: contractor.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `${trade.emoji} ${trade.name} Lead`,
        metadata: { lead_id: leadId, commission_id: commissionId, contractor_email: contractor.email },
      })

      if (pi.status === 'succeeded' || pi.status === 'processing') {
        await supFetch(`/rest/v1/commissions?id=eq.${commissionId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            paid_at: timestamp,
            stripe_payment_intent_id: pi.id,
          })
        })
        console.log(`Auto-pay success (attempt ${attempt}): $${amount} from ${contractor.email}`)
        return true
      } else {
        console.log(`Auto-pay attempt ${attempt} failed: status=${pi.status}`)
        // Try again
      }
    } catch (e) {
      console.error(`Auto-pay attempt ${attempt} error:`, e)
    }
  }

  // All attempts failed — mark commission as failed
  await supFetch(`/rest/v1/commissions?id=eq.${commissionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'failed' })
  })
  return false
}

// Supabase fetch helper
async function supFetch(path: string, options?: RequestInit): Promise<Response> {
  const opts: RequestInit = {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    ...options,
  }
  if (opts.body && typeof opts.body === 'string') {
    // already stringified
  } else if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body)
  }
  return fetch(SUPABASE_URL + path, opts)
}

// Stripe helpers (copied from complete-job)
function encodeStripeParams(data: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = []
  for (const [key, val] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (val === null || val === undefined) continue
    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          parts.push(encodeStripeParams(item as Record<string, unknown>, `${fullKey}[${i}]`))
        } else {
          parts.push(`${fullKey}[${i}]=${encodeURIComponent(String(item))}`)
        }
      })
    } else if (typeof val === 'object') {
      parts.push(encodeStripeParams(val as Record<string, unknown>, fullKey))
    } else {
      parts.push(`${fullKey}=${encodeURIComponent(String(val))}`)
    }
  }
  return parts.join('&')
}

async function stripeFetch(path: string, data: Record<string, unknown>): Promise<any> {
  const formBody = encodeStripeParams(data)
  const res = await fetch('https://api.stripe.com' + path, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  })
  return res.json()
}

async function sendEmailGmailSmtp(user: string, password: string, to: string, subject: string, html: string) {
  const conn = await Deno.connect({ hostname: 'smtp.gmail.com', port: 587 })
  
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  
  const readResponse = async (): Promise<string> => {
    const buffer = new Uint8Array(1024)
    const n = await conn.read(buffer)
    return decoder.decode(buffer.slice(0, n))
  }

  const send = async (data: string) => {
    await conn.write(encoder.encode(data))
  }

  await readResponse()
  await send('EHLO localhost\r\n')
  await readResponse()
  await send('STARTTLS\r\n')
  await readResponse()

  const tlsConn = await Deno.startTls(conn, { hostname: 'smtp.gmail.com' })

  const tlsEncoder = new TextEncoder()
  const tlsDecoder = new TextDecoder()
  
  const tlsSend = async (data: string) => {
    await tlsConn.write(tlsEncoder.encode(data))
  }
  
  const tlsRead = async (): Promise<string> => {
    const buffer = new Uint8Array(1024)
    const n = await tlsConn.read(buffer)
    return tlsDecoder.decode(buffer.slice(0, n))
  }

  await tlsSend('EHLO localhost\r\n')
  await tlsRead()
  await tlsSend('AUTH LOGIN\r\n')
  await tlsRead()
  await tlsSend(btoa(user) + '\r\n')
  await tlsRead()
  await tlsSend(btoa(password) + '\r\n')
  const authResponse = await tlsRead()

  if (!authResponse.includes('235')) {
    tlsConn.close()
    throw new Error('SMTP auth failed: ' + authResponse)
  }

  await tlsSend('MAIL FROM:<' + user + '>\r\n')
  await tlsRead()
  await tlsSend('RCPT TO:<' + to + '>\r\n')
  await tlsRead()
  await tlsSend('DATA\r\n')
  
  const message = `From: <${user}>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.`
  await tlsSend(message + '\r\n')
  await tlsRead()
  await tlsSend('QUIT\r\n')
  tlsConn.close()

  return 235
}
