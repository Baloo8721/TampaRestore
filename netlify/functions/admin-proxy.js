const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' }
  }

  try {
    const { method, path, body: requestBody } = JSON.parse(event.body)

    if (!method || !path) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing method or path' }) }
    }

    const fetchHeaders = {
      'apikey': SUPABASE_ANON_KEY,
    }

    if (path.startsWith('/auth/')) {
      fetchHeaders['Content-Type'] = 'application/json'
    } else {
      fetchHeaders['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`
      fetchHeaders['Content-Type'] = 'application/json'
      fetchHeaders['Prefer'] = 'return=minimal'
    }

    const fetchOptions = { method, headers: fetchHeaders }
    if (requestBody && method !== 'GET' && method !== 'DELETE') {
      fetchOptions.body = JSON.stringify(requestBody)
    }

    console.log(`Proxying: ${method} ${path}`)

    const response = await fetch(`${SUPABASE_URL}${path}`, fetchOptions)
    const responseBody = await response.text()

    return {
      statusCode: response.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: responseBody,
    }
  } catch (err) {
    console.error('Proxy error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
