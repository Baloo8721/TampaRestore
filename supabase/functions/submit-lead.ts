// TampaRestore - Supabase Edge Function
// Handles form submissions, writes to DB, sends emails

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@3.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    const botField = formData.get('bot-field')?.toString()

    // Honeypot check
    if (botField) {
      return new Response(JSON.stringify({ success: true, message: 'Lead received' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate
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

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Lead data for DB
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

    // Write to Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()

    if (error) {
      console.error('Supabase error:', error)
    }

    // Send emails via Resend
    if (resendApiKey) {
      const resend = new Resend(resendApiKey)
      
      // Email to CONTRACTOR
      await resend.emails.send({
        from: 'TampaRestore Leads <leads@tamparestore.com>',
        to: [contractorEmail],
        subject: `🚨 NEW LEAD — ${name} needs water damage help in ${city}`,
        html: `
          <h2>🚨 New Water Damage Lead</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
          <p><strong>Email:</strong> ${email || 'N/A'}</p>
          <p><strong>City:</strong> ${city}</p>
          <p><strong>Damage Type:</strong> ${damageType || 'N/A'}</p>
          <p><strong>Description:</strong> ${description || 'N/A'}</p>
          <p><strong>Location:</strong> ${lat && lng ? `${lat}, ${lng}` : 'N/A'}</p>
          <hr>
          <p><strong>CALL THIS LEAD WITHIN 5 MINUTES!</strong></p>
          ${data ? `<p>Lead ID: ${data[0].id}</p>` : ''}
        `
      })

      // Email to YOU (admin)
      await resend.emails.send({
        from: 'TampaRestore Admin <leads@tamparestore.com>',
        to: [adminEmail],
        subject: `📋 New Lead: ${name} - ${city}`,
        html: `
          <h2>📋 New Lead Received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>City:</strong> ${city}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Lead saved and sent',
      leadId: data?.[0]?.id 
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