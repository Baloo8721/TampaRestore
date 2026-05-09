// TampaRestore - Supabase Edge Function
// NOTE: DB write handled by index.html - this function ONLY sends emails

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

    if (!name || !phone || !city) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminEmail = 'tylerbelislefl@gmail.com'
    const supabaseUrl = 'https://aqafvfzsybcqfxqklqsd.supabase.co'
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''
    const gmailUser = 'tylerbelislefl@gmail.com'
    const edgeFunctionUrl = 'https://aqafvfzsybcqfxqklqsd.supabase.co/functions/v1'

    console.log('DEBUG - password length:', gmailAppPassword ? gmailAppPassword.length : 0)

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
      }
    } catch (e) {
      console.error('Contractor fetch failed:', e.message)
    }

    // Try to get the most recent lead ID for action buttons
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
      console.log('Could not get leadId for buttons')
    }

    // Send emails via SMTP
    console.log('Email check - password:', !!gmailAppPassword, 'leadId:', leadId)
    
    if (gmailAppPassword) {
      let confirmUrl = ''
      let declineUrl = ''
      
      if (leadId) {
        const baseUrl = `${edgeFunctionUrl}/contractor-action`
        confirmUrl = `${baseUrl}?action=confirm&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}`
        declineUrl = `${baseUrl}?action=decline&lead_id=${leadId}&email=${encodeURIComponent(contractorEmail)}`
      }

      const buttonsHtml = leadId ? `
        <div style="margin-top:30px; padding:20px; background:#f5f5f5; border-radius:8px;">
          <p style="margin-bottom:15px;"><strong>Quick Actions:</strong></p>
          <a href="${confirmUrl}" style="display:inline-block; background:#059669; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; margin-right:10px;">[Confirm] I Contacted This Lead</a>
          <a href="${declineUrl}" style="display:inline-block; background:#DC2626; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">[Decline] Pass to Next</a>
        </div>
        <p style="margin-top:20px; font-size:12px; color:#666;">
          Or reply with CONFIRMED or DECLINED
        </p>
      ` : `<p style="margin-top:20px; color:#666;">Contact lead directly.</p>`

      const contractorEmailHtml = `
        <h2 style="color:#D92B2B;">NEW WATER DAMAGE LEAD</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
        <p><strong>Email:</strong> ${email || 'N/A'}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Damage Type:</strong> ${damageType || 'N/A'}</p>
        <p><strong>Description:</strong> ${description || 'N/A'}</p>
        <hr>
        <p style="color:#D92B2B;font-weight:bold;">CALL THIS LEAD WITHIN 5 MINUTES!</p>
        ${buttonsHtml}
      `

      const adminEmailHtml = `
        <h2>New Lead Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Damage:</strong> ${damageType || 'N/A'}</p>
        <p><strong>Contractor:</strong> ${contractorEmail}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      `

      // Email to contractor via SMTP
      const cResult = await sendGmailSMTP(contractorEmail, gmailUser, gmailAppPassword, 
        `NEW LEAD - ${name} - ${city}`, contractorEmailHtml)
      console.log('Contractor email result:', cResult.status, cResult.error || '')

      // Email to admin via SMTP
      const aResult = await sendGmailSMTP(adminEmail, gmailUser, gmailAppPassword,
        `New Lead: ${name}`, adminEmailHtml)
      console.log('Admin email result:', aResult.status, aResult.error || '')
    } else {
      console.error('GMAIL_APP_PASSWORD not set - emails not sent')
    }

    return new Response(JSON.stringify({ success: true, message: 'Emails processed' }), {
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

// Use SMTP directly (app passwords work with SMTP)
async function sendGmailSMTP(to: string, from: string, password: string, subject: string, html: string) {
  console.log('SMTP: Starting to', to, 'from', from)
  try {
    console.log('SMTP: Connecting to smtp.gmail.com:587')
    const conn = await Deno.connect({ hostname: 'smtp.gmail.com', port: 587 })
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    
    const read = async () => { 
      const b = new Uint8Array(1024); 
      const n = await conn.read(b); 
      return n > 0 ? dec.decode(b.slice(0,n)) : '' 
    }
    const send = async (d: string) => { await conn.write(enc.encode(d)) }
    
    await read()
    await send('EHLO localhost\r\n')
    await read()
    console.log('SMTP: Sending STARTTLS')
    await send('STARTTLS\r\n')
    await read()
    
    console.log('SMTP: Starting TLS')
    const tls = await Deno.startTls(conn, { hostname: 'smtp.gmail.com' })
    const tenc = new TextEncoder()
    const tdec = new TextDecoder()
    const tsend = async (d: string) => { await tls.write(tenc.encode(d)) }
    const tread = async () => { 
      const b = new Uint8Array(1024); 
      const n = await tls.read(b); 
      return n > 0 ? tdec.decode(b.slice(0,n)) : '' 
    }
    
    console.log('SMTP: Sending EHLO')
    await tsend('EHLO localhost\r\n')
    await tread()
    console.log('SMTP: AUTH LOGIN')
    await tsend('AUTH LOGIN\r\n')
    await tread()
    console.log('SMTP: Sending username')
    await tsend(btoa(from) + '\r\n')
    await tread()
    const authStep2 = await tread()
    if (!authStep2.includes('334')) {
      console.log('SMTP auth step 1 failed:', authStep2)
      tls.close()
      return { status: 500, error: 'Auth step 1 failed' }
    }
    console.log('SMTP: Sending password')
    await tsend(btoa(password) + '\r\n')
    const authResult = await tread()
    console.log('SMTP auth result:', authResult)
    if (!authResult.includes('235')) {
      console.log('SMTP auth FAILED:', authResult)
      tls.close()
      return { status: 401, error: 'Auth failed: ' + authResult }
    }
    console.log('SMTP: Auth success, sending email')
    
    await tsend('MAIL FROM:<' + from + '>\r\n')
    await tread()
    await tsend('RCPT TO:<' + to + '>\r\n')
    await tread()
    await tsend('DATA\r\n')
    
    const msg = `From: <${from}>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.`
    await tsend(msg + '\r\n')
    await tread()
    await tsend('QUIT\r\n')
    tls.close()
    
    console.log('SMTP: DONE - email sent to:', to)
    return { status: 200 }
  } catch (e) {
    console.log('SMTP EXCEPTION:', e.message)
    return { status: 500, error: e.message }
  }
}
    
    await tsend('EHLO localhost\r\n')
    await tread()
    await tsend('AUTH LOGIN\r\n')
    await tread()
    await tsend(btoa(from) + '\r\n')
    await tread()
    const authStep2 = await tread()
    if (!authStep2.includes('334')) {
      console.log('SMTP auth step 1 failed:', authStep2)
      tls.close()
      return { status: 500, error: 'Auth step 1 failed' }
    }
    await tsend(btoa(password) + '\r\n')
    const authResult = await tread()
    if (!authResult.includes('235')) {
      console.log('SMTP auth failed:', authResult)
      tls.close()
      return { status: 401, error: 'Auth failed' }
    }
    
    await tsend('MAIL FROM:<' + from + '>\r\n')
    await tread()
    await tsend('RCPT TO:<' + to + '>\r\n')
    await tread()
    await tsend('DATA\r\n')
    
    const msg = `From: <${from}>\r\nTo: <${to}>\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.`
    await tsend(msg + '\r\n')
    await tread()
    await tsend('QUIT\r\n')
    tls.close()
    
    console.log('SMTP email sent to:', to)
    return { status: 200 }
  } catch (e) {
    console.log('SMTP error:', e.message)
    return { status: 500, error: e.message }
  }
}