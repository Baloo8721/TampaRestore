// TampaRestore - Get Leads Edge Function
// Returns all leads for admin dashboard - PUBLIC ACCESS

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get from env vars (set in Supabase Edge Function settings)
    const supabaseUrl = Deno.env.get('DB_URL') || ''
    const anonKey = Deno.env.get('ANON_KEY') || ''

    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing config' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch leads via Supabase REST API using anon key (designed for public use)
    const response = await fetch(
      `${supabaseUrl}/rest/v1/leads?order=created_at.desc&limit=100`,
      {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: 'API error: ' + response.status, details: err }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const leads = await response.json()

    return new Response(JSON.stringify({ leads }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})