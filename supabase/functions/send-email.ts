// TampaRestore - Send Email Edge Function
// Called by form submit to send notifications

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read the request body
    const body = await req.text()
    
    // Parse URL-encoded form data manually
    const params = new URLSearchParams(body)
    const name = params.get('name') || ''
    const phone = params.get('phone') || ''
    const email = params.get('email') || ''
    const city = params.get('city') || ''
    const damageType = params.get('damage-type') || ''
    const description = params.get('description') || ''

    console.log('Received lead:', { name, phone, city, damageType })

    const contractorEmail = Deno.env.get('CONTRACTOR_EMAIL') || 'ctbelisle@gmail.com'
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const resendApiKey = Deno.env.get('RESEND_KEY') || ''

    console.log('RESEND_KEY set:', resendApiKey ? 'yes' : 'NO!')

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Email to CONTRACTOR
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + resendApiKey
      },
      body: JSON.stringify({
        from: 'TampaRestore Leads <leads@tamparestore.com>',
        to: [contractorEmail],
        subject: `🚨 NEW LEAD — ${name} needs water damage help in ${city}`,
        html: `
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
      })
    })
    console.log('Contractor email response:', r1.status)

    // Email to ADMIN
    const r2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + resendApiKey
      },
      body: JSON.stringify({
        from: 'TampaRestore Admin <leads@tamparestore.com>',
        to: [adminEmail],
        subject: `📋 New Lead: ${name} - ${city}`,
        html: `
          <h2>📋 New Lead Received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>City:</strong> ${city}</p>
          <p><strong>Damage:</strong> ${damageType || 'N/A'}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
      })
    })
    console.log('Admin email response:', r2.status)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Emails sent',
      contractorStatus: r1.status,
      adminStatus: r2.status
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