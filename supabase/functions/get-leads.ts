// TampaRestore - Get Leads Edge Function
// Returns all leads for admin dashboard

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('DB_URL') || ''
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('ANON_KEY') || ''

    // Fetch leads directly via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/leads?order=created_at.desc&limit=100`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json'
      }
    })

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