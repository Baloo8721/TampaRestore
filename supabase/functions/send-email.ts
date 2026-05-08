// TampaRestore - Send Email Edge Function

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let name = '', phone = '', email = '', city = '', damageType = '', description = ''
    
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      name = formData.get('name')?.toString() || ''
      phone = formData.get('phone')?.toString() || ''
      email = formData.get('email')?.toString() || ''
      city = formData.get('city')?.toString() || ''
      damageType = formData.get('damage-type')?.toString() || ''
      description = formData.get('description')?.toString() || ''
    } else if (contentType.includes('application/json')) {
      const body = await req.json()
      name = body.name || ''
      phone = body.phone || ''
      email = body.email || ''
      city = body.city || ''
      damageType = body['damage-type'] || ''
      description = body.description || ''
    } else {
      // Try to parse from URL for testing
      const url = new URL(req.url)
      name = url.searchParams.get('name') || ''
      phone = url.searchParams.get('phone') || ''
      email = url.searchParams.get('email') || ''
      city = url.searchParams.get('city') || ''
      damageType = url.searchParams.get('damage-type') || ''
      description = url.searchParams.get('description') || ''
    }

    const contractorEmail = Deno.env.get('CONTRACTOR_EMAIL') || 'ctbelisle@gmail.com'
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const resendApiKey = Deno.env.get('RESEND_KEY') || ''

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_KEY not configured in Edge Function secrets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Email to contractor
    await fetch('https://api.resend.com/emails', {
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

    // Email to admin
    await fetch('https://api.resend.com/emails', {
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
        `
      })
    })

    return new Response(JSON.stringify({ success: true, message: 'Emails sent' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})