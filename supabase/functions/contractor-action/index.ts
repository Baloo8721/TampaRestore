// TampaRestore - Contractor Action Edge Function
// Handles: confirm contact, decline lead, undo action

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const ANON_KEY = Deno.env.get('ANON_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const leadId = url.searchParams.get('lead_id')
    const contractorEmail = url.searchParams.get('email')
    const providedApikey = url.searchParams.get('apikey')

    // Validate apikey if provided, otherwise skip for backward compatibility
    if (providedApikey && providedApikey !== ANON_KEY) {
      return new Response(`
        <!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 40px;">
          <h2 style="color: red;">Unauthorized</h2>
          <p>Invalid API key.</p>
        </body></html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const gmailUser = Deno.env.get('GMAIL_USER') || 'tylerbelislefl@gmail.com'
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''
    const actionBaseUrl = `${SUPABASE_URL}/functions/v1/contractor-action`

    if (!leadId || !action) {
      return new Response(`
        <!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 40px;">
          <h2 style="color: red;">Missing Information</h2>
          <p>Please contact support.</p>
        </body></html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // Get current lead data
    const getLeadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    })
    const leads = await getLeadRes.json()
    const lead = leads[0]

    if (!lead) {
      return new Response(`
        <!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 40px;">
          <h2 style="color: red;">Lead Not Found</h2>
          <p>This lead may have been removed.</p>
        </body></html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const timestamp = new Date().toISOString()
    let updates: Record<string, unknown> = { updated_at: timestamp }

    console.log('Action:', action, 'leadId:', leadId)

    // Trade-specific config
    const TRADE_CONFIG: Record<string, { name: string; emoji: string; color: string }> = {
      'website':  { name: 'Tampa Restore', emoji: '💧', color: '#D92B2B' },
      'handyman': { name: 'Handyman', emoji: '🔧', color: '#059669' },
      'electrician': { name: 'Electrician', emoji: '⚡', color: '#D97706' },
      'hvac':    { name: 'HVAC', emoji: '❄️', color: '#2563EB' },
      'plumber': { name: 'Plumber', emoji: '🔩', color: '#0D9488' },
    }
    const leadSource = lead.source || 'website'
    const trade = TRADE_CONFIG[leadSource] || TRADE_CONFIG['website']
    const accentColor = trade.color

    // Get contractor list from DB (filtered by lead's trade)
    let contractorList: string[] = []
    const tradeFilter = leadSource !== 'website' ? `&trade=eq.${leadSource}` : ''
    const contractorsUrl = `${SUPABASE_URL}/rest/v1/contractors?active=eq.true${tradeFilter}&order=priority.asc`
    console.log('Fetching contractors from:', contractorsUrl)
    let contractorRes = await fetch(contractorsUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    })
    let contractors = await contractorRes.json()
    
    // Fallback to all-trade contractors if no trade-specific ones
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

    console.log('Contractors from DB:', contractors)
    if (contractors && contractors.length > 0) {
      contractorList = contractors.map((c: any) => c.email)
    }
    // Fallback if no contractors in DB
    if (contractorList.length === 0) {
      contractorList = ['ctbelisle@gmail.com']
    }
    
    // Find current contractor index
    const currentIndex = contractorList.indexOf(lead.assigned_contractor_email || '')
    const nextContractor = currentIndex >= 0 && currentIndex < contractorList.length - 1 
      ? contractorList[currentIndex + 1] 
      : null

    // Gate check: find next available contractor (skip those with unpaid commissions)
    let nextAvailableContractor: string | null = null
    if (currentIndex >= 0) {
      for (let i = currentIndex + 1; i < contractorList.length; i++) {
        const blocked = await hasUnpaidCommissions(contractorList[i])
        if (!blocked) {
          nextAvailableContractor = contractorList[i]
          break
        }
      }
    }

    // === STATE VALIDATION ===
    const isAssignedToThem = lead.assigned_contractor_email === contractorEmail
    const leadStatus = lead.status || 'new'
    const terminalStatuses = ['scheduled', 'closed', 'paid', 'junk']

    if (action === 'confirm') {
      // Validate: can confirm if sent (normal), declined (changed mind), or no_contractor (last resort)
      const confirmAllowed = ['sent', 'declined', 'no_contractor'].includes(leadStatus)
      if (!confirmAllowed) {
        return htmlResponse(`${accentColor}`, `✅ Lead Already Handled`,
          `<p>This lead status is <strong>${leadStatus}</strong> and has already been handled.</p>
           <p>No changes were made.</p>
           <p style="color:#666;font-size:13px;margin-top:20px;">If you need to pass this lead to another contractor, use the Decline button instead.</p>`)
      }
      if (!isAssignedToThem && leadStatus !== 'no_contractor') {
        return htmlResponse(`${accentColor}`, `⏭️ Lead Passed to Another Contractor`,
          `<p>This lead is now assigned to <strong>${lead.assigned_contractor_email || 'another contractor'}</strong>.</p>
           <p>Your old link is no longer valid.</p>`)
      }

      // --- Accept flow ---
      updates = {
        ...updates,
        status: 'contacted',
        contractor_contacted_at: timestamp,
        contractor_response_minutes: lead.sent_to_contractor_at 
          ? Math.round((new Date(timestamp).getTime() - new Date(lead.sent_to_contractor_at).getTime()) / 60000)
          : 0
      }

      recordEvent(leadId, 'confirmed', lead.assigned_contractor_email || '')

      if (gmailAppPassword) {
        await sendEmail(gmailUser, gmailAppPassword, adminEmail, `✅ ${trade.emoji} Lead Confirmed: ${lead.name}`, 
          `<p><strong>Trade:</strong> ${trade.emoji} ${trade.name}</p>
           <p><strong>Contractor:</strong> ${lead.assigned_contractor_email}</p>
           <p><strong>Lead:</strong> ${lead.name} - ${lead.phone}</p>
           <p><strong>City:</strong> ${lead.city}</p>
           <p><strong>Response time:</strong> ${updates.contractor_response_minutes} minutes</p>`)

        // Send payment reminder if contractor has pending invoices
        const pendingCommissions = await getPendingCommissions(lead.assigned_contractor_email || '')
        if (pendingCommissions.length > 0) {
          const totalOwed = pendingCommissions.reduce((s: number, c: any) => s + (c.amount || 0), 0)
          const count = pendingCommissions.length

          // Get contractor for stripe_customer_id
          const contrRes = await fetch(`${SUPABASE_URL}/rest/v1/contractors?email=eq.${encodeURIComponent(lead.assigned_contractor_email || '')}&limit=1`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
          })
          const contrs = await contrRes.json()
          const contractor = contrs && contrs.length > 0 ? contrs[0] : null
          const hasCard = !!contractor?.stripe_customer_id && !!contractor?.stripe_payment_method_id

          let payButtonHtml = ''
          if (STRIPE_SECRET_KEY && pendingCommissions.length > 0) {
            const commissionIds = pendingCommissions.map((c: any) => c.id).join(',')
            const successUrl = `https://baloo8721.github.io/TampaRestore/thank-you.html?action=paid`
            const cancelUrl = `${SUPABASE_URL}/functions/v1/contractor-action?action=confirm&lead_id=${leadId}&email=${encodeURIComponent(lead.assigned_contractor_email || '')}`

            const session = await stripeFetch('/v1/checkout/sessions', {
              mode: 'payment',
              customer: contractor?.stripe_customer_id || undefined,
              payment_intent_data: {
                setup_future_usage: 'off_session',
                metadata: {
                  commission_ids: commissionIds,
                  contractor_email: lead.assigned_contractor_email || '',
                },
              },
              line_items: [{
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `${count} ${trade.emoji} Unpaid Lead${count > 1 ? 's' : ''}`,
                    description: `Total pending: $${totalOwed}`,
                  },
                  unit_amount: Math.round(totalOwed * 100),
                },
                quantity: 1,
              }],
              metadata: {
                commission_ids: commissionIds,
                contractor_email: lead.assigned_contractor_email || '',
              },
              success_url: successUrl,
              cancel_url: cancelUrl,
            })

            if (session?.url) {
              payButtonHtml = `
                <div style="margin-top:24px;text-align:center;">
                  <a href="${session.url}" style="display:inline-block;background:#059669;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">💳 Pay $${totalOwed} Now</a>
                  <p style="font-size:12px;color:#666;margin-top:8px;">Your card will be saved for auto-pay on future leads</p>
                </div>
              `
            }
          }

          const reminderEmoji = trade.emoji || '💰'
          await sendEmail(gmailUser, gmailAppPassword, lead.assigned_contractor_email || '',
            `${reminderEmoji} Payment needed for leads (${count} unpaid)`,
            `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
              <div style="background:#059669;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="color:white;font-size:18px;margin:0;">${reminderEmoji} You have ${count} unpaid lead${count > 1 ? 's' : ''}</h1>
              </div>
              <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p style="font-size:16px;">Total outstanding: <strong>$${totalOwed}</strong></p>
                <p style="color:#666;">Pay now to keep receiving leads. After 3 unpaid, you'll be paused.</p>
                ${payButtonHtml || '<p style="color:#D97706;margin-top:16px;">Contact your admin to set up payment and enable auto-pay.</p>'}
                ${hasCard ? '<p style="font-size:12px;color:#666;margin-top:16px;">✅ Card on file — future leads will be charged automatically.</p>' : '<p style="font-size:12px;color:#666;margin-top:16px;">💳 After paying, your card will be saved for auto-pay — future leads charged automatically.</p>'}
              </div>
            </div>`)
        }
      }

    } else if (action === 'decline') {
      // Validate: can decline if sent (normal), contacted (accepted but can't do job), or no_contractor (revive and decline)
      const declineAllowed = ['sent', 'contacted', 'no_contractor'].includes(leadStatus)
      if (!declineAllowed) {
        return htmlResponse(`#DC2626`, `✕ Lead Already Declined or Closed`,
          `<p>This lead status is <strong>${leadStatus}</strong> and cannot be declined again.</p>
           <p>The lead has already been passed to the next available contractor.</p>`)
      }
      if (!isAssignedToThem && leadStatus !== 'no_contractor') {
        return htmlResponse(`#DC2626`, `⏭️ Lead Already Handled by Another Contractor`,
          `<p>This lead is assigned to <strong>${lead.assigned_contractor_email || 'another contractor'}</strong>.</p>
           <p>Your old link is no longer active.</p>`)
      }

      // --- Decline flow ---
      recordEvent(leadId, 'declined', lead.assigned_contractor_email || '')

      updates = {
        ...updates,
        status: 'declined',
        notes: (lead.notes || '') + `\n[${timestamp}] Declined by ${lead.assigned_contractor_email}`
      }

      if (nextAvailableContractor) {
        updates.assigned_contractor_email = nextAvailableContractor
        updates.status = 'sent'
        updates.sent_to_contractor_at = timestamp

        recordEvent(leadId, 'sent', nextAvailableContractor)

        if (gmailAppPassword) {
          const confirmUrl = `${actionBaseUrl}?action=confirm&lead_id=${leadId}&email=${encodeURIComponent(nextAvailableContractor)}&apikey=${ANON_KEY}`
          const declineUrl = `${actionBaseUrl}?action=decline&lead_id=${leadId}&email=${encodeURIComponent(nextAvailableContractor)}&apikey=${ANON_KEY}`
          const nextButtonsHtml = `
            <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
              <p style="margin-bottom: 15px; font-size: 16px;"><strong>Quick Actions:</strong></p>
              <a href="${confirmUrl}" style="display: inline-block; background: ${accentColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin-right: 12px;">[ACCEPTED] I Will Call This Lead</a>
              <a href="${declineUrl}" style="display: inline-block; background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">[DECLINE] Pass to Next Contractor</a>
            </div>
          `
          const nextEmailBody = `
            <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
              <div style="background: ${accentColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; font-size: 20px; margin: 0;">${trade.emoji} LEAD PASSED TO YOU</h1>
              </div>
              <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p>The previous contractor declined this lead. It's now assigned to you.</p>
                <hr>
                <p><strong>Name:</strong> ${lead.name}</p>
                <p><strong>Phone:</strong> <a href="tel:${lead.phone}" style="color:${accentColor};font-weight:bold;">${lead.phone}</a></p>
                <p><strong>City:</strong> ${lead.city}</p>
                <p><strong>Service:</strong> ${lead.damage_type || 'N/A'}</p>
                <p><strong>Description:</strong> ${lead.description || 'N/A'}</p>
                <hr>
                <p style="color:${accentColor};font-weight:bold;font-size:18px;">⚠️ CALL THIS LEAD WITHIN 5 MINUTES!</p>
                ${nextButtonsHtml}
              </div>
            </div>
          `
          await sendEmail(gmailUser, gmailAppPassword, nextAvailableContractor, `${trade.emoji} Lead Passed: ${lead.name}`, nextEmailBody)
        }
      } else {
        updates.status = 'no_contractor'
        if (gmailAppPassword) {
          await sendEmail(gmailUser, gmailAppPassword, adminEmail, `⚠️ ${trade.emoji} ALL CONTRACTORS BLOCKED: ${lead.name}`,
            `<p><strong>Trade:</strong> ${trade.emoji} ${trade.name}</p>
             <p>No available contractors — all have 3+ unpaid invoices or none in rotation.</p>
             <p><strong>Lead:</strong> ${lead.name} - ${lead.phone}</p>
             <p><strong>City:</strong> ${lead.city}</p>
             <p>Resolve outstanding payments or add more contractors.</p>`)
        }
      }

      if (gmailAppPassword) {
        await sendEmail(gmailUser, gmailAppPassword, adminEmail, `⚠️ ${trade.emoji} Lead Declined: ${lead.name}`,
          `<p><strong>Trade:</strong> ${trade.emoji} ${trade.name}</p>
           <p><strong>Contractor:</strong> ${lead.assigned_contractor_email}</p>
           <p><strong>Lead:</strong> ${lead.name} - ${lead.phone}</p>
           <p><strong>City:</strong> ${lead.city}</p>
           <p><strong>Next contractor:</strong> ${nextAvailableContractor || 'None available (all blocked or none left)'}</p>`)
      }

    } else if (action === 'undo') {
      updates = {
        ...updates,
        status: 'sent',
        contractor_contacted_at: null,
        contractor_response_minutes: null,
        notes: (lead.notes || '') + `\n[${timestamp}] Action undone by contractor`
      }
    }

    // Update lead in DB
    console.log('Updating lead:', leadId, 'with:', JSON.stringify(updates))
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updates)
    })
    console.log('Lead updated successfully')

    // Return confirmation page
    const actionText = action === 'confirm' ? 'confirmed' : action === 'decline' ? 'declined' : 'undone'
    const color = action === 'confirm' ? 'green' : action === 'decline' ? 'orange' : 'blue'

    // Thank you for contractor - redirect to thank you page
    const thankYouUrl = 'https://baloo8721.github.io/TampaRestore/thank-you.html'
    
    if (action === 'confirm') {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': thankYouUrl + '?name=' + encodeURIComponent(lead.name) + '&phone=' + encodeURIComponent(lead.phone) + '&city=' + encodeURIComponent(lead.city) + '&action=accept'
        }
      })
    }
    
    if (action === 'decline') {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': thankYouUrl + '?name=' + encodeURIComponent(lead.name) + '&action=pass'
        }
      })
    }

    return new Response('Done', { 'Content-Type': 'text/plain' })

  } catch (error) {
    return new Response(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"></head><body style="font-family: Arial; text-align: center; padding: 40px;">
        <h2 style="color: red;">Error</h2>
        <p>${error.message}</p>
      </body></html>
    `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
  }
})

function htmlResponse(color: string, title: string, bodyHtml: string): Response {
  return new Response(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
      .card { max-width: 480px; margin: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
      .header { background: ${color}; padding: 20px; text-align: center; }
      .header h1 { color: white; font-size: 20px; margin: 0; }
      .body { padding: 24px; font-size: 15px; line-height: 1.6; color: #333; text-align: center; }
    </style></head>
    <body><div class="card"><div class="header"><h1>${title}</h1></div><div class="body">${bodyHtml}</div></div></body></html>
  `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}

async function recordEvent(leadId: string, type: string, contractor: string) {
  if (!leadId || !SUPABASE_KEY) return
  try {
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=events`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      }
    })
    const existing = await getRes.json()
    const existingEvents = (existing && existing.length > 0 && Array.isArray(existing[0].events)) ? existing[0].events : []
    const newEvent = { type, contractor, timestamp: new Date().toISOString() }
    const events = [...existingEvents, newEvent]
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
    await send('EHLO localhost\r\n')
    await readResponse()
    await send('STARTTLS\r\n')
    await readResponse()

    const tlsConn = await Deno.startTls(conn, { hostname: 'smtp.gmail.com' })
    const tlsEncoder = new TextEncoder()
    const tlsDecoder = new TextDecoder()
    const tlsSend = async (data: string) => { await tlsConn.write(tlsEncoder.encode(data)) }
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
    return true
  } catch (e) {
    console.error('sendEmail failed:', e)
    return false
  }
}

const MAX_PENDING_COMMISSIONS = 3

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

async function hasUnpaidCommissions(contractorEmail: string): Promise<boolean> {
  const count = await countPendingCommissions(contractorEmail)
  return count >= MAX_PENDING_COMMISSIONS
}

// Fetch all pending commissions with amounts
async function getPendingCommissions(contractorEmail: string): Promise<any[]> {
  try {
    if (!SUPABASE_KEY) return []
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/commissions?contractor_email=eq.${encodeURIComponent(contractorEmail)}&status=eq.pending&order=created_at.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        }
      }
    )
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error('Get pending failed:', e)
    return []
  }
}

// Stripe helpers
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

async function supFetch(path: string, options?: RequestInit): Promise<Response> {
  const opts: RequestInit = {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    ...options,
  }
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body)
  }
  return fetch(SUPABASE_URL + path, opts)
}