// TampaRestore - Send Email Edge Function
// Uses Gmail SMTP with App Password

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const contractorEmail = Deno.env.get('CONTRACTOR_EMAIL') || 'ctbelisle@gmail.com'
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const gmailUser = Deno.env.get('GMAIL_USER') || 'tylerbelislefl@gmail.com'
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''

    if (!gmailAppPassword) {
      return new Response(JSON.stringify({ error: 'GMAIL_APP_PASSWORD not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const leadHtml = `
      <h2 style="color:#D92B2B;">🚨 NEW WATER DAMAGE LEAD</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
      <p><strong>Email:</strong> ${email || 'N/A'}</p>
      <p><strong>City:</strong> ${city}</p>
      <p><strong>Damage Type:</strong> ${damageType || 'N/A'}</p>
      <p><strong>Description:</strong> ${description || 'N/A'}</p>
      <hr>
      <p style="color:#D92B2B;font-weight:bold;">⚠️ CALL THIS LEAD WITHIN 5 MINUTES!</p>
    `

    const adminHtml = `
      <h2>📋 New Lead Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>City:</strong> ${city}</p>
      <p><strong>Damage:</strong> ${damageType || 'N/A'}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `

    // Send to contractor
    const contractorStatus = await sendEmailGmailSmtp(
      gmailUser,
      gmailAppPassword,
      contractorEmail,
      `🚨 NEW LEAD — ${name} needs water damage help in ${city}`,
      leadHtml
    )

    // Send to admin
    const adminStatus = await sendEmailGmailSmtp(
      gmailUser,
      gmailAppPassword,
      adminEmail,
      `📋 New Lead: ${name} - ${city}`,
      adminHtml
    )

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Emails sent',
      contractorStatus,
      adminStatus
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