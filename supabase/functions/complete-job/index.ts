// TampaRestore - Complete Job Edge Function
// Contractor clicks "Mark Complete" in email
// Auto-pay: charges saved card silently
// Manual: redirects to Stripe Checkout

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''

const TRADE_FEES: Record<string, number> = {
  'website': 75,
  'handyman': 45,
  'electrician': 65,
  'hvac': 75,
  'plumber': 65,
}

const TRADE_CONFIG: Record<string, { name: string; emoji: string; color: string }> = {
  'website':  { name: 'Tampa Restore', emoji: '💧', color: '#D92B2B' },
  'handyman': { name: 'Handyman', emoji: '🔧', color: '#059669' },
  'electrician': { name: 'Electrician', emoji: '⚡', color: '#D97706' },
  'hvac':    { name: 'HVAC', emoji: '❄️', color: '#2563EB' },
  'plumber': { name: 'Plumber', emoji: '🔩', color: '#0D9488' },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const leadId = url.searchParams.get('lead_id')
    const contractorEmail = url.searchParams.get('email')

    if (!leadId || !contractorEmail) {
      return htmlResponse('#DC2626', 'Missing Information', '<p>Invalid link. Please contact support.</p>')
    }

    // Get lead
    const leadRes = await supFetch(`/rest/v1/leads?id=eq.${leadId}`)
    const leads = await leadRes.json()
    const lead = leads[0]
    if (!lead) {
      return htmlResponse('#DC2626', 'Lead Not Found', '<p>This lead no longer exists.</p>')
    }

    // Validate contractor is assigned
    if (lead.assigned_contractor_email !== contractorEmail) {
      return htmlResponse('#DC2626', 'Not Your Lead',
        `<p>This lead is assigned to <strong>${lead.assigned_contractor_email || 'another contractor'}</strong>.</p>
         <p>Your old link is no longer active.</p>`)
    }

    // Check if already completed
    if (lead.status === 'closed' || lead.status === 'paid') {
      return htmlResponse('#059669', 'Already Completed', '<p>This lead has already been marked complete.</p>')
    }

    const leadSource = lead.source || 'website'
    const trade = TRADE_CONFIG[leadSource] || TRADE_CONFIG['website']
    const fee = TRADE_FEES[leadSource] || 75

    // Get contractor info
    const contractorRes = await supFetch(`/rest/v1/contractors?email=eq.${encodeURIComponent(contractorEmail)}&limit=1`)
    const contractors = await contractorRes.json()
    const contractor = contractors && contractors.length > 0 ? contractors[0] : null
    const autoPay = contractor?.auto_pay !== false
    const stripeCustomerId = contractor?.stripe_customer_id || ''
    const stripePaymentMethodId = contractor?.stripe_payment_method_id || ''

    // Create commission record and close lead
    const timestamp = new Date().toISOString()
    const commissionId = crypto.randomUUID()

    // Insert commission
    await supFetch('/rest/v1/commissions', {
      method: 'POST',
      body: JSON.stringify({
        id: commissionId,
        lead_id: leadId,
        contractor_email: contractorEmail,
        trade: leadSource,
        amount: fee,
        status: 'pending',
        created_at: timestamp,
      })
    })

    // Update lead to closed
    await supFetch(`/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed', updated_at: timestamp })
    })

    // Record event
    await recordEvent(leadId, 'completed', contractorEmail)

    // === AUTO-PAY FLOW ===
    if (autoPay && stripeCustomerId && stripePaymentMethodId && STRIPE_SECRET_KEY) {
      try {
        const paymentIntent = await stripeFetch('/v1/payment_intents', {
          amount: Math.round(fee * 100),
          currency: 'usd',
          customer: stripeCustomerId,
          payment_method: stripePaymentMethodId,
          off_session: true,
          confirm: true,
          description: `${trade.emoji} ${trade.name} - Lead: ${lead.name}`,
          metadata: { lead_id: leadId, commission_id: commissionId },
        })

        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
          await supFetch(`/rest/v1/commissions?id=eq.${commissionId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'completed',
              paid_at: timestamp,
              stripe_payment_intent_id: paymentIntent.id,
            })
          })
        } else {
          throw new Error(`Payment ${paymentIntent.status}`)
        }

        return htmlResponse(trade.color, `${trade.emoji} Job Complete!`,
          `<p style="font-size:18px;font-weight:bold;color:#059669;">✓ $${fee} charged to your card on file</p>
           <p>Ref: ${lead.name} - ${lead.city}</p>
           <p style="color:#666;font-size:13px;margin-top:16px;">A receipt has been sent to your email.</p>`)

      } catch (stripeErr) {
        console.error('Auto-pay failed:', stripeErr)
        // Fall through to manual pay
      }
    }

    // === MANUAL PAY FLOW (or auto-pay failed) ===
    if (STRIPE_SECRET_KEY) {
      const successUrl = `https://baloo8721.github.io/TampaRestore/thank-you.html?name=${encodeURIComponent(lead.name)}&action=paid`
      const cancelUrl = `${SUPABASE_URL}/functions/v1/complete-job?lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}&canceled=1`

      const session = await stripeFetch('/v1/checkout/sessions', {
        mode: 'payment',
        customer: stripeCustomerId || undefined,
        payment_intent_data: {
          setup_future_usage: 'off_session',
          metadata: { lead_id: leadId, commission_id: commissionId, contractor_email: contractorEmail },
        },
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${trade.emoji} ${trade.name} Lead - ${lead.name}`,
              description: `${lead.city} - ${lead.damage_type || 'Service'}`,
            },
            unit_amount: Math.round(fee * 100),
          },
          quantity: 1,
        }],
        metadata: { lead_id: leadId, commission_id: commissionId, contractor_email: contractorEmail },
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      const checkoutUrl = session.url

      return htmlResponse(trade.color, `${trade.emoji} Job Complete! Pay $${fee}`,
        `<p style="font-size:16px;">Lead: <strong>${lead.name}</strong> - ${lead.city}</p>
         <p style="font-size:16px;margin-bottom:20px;">Your job has been recorded. Pay now to receive future leads.</p>
         <a href="${checkoutUrl}" style="display:inline-block;background:${trade.color};color:white;padding:16px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:18px;">💳 Pay $${fee} Now</a>
         <div style="margin-top:24px;padding:16px;background:#FEF3C7;border-radius:8px;text-align:left;">
           <p style="font-weight:bold;margin-bottom:8px;">⚡ Want auto-pay?</p>
           <p style="font-size:13px;color:#666;">Save your card and we'll charge it automatically when you complete a job. No more manual payments.</p>
           <p style="font-size:13px;color:#666;margin-top:8px;">Contact the admin to set up auto-pay.</p>
         </div>`)

    } else {
      return htmlResponse('#059669', `${trade.emoji} Job Complete!`,
        `<p style="font-size:16px;">Lead: <strong>${lead.name}</strong> - ${lead.city}</p>
         <p>Payment processing not configured. You'll be invoiced separately.</p>`)
    }

  } catch (error) {
    console.error('Error:', error)
    return htmlResponse('#DC2626', 'Error',
      `<p>Something went wrong: ${error.message}</p>
       <p>Please try again or contact support.</p>`)
  }
})

function htmlResponse(color: string, title: string, bodyHtml: string): Response {
  return new Response(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
      .card { max-width: 480px; margin: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
      .header { background: ${color}; padding: 24px; text-align: center; }
      .header h1 { color: white; font-size: 22px; margin: 0; }
      .body { padding: 28px; font-size: 15px; line-height: 1.6; color: #333; text-align: center; }
    </style></head>
    <body><div class="card"><div class="header"><h1>${title}</h1></div><div class="body">${bodyHtml}</div></div></body></html>
  `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
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
  if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body)
  }
  return fetch(SUPABASE_URL + path, opts)
}

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

async function recordEvent(leadId: string, type: string, contractor: string) {
  try {
    const getRes = await supFetch(`/rest/v1/leads?id=eq.${leadId}&select=events`)
    const existing = await getRes.json()
    const existingEvents = (existing && existing.length > 0 && Array.isArray(existing[0].events)) ? existing[0].events : []
    const newEvent = { type, contractor, timestamp: new Date().toISOString() }
    const events = [...existingEvents, newEvent]
    await supFetch(`/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ events })
    })
  } catch (evErr) {
    console.error('Failed to record event:', evErr)
  }
}
