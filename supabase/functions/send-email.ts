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
    const formData = await req.formData()
    
    const name = formData.get('name')?.toString() || ''
    const phone = formData.get('phone')?.toString() || ''
    const email = formData.get('email')?.toString() || ''
    const city = formData.get('city')?.toString() || ''
    const damageType = formData.get('damage-type')?.toString() || ''
    const description = formData.get('description')?.toString() || ''

    const contractorEmail = Deno.env.get('CONTRACTOR_EMAIL') || 'ctbelisle@gmail.com'
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const resendApiKey = Deno.env.get('RESEND_KEY') || ''

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Resend not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Email to CONTRACTOR
    const contractorHtml = `
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
        html: contractorHtml
      })
    })

    // Email to YOU (admin)
    const adminHtml = `
      <h2>📋 New Lead Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>City:</strong> ${city}</p>
      <p><strong>Damage:</strong> ${damageType || 'N/A'}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `

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
        html: adminHtml
      })
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})