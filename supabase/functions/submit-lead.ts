// TampaRestore - Supabase Edge Function
// Handles form submissions, writes to DB, sends emails

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
    const contractorEmail = Deno.env.get('CONTRACTOR_EMAIL') || 'ctbelisle@gmail.com'
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const supabaseUrl = Deno.env.get('DB_URL') || ''
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('ANON_KEY') || ''
    const resendApiKey = Deno.env.get('RESEND_KEY') || ''

    // Write to Supabase
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
      status: 'new',
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

    // Send emails via Resend API
    if (resendApiKey) {
      const emailBody = `
        <h2>🚨 New Water Damage Lead</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
        <p><strong>Email:</strong> ${email || 'N/A'}</p>
        <p><strong>City:</strong> ${city}</p>
        <p><strong>Damage Type:</strong> ${damageType || 'N/A'}</p>
        <p><strong>Description:</strong> ${description || 'N/A'}</p>
        <hr>
        <p><strong>CALL THIS LEAD WITHIN 5 MINUTES!</strong></p>
      `

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
          html: emailBody
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
          html: `<h2>📋 New Lead</h2><p>${name} - ${phone} - ${city}</p>`
        })
      })
    }

    return new Response(JSON.stringify({ success: true, message: 'Lead saved' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})