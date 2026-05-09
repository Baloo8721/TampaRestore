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
    const adminEmail = 'tylerbelislefl@gmail.com'
    const supabaseUrl = 'https://aqafvfzsybcqfxqklqsd.supabase.co'
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''
    const gmailUser = 'tylerbelislefl@gmail.com'
    const edgeFunctionUrl = 'https://aqafvfzsybcqfxqklqsd.supabase.co/functions/v1'
    
    console.log('DEBUG - gmailAppPassword exists:', !!gmailAppPassword)
    console.log('DEBUG - using from:', gmailUser)

    // Get next available contractor from DB
    let contractorEmail = 'ctbelisle@gmail.com'
    
    try {
      const contractorRes = await fetch(`${supabaseUrl}/rest/v1/contractors?active=eq.true&order=priority.asc&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json'
        }
      })
      const contractors = await contractorRes.json()
      if (contractors && contractors.length > 0 && contractors[0].email) {
        contractorEmail = contractors[0].email
        console.log('Got contractor from DB:', contractorEmail)
      } else {
        console.log('No active contractors found, using fallback')
      }
    } catch (e) {
      console.error('Contractor fetch failed:', e.message)
    }

    // NOTE: DB write is done by index.html directly - this function only sends emails

    // Try to get the most recent lead ID for action buttons (optional - won't break if fails)
    let leadId = ''
    try {
      const leadIdRes = await fetch(`${supabaseUrl}/rest/v1/leads?order=created_at.desc&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
        }
      })
      const recentLeads = await leadIdRes.json()
      if (recentLeads && recentLeads.length > 0) {
        leadId = recentLeads[0].id
        console.log('Found leadId for email buttons:', leadId)
      }
    } catch (e) {
      console.log('Could not get leadId for buttons (edge case)')
    }

    // Send emails via Gmail - ALWAYS try if password exists
    console.log('Email config check - password exists:', !!gmailAppPassword, 'leadId:', leadId, 'contractor:', contractorEmail)
    
    if (gmailAppPassword) {
      let confirmUrl = ''
      let declineUrl = ''
      
      if (leadId) {
        const baseUrl = `${edgeFunctionUrl}/contractor-action`
        confirmUrl = `${baseUrl}?action=confirm&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}`
        declineUrl = `${baseUrl}?action=decline&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}`
      }

      console.log('Sending emails to contractor:', contractorEmail, 'and admin:', adminEmail)
      console.log('leadId for buttons:', leadId || 'NONE')

      const buttonsHtml = leadId ? `
        <div style="margin-top:30px; padding:20px; background:#f5f5f5; border-radius:8px;">
          <p style="margin-bottom:15px;"><strong>Quick Actions:</strong></p>
          <a href="${confirmUrl}" style="display:inline-block; background:#059669; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; margin-right:10px;">✅ I Contacted This Lead</a>
          <a href="${declineUrl}" style="display:inline-block; background:#DC2626; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">❌ Decline / Pass</a>
        </div>
        <p style="margin-top:20px; font-size:12px; color:#666;">
          If buttons don't work, you can also just reply to this email with "CONFIRMED" or "DECLINED"
        </p>
      ` : `<p style="margin-top:20px; color:#666;">⚠️ Action buttons unavailable - please contact lead directly.</p>`

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
        ${buttonsHtml}
      `

      const adminEmailHtml = `
        <h2>📋 New Lead Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Damage:</strong> ${damageType || 'N/A'}</p>
        <p><strong>Contractor:</strong> ${contractorEmail}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        ${leadId ? `<p><strong>Lead ID:</strong> ${leadId}</p>` : ''}
      `

      // Email to contractor
      const cResult = await sendGmailEmail(contractorEmail, gmailUser, gmailAppPassword, 
        `🚨 NEW LEAD — ${name} needs water damage help in ${city}`, contractorEmailHtml)
      console.log('Contractor email result:', cResult.status)

      // Email to admin
      const aResult = await sendGmailEmail(adminEmail, gmailUser, gmailAppPassword,
        `📋 New Lead: ${name} - ${city}`, adminEmailHtml)
      console.log('Admin email result:', aResult.status)
    } else {
      console.error('GMAIL_APP_PASSWORD not set - emails not sent')
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

function b64Encode(str: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const binString = Array.from(data, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binString)
}

async function sendGmailEmail(to: string, from: string, password: string, subject: string, html: string) {
  const credentials = b64Encode(`${from}:${password}`)
  
  const emailBody = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`
  
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: b64Encode(emailBody)
    })
  })
  
  const result = { status: response.status }
  if (!response.ok) {
    const errorText = await response.text()
    console.log('Gmail API error:', errorText)
  }
  return result
}
  return result
}