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
    const leadId = params.get('lead_id') || ''

    const contractorEmail = 'ctbelisle@gmail.com'
    const adminEmail = 'tylerbelislefl@gmail.com'
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''

    if (!gmailAppPassword) {
      return new Response(JSON.stringify({ error: 'GMAIL_APP_PASSWORD not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const edgeFunctionUrl = 'https://aqafvfzsybcqfxqklqsd.supabase.co/functions/v1'
    
    let buttons = ''
    if (leadId && leadId.length > 0) {
      buttons = '<div style="margin-top:30px;padding:20px;background:#f5f5f5;border-radius:8px;">' +
        '<p style="margin-bottom:15px;"><strong>Quick Actions:</strong></p>' +
        '<a href="' + edgeFunctionUrl + '/contractor-action?action=confirm&lead_id=' + leadId + '&email=' + contractorEmail + '" style="display:inline-block;background:#059669;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:10px;">I Contacted This Lead</a>' +
        '<a href="' + edgeFunctionUrl + '/contractor-action?action=decline&lead_id=' + leadId + '&email=' + contractorEmail + '" style="display:inline-block;background:#DC2626;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Decline / Pass</a>' +
        '</div>'
    }

    const leadHtml = '<h2 style="color:#D92B2B;">NEW WATER DAMAGE LEAD</h2>' +
      '<p><strong>Name:</strong> ' + name + '</p>' +
      '<p><strong>Phone:</strong> <a href="tel:' + phone + '">' + phone + '</a></p>' +
      '<p><strong>Email:</strong> ' + (email || 'N/A') + '</p>' +
      '<p><strong>City:</strong> ' + city + '</p>' +
      '<p><strong>Damage Type:</strong> ' + (damageType || 'N/A') + '</p>' +
      '<p><strong>Description:</strong> ' + (description || 'N/A') + '</p>' +
      '<hr><p style="color:#D92B2B;font-weight:bold;">CALL THIS LEAD WITHIN 5 MINUTES!</p>' + buttons

    const adminHtml = '<h2>New Lead Received</h2>' +
      '<p><strong>Name:</strong> ' + name + '</p>' +
      '<p><strong>Phone:</strong> ' + phone + '</p>' +
      '<p><strong>City:</strong> ' + city + '</p>' +
      '<p><strong>Damage:</strong> ' + (damageType || 'N/A') + '</p>' +
      '<p><strong>Time:</strong> ' + new Date().toLocaleString() + '</p>'

    await sendEmailGmailSmtp('tylerbelislefl@gmail.com', gmailAppPassword, contractorEmail, 'NEW LEAD - ' + name + ' - ' + city, leadHtml)
    await sendEmailGmailSmtp('tylerbelislefl@gmail.com', gmailAppPassword, adminEmail, 'New Lead: ' + name, adminHtml)

    return new Response(JSON.stringify({ success: true, message: 'Emails sent' }), {
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

async function sendEmailGmailSmtp(user, password, to, subject, html) {
  const conn = await Deno.connect({ hostname: 'smtp.gmail.com', port: 587 })
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const read = async () => { const b = new Uint8Array(1024); const n = await conn.read(b); return dec.decode(b.slice(0,n)) }
  const send = async (d) => { await conn.write(enc.encode(d)) }
  await read(); await send('EHLO localhost\r\n'); await read()
  await send('STARTTLS\r\n'); await read()
  const tls = await Deno.startTls(conn, { hostname: 'smtp.gmail.com' })
  const tenc = new TextEncoder(); const tdec = new TextDecoder()
  const tsend = async (d) => { await tls.write(tenc.encode(d)) }
  const tread = async () => { const b = new Uint8Array(1024); const n = await tls.read(b); return tdec.decode(b.slice(0,n)) }
  await tsend('EHLO localhost\r\n'); await tread()
  await tsend('AUTH LOGIN\r\n'); await tread()
  await tsend(btoa(user) + '\r\n'); await tread()
  await tsend(btoa(password) + '\r\n'); const auth = await tread()
  if (!auth.includes('235')) { tls.close(); throw new Error('SMTP auth failed') }
  await tsend('MAIL FROM:<' + user + '>\r\n'); await tread()
  await tsend('RCPT TO:<' + to + '>\r\n'); await tread()
  await tsend('DATA\r\n')
  const msg = 'From: <' + user + '>\r\nTo: <' + to + '>\r\nSubject: ' + subject + '\r\nContent-Type: text/html; charset=utf-8\r\n\r\n' + html + '\r\n.'
  await tsend(msg + '\r\n'); await tread()
  await tsend('QUIT\r\n'); tls.close()
  return 235
}