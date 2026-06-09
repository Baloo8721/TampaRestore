// TampaRestore - Send Email Edge Function
// Sends minimal "Lead Available" email with CLAIM/DECLINE buttons
// Full lead details are sent by contractor-action after CLAIM

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const ANON_KEY = Deno.env.get('ANON_KEY') || ''

const MAX_PENDING_COMMISSIONS = 3

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

    console.log('send-email: source:', source, 'gmail:', !!gmailAppPassword)

    if (!gmailAppPassword) {
      return new Response(JSON.stringify({ error: 'GMAIL_APP_PASSWORD not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const TRADE_CONFIG: Record<string, { name: string; emoji: string; color: string; header: string; subject: string }> = {
      'website':  { name: 'Tampa Restore', emoji: '💧', color: '#D92B2B', header: 'NEW LEAD AVAILABLE', subject: 'New Lead Available' },
      'handyman': { name: 'Handyman', emoji: '🔧', color: '#059669', header: 'NEW LEAD AVAILABLE', subject: 'Handyman Lead Available' },
      'electrician': { name: 'Electrician', emoji: '⚡', color: '#D97706', header: 'NEW LEAD AVAILABLE', subject: 'Electrician Lead Available' },
      'hvac':    { name: 'HVAC', emoji: '❄️', color: '#2563EB', header: 'NEW LEAD AVAILABLE', subject: 'HVAC Lead Available' },
      'plumber': { name: 'Plumber', emoji: '🔩', color: '#0D9488', header: 'NEW LEAD AVAILABLE', subject: 'Plumber Lead Available' },
    }
    const trade = TRADE_CONFIG[source] || TRADE_CONFIG['website']
    const accentColor = trade.color

    // Get lead_id from DB
    let leadId = ''
    let contractorEmail = ''
    
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
      }
    }

    // If no contractor assigned, find one (gate check: < 3 pending)
    if (!contractorEmail && SUPABASE_KEY) {
      let contractors: any[] = await fetchContractors(source)

      if (contractors && contractors.length > 0) {
        const available = await getAvailableContractors(contractors)
        if (available.length > 0) {
          contractorEmail = available[0].email
        } else {
          console.log('All contractors gate-blocked for trade:', source)
          await supFetchEmail(gmailUser, gmailAppPassword, adminEmail,
            `⚠️ All ${source} contractors blocked for ${name}`,
            `<p>All active contractors have 3+ unpaid invoices.</p>
             <p><strong>Lead:</strong> ${name} - ${phone}</p>
             <p><strong>City:</strong> ${city}</p>
             <p>Resolve outstanding payments or add more contractors.</p>`)
        }
      }
    }

    // Fallback
    if (!contractorEmail) {
      contractorEmail = 'ctbelisle@gmail.com'
    }

    // Assign lead in DB
    if (leadId && SUPABASE_KEY) {
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

    // Record event
    if (leadId && SUPABASE_KEY) {
      try {
        const getRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=events`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
        )
        const existing = await getRes.json()
        const existingEvents = (existing && existing.length > 0 && Array.isArray(existing[0].events)) ? existing[0].events : []
        const events = [...existingEvents, { type: 'sent', contractor: contractorEmail, timestamp: new Date().toISOString() }]
        await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ events })
        })
      } catch (_) {}
    }

    // Build CLAIM/DECLINE buttons
    const confirmUrl = `${actionBaseUrl}?action=confirm&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}&apikey=${ANON_KEY}`
    const declineUrl = `${actionBaseUrl}?action=decline&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}&apikey=${ANON_KEY}`

    // === EMAIL 1: Minimal lead available (no client PII) ===
    const leadHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: ${accentColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; font-size: 20px; margin: 0;">${trade.emoji} ${trade.header}</h1>
        </div>
        <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">A new <strong>${trade.name}</strong> service request is available in <strong>${city}</strong>.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: ${accentColor}; font-weight: bold; font-size: 18px;">⚠️ CALL WITHIN 5 MINUTES!</p>
          <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align:center;">
            <a href="${confirmUrl}" style="display: inline-block; background: ${accentColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin-right: 12px;">[CLAIM] I Will Call This Lead</a>
            <a href="${declineUrl}" style="display: inline-block; background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">[PASS] Not Interested</a>
          </div>
        </div>
      </div>
    `

    // Admin email (full info)
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
        </div>
      </div>
    `

    // Send contractor email
    await sendEmailGmailSmtp(gmailUser, gmailAppPassword, contractorEmail,
      `${trade.emoji} ${trade.subject} - ${city}`, leadHtml)

    // Send admin email
    await sendEmailGmailSmtp(gmailUser, gmailAppPassword, adminEmail,
      `${trade.emoji} New ${trade.name} Lead: ${name}`, adminHtml)

    return new Response(JSON.stringify({ success: true, leadId, contractorEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function fetchContractors(source: string): Promise<any[]> {
  if (!SUPABASE_KEY) return []
  for (const filter of [
    `active=eq.true&trade=eq.${source}&order=priority.asc`,
    `active=eq.true&or=(trade.eq.,trade.is.null)&order=priority.asc`,
    `active=eq.true&order=priority.asc`,
  ]) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contractors?${filter}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    })
    const data = await res.json()
    if (data && data.length > 0) return data
  }
  return []
}

async function countPendingCommissions(contractorEmail: string): Promise<number> {
  try {
    if (!SUPABASE_KEY) return 0
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/commissions?contractor_email=eq.${encodeURIComponent(contractorEmail)}&status=eq.pending&select=id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    )
    const data = await res.json()
    return Array.isArray(data) ? data.length : 0
  } catch { return 0 }
}

async function getAvailableContractors(contractors: any[]): Promise<any[]> {
  const available: any[] = []
  for (const c of contractors) {
    const pending = await countPendingCommissions(c.email)
    if (pending < MAX_PENDING_COMMISSIONS) available.push(c)
  }
  return available.length > 0 ? available : contractors
}

async function supFetch(path: string, options?: RequestInit): Promise<Response> {
  const opts: RequestInit = {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    ...options,
  }
  if (opts.body && typeof opts.body === 'object') opts.body = JSON.stringify(opts.body)
  return fetch(SUPABASE_URL + path, opts)
}

function supFetchEmail(user: string, pass: string, to: string, subj: string, html: string) {
  return sendEmailGmailSmtp(user, pass, to, subj, html)
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
  if (!auth.includes('235')) { tlsConn.close(); throw new Error('SMTP auth failed: ' + auth) }
  await ts('MAIL FROM:<' + user + '>\r\n'); await tr()
  await ts('RCPT TO:<' + to + '>\r\n'); await tr()
  await ts('DATA\r\n')
  await ts(`From: <${user}>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.\r\n`)
  await tr()
  await ts('QUIT\r\n')
  tlsConn.close()
  return 235
}
