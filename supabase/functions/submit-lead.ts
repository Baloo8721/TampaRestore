// TampaRestore - Supabase Edge Function
// Handles form submissions, writes to DB, sends emails with confirm/decline buttons

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    
    const name = formData.get('name')?.toString() || ''
    const phone = formData.get('phone')?.toString() || ''
    const email = formData.get('email')?.toString() || ''
    const city = formData.get('city')?.toString() || ''
    const damageType = formData.get('damage-type')?.toString() || ''
    const description = formData.get('description')?.toString() || ''
    const lat = formData.get('lat')?.toString() || ''
    const lng = formData.get('lng')?.toString() || ''

    if (!name || !phone || !city) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const timestamp = new Date().toISOString()
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const supabaseUrl = Deno.env.get('DB_URL') || ''
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''
    const edgeFunctionUrl = Deno.env.get('EDGE_FUNCTION_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co/functions/v1'

    // Get next available contractor from DB
    let contractorEmail = ''
    
    const contractorRes = await fetch(`${supabaseUrl}/rest/v1/contractors?active=eq.true&order=priority.asc&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json'
      }
    })
    const contractors = await contractorRes.json()
    if (contractors && contractors.length > 0) {
      contractorEmail = contractors[0].email
    } else {
      contractorEmail = 'ctbelisle@gmail.com' // fallback
    }

    // Write to Supabase using service role key (bypasses RLS)
    const leadData = {
      name,
      phone,
      email: email || null,
      city,
      state: 'FL',
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      damage_type: damageType,
      description: description || null,
      status: 'sent',
      source: 'website',
      sent_to_contractor_at: timestamp,
      assigned_contractor_email: contractorEmail,
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify([leadData])
    })

    // Get the inserted lead ID
    let leadId = ''
    const leadIdRes = await fetch(`${supabaseUrl}/rest/v1/leads?order=created_at.desc&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
      }
    })
    const recentLeads = await leadIdRes.json()
    if (recentLeads && recentLeads.length > 0) {
      leadId = recentLeads[0].id
    }

    // Send emails via Gmail
    if (gmailAppPassword && leadId) {
      const baseUrl = `${edgeFunctionUrl}/contractor-action`
      const confirmUrl = `${baseUrl}?action=confirm&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}`
      const declineUrl = `${baseUrl}?action=decline&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}`

      const contractorEmailHtml = `
        <h2 style="color:#D92B2B;">🚨 NEW WATER DAMAGE LEAD</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
        <p><strong>Email:</strong> ${email || 'N/A'}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Damage Type:</strong> ${damageType || 'N/A'}</p>
        <p><strong>Description:</strong> ${description || 'N/A'}</p>
        <hr>
        <p style="color:#D92B2B;font-weight:bold;font-size:18px;">⚠️ CALL THIS LEAD WITHIN 5 MINUTES!</p>
        
        <div style="margin-top:30px; padding:20px; background:#f5f5f5; border-radius:8px;">
          <p style="margin-bottom:15px;"><strong>Quick Actions:</strong></p>
          <a href="${confirmUrl}" style="display:inline-block; background:#059669; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; margin-right:10px;">✅ I Contacted This Lead</a>
          <a href="${declineUrl}" style="display:inline-block; background:#DC2626; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">❌ Decline / Pass</a>
        </div>
        
        <p style="margin-top:20px; font-size:12px; color:#666;">
          If buttons don't work, you can also just reply to this email with "CONFIRMED" or "DECLINED"
        </p>
      `

      const adminEmailHtml = `
        <h2>📋 New Lead Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Damage:</strong> ${damageType || 'N/A'}</p>
        <p><strong>Contractor:</strong> ${contractorEmail}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      `

      // Email to contractor
      await sendGmailEmail(contractorEmail, 'tylerbelislefl@gmail.com', gmailAppPassword, 
        `🚨 NEW LEAD — ${name} needs water damage help in ${city}`, contractorEmailHtml)

      // Email to admin
      await sendGmailEmail(adminEmail, 'tylerbelislefl@gmail.com', gmailAppPassword,
        `📋 New Lead: ${name} - ${city}`, adminEmailHtml)
    }

    return new Response(JSON.stringify({ success: true, message: 'Lead saved' }), {
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

async function sendGmailEmail(to: string, from: string, password: string, subject: string, html: string) {
  const credentials = btoa(`${from}:${password}`)
  
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: btoa(
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `Content-Type: text/html; charset=utf-8\r\n\r\n` +
        `${html}`
      )
    })
  })
  
  return { status: response.status }
}