const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' }
  }

  try {
    const data = JSON.parse(event.body)
    const { name, phone, email, city, damage_type, description, lat, lng, source } = data

    if (!name || !phone || !city) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const timestamp = new Date().toISOString()

    const leadData = {
      name, phone,
      email: email || null,
      city, state: 'FL',
      lat: lat || null,
      lng: lng || null,
      damage_type: damage_type || null,
      description: description || null,
      status: 'sent',
      source: source || 'website',
      sent_to_contractor_at: timestamp,
      assigned_contractor_email: 'ctbelisle@gmail.com',
    }

    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify([leadData]),
    })

    if (!dbRes.ok) {
      const errText = await dbRes.text()
      console.error('Supabase insert failed:', dbRes.status, errText)
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error' }) }
    }

    const emailBody = new URLSearchParams({
      name, phone,
      email: email || '',
      city,
      'damage-type': damage_type || '',
      description: description || '',
    }).toString()

    try {
      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: emailBody,
      })
      if (!emailRes.ok) {
        const errText = await emailRes.text()
        console.error('Email send returned:', emailRes.status, errText)
      }
    } catch (emailErr) {
      console.error('Email send failed:', emailErr)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Lead submitted' }),
    }
  } catch (err) {
    console.error('Function error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
