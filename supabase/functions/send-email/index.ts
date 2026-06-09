// TampaRestore - Send Email Edge Function
// Sends emails to contractor with Confirm/Decline buttons
// Uses Gmail SMTP with App Password

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const ANON_KEY = Deno.env.get('ANON_KEY') || ''

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

    console.log('send-email: password set:', !!gmailAppPassword, 'source:', source)

    if (!gmailAppPassword) {
      return new Response(JSON.stringify({ error: 'GMAIL_APP_PASSWORD not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Trade-specific config
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

    // If no contractor assigned, get from contractors table (filtered by trade)
    if (!contractorEmail && SUPABASE_KEY) {
      // Try trade-specific contractors first
      let contractorRes = await fetch(
        `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&trade=eq.${source}&order=priority.asc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
          }
        }
      )
      let contractors = await contractorRes.json()

      // Fallback to all-trade contractors (trade = '' or null)
      if (!contractors || contractors.length === 0) {
        contractorRes = await fetch(
          `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&or=(trade.eq.,trade.is.null)&order=priority.asc`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json'
            }
          }
        )
        contractors = await contractorRes.json()
      }

      // Final fallback to any active contractor
      if (!contractors || contractors.length === 0) {
        contractorRes = await fetch(
          `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&order=priority.asc`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json'
            }
          }
        )
        contractors = await contractorRes.json()
      }

      // Gate check: skip contractors with unpaid commissions
      if (contractors && contractors.length > 0) {
        const available = await getAvailableContractors(contractors)
        if (available.length > 0) {
          contractorEmail = available[0].email
          console.log('Got contractor from DB:', contractorEmail, 'for trade:', source)
        } else {
          // All have unpaid commissions — notify admin
          console.log('All contractors blocked by unpaid commissions for trade:', source)
          await sendEmailGmailSmtp(
            gmailUser, gmailAppPassword, adminEmail,
            `⚠️ All ${source} contractors blocked by unpaid commissions`,
            `<p>All active contractors for ${source} have unpaid commissions and cannot receive new leads.</p>
             <p>Lead: ${name} - ${phone}</p>
             <p>Please resolve outstanding payments or assign manually.</p>`
          )
        }
      }
    }

    // Fallback to default if no contractor found
    if (!contractorEmail) {
      contractorEmail = 'ctbelisle@gmail.com'
      console.log('Using default contractor:', contractorEmail)
    }

    // Record events on the lead
    if (leadId && SUPABASE_KEY) {
      try {
        const events = [{ type: 'sent', contractor: contractorEmail, timestamp: new Date().toISOString() }]
        // Read existing events and append
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

    // Build confirm/decline buttons if we have lead_id
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
    console.log('Contractor email result:', contractorStatus, 'to:', contractorEmail, 'subject:', contractorSubject)

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

  // Read greeting
  await readResponse()

  // EHLO
  await send('EHLO localhost\r\n')
  await readResponse()

  // STARTTLS
  await send('STARTTLS\r\n')
  await readResponse()

  // Upgrade to TLS
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

  // EHLO again after TLS
  await tlsSend('EHLO localhost\r\n')
  await tlsRead()

  // AUTH LOGIN
  await tlsSend('AUTH LOGIN\r\n')
  await tlsRead()

  // Username (base64)
  await tlsSend(btoa(user) + '\r\n')
  await tlsRead()

  // Password (base64)
  await tlsSend(btoa(password) + '\r\n')
  const authResponse = await tlsRead()

  if (!authResponse.includes('235')) {
    tlsConn.close()
    throw new Error('SMTP auth failed: ' + authResponse)
  }

  // MAIL FROM
  await tlsSend('MAIL FROM:<' + user + '>\r\n')
  await tlsRead()

  // RCPT TO
  await tlsSend('RCPT TO:<' + to + '>\r\n')
  await tlsRead()

  // DATA
  await tlsSend('DATA\r\n')
  
  const message = `From: <${user}>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.`
  await tlsSend(message + '\r\n')
  await tlsRead()

  // QUIT
  await tlsSend('QUIT\r\n')
  tlsConn.close()

  return 235
}

// Gate check helpers
async function hasUnpaidCommissions(contractorEmail: string): Promise<boolean> {
  try {
    if (!SUPABASE_KEY) return false
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/commissions?contractor_email=eq.${encodeURIComponent(contractorEmail)}&status=eq.pending&select=id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        }
      }
    )
    const data = await res.json()
    return Array.isArray(data) && data.length > 0
  } catch (e) {
    console.error('Gate check failed:', e)
    return false
  }
}

async function getAvailableContractors(contractors: any[]): Promise<any[]> {
  const available: any[] = []
  for (const c of contractors) {
    const blocked = await hasUnpaidCommissions(c.email)
    if (!blocked) available.push(c)
  }
  return available.length > 0 ? available : contractors
}