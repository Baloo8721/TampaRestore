// TampaRestore - Contractor Action Edge Function
// Handles: confirm contact, decline lead, undo action

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const ANON_KEY = Deno.env.get('ANON_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const leadId = url.searchParams.get('lead_id')
    const contractorEmail = url.searchParams.get('email')
    const providedApikey = url.searchParams.get('apikey')

    // Validate apikey if provided, otherwise skip for backward compatibility
    if (providedApikey && providedApikey !== ANON_KEY) {
      return new Response(`
        <!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 40px;">
          <h2 style="color: red;">Unauthorized</h2>
          <p>Invalid API key.</p>
        </body></html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } })
    }

    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'tylerbelislefl@gmail.com'
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') || ''

    if (!leadId || !action) {
      return new Response(`
        <!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 40px;">
          <h2 style="color: red;">Missing Information</h2>
          <p>Please contact support.</p>
        </body></html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } })
    }

    // Get current lead data
    const getLeadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    })
    const leads = await getLeadRes.json()
    const lead = leads[0]

    if (!lead) {
      return new Response(`
        <!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 40px;">
          <h2 style="color: red;">Lead Not Found</h2>
          <p>This lead may have been removed.</p>
        </body></html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } })
    }

    const timestamp = new Date().toISOString()
    let updates: Record<string, unknown> = { updated_at: timestamp }

    console.log('Action:', action, 'leadId:', leadId)

    // Get contractor list from DB
    let contractorList: string[] = []
    console.log('Fetching contractors from:', `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&order=priority.asc`)
    const contractorRes = await fetch(
      `${SUPABASE_URL}/rest/v1/contractors?active=eq.true&order=priority.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        }
      }
    )
    const contractors = await contractorRes.json()
    console.log('Contractors from DB:', contractors)
    if (contractors && contractors.length > 0) {
      contractorList = contractors.map((c: any) => c.email)
    }
    // Fallback if no contractors in DB
    if (contractorList.length === 0) {
      contractorList = ['ctbelisle@gmail.com']
    }
    
    // Find current contractor index
    const currentIndex = contractorList.indexOf(lead.assigned_contractor_email || '')
    const nextContractor = currentIndex >= 0 && currentIndex < contractorList.length - 1 
      ? contractorList[currentIndex + 1] 
      : null

    if (action === 'confirm') {
      updates = {
        ...updates,
        status: 'contacted',
        contractor_contacted_at: timestamp,
        contractor_response_minutes: lead.sent_to_contractor_at 
          ? Math.round((new Date(timestamp).getTime() - new Date(lead.sent_to_contractor_at).getTime()) / 60000)
          : 0
      }

      // Send confirmation email to admin
      if (gmailAppPassword) {
        sendGmailNotification(adminEmail, gmailAppPassword, `✅ Lead Confirmed: ${lead.name}`, 
          `<p><strong>Contractor:</strong> ${lead.assigned_contractor_email}</p>
           <p><strong>Lead:</strong> ${lead.name} - ${lead.phone}</p>
           <p><strong>City:</strong> ${lead.city}</p>
           <p><strong>Response time:</strong> ${updates.contractor_response_minutes} minutes</p>`)
      }

    } else if (action === 'decline') {
      updates = {
        ...updates,
        status: 'declined',
        notes: (lead.notes || '') + `\n[${timestamp}] Declined by ${lead.assigned_contractor_email}`
      }

      // If there's a next contractor, assign to them
      if (nextContractor) {
        updates.assigned_contractor_email = nextContractor
        updates.status = 'sent'
        updates.sent_to_contractor_at = timestamp

        // Send email to next contractor
        if (gmailAppPassword) {
          const nextEmailBody = `
            <h2 style="color:#D92B2B;">🚨 LEAD PASSED TO YOU</h2>
            <p>The previous contractor declined this lead. It's now assigned to you.</p>
            <hr>
            <p><strong>Name:</strong> ${lead.name}</p>
            <p><strong>Phone:</strong> <a href="tel:${lead.phone}">${lead.phone}</a></p>
            <p><strong>City:</strong> ${lead.city}</p>
            <p><strong>Damage Type:</strong> ${lead.damage_type || 'N/A'}</p>
            <p><strong>Description:</strong> ${lead.description || 'N/A'}</p>
            <hr>
            <p style="color:#D92B2B;font-weight:bold;">⚠️ CALL THIS LEAD WITHIN 5 MINUTES!</p>
          `
          sendGmailDirect(gmailAppPassword, nextContractor, `🚨 New Lead: ${lead.name}`, nextEmailBody)
        }
      } else {
        updates.status = 'no_contractor'
        // Alert admin - no contractors available
        if (gmailAppPassword) {
          sendGmailNotification(adminEmail, gmailAppPassword, `⚠️ NO CONTRACTORS AVAILABLE: ${lead.name}`,
            `<p>This lead was declined but there are no other contractors in the rotation.</p>
             <p><strong>Lead:</strong> ${lead.name} - ${lead.phone}</p>
             <p><strong>City:</strong> ${lead.city}</p>
             <p>Please add more contractors in the admin dashboard.</p>`)
        }
      }

      // Notify admin
      if (gmailAppPassword) {
        sendGmailNotification(adminEmail, gmailAppPassword, `⚠️ Lead Declined: ${lead.name}`,
          `<p><strong>Contractor:</strong> ${lead.assigned_contractor_email}</p>
           <p><strong>Lead:</strong> ${lead.name} - ${lead.phone}</p>
           <p><strong>Next contractor:</strong> ${nextContractor || 'None available'}</p>`)
      }

    } else if (action === 'undo') {
      // Reset back to sent status
      updates = {
        ...updates,
        status: 'sent',
        contractor_contacted_at: null,
        contractor_response_minutes: null,
        notes: (lead.notes || '') + `\n[${timestamp}] Action undone by contractor`
      }
    }

    // Update lead in DB
    console.log('Updating lead:', leadId, 'with:', JSON.stringify(updates))
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updates)
    })
    console.log('Lead updated successfully')

    // Return confirmation page
    const actionText = action === 'confirm' ? 'confirmed' : action === 'decline' ? 'declined' : 'undone'
    const color = action === 'confirm' ? 'green' : action === 'decline' ? 'orange' : 'blue'

    // Custom thank you page for contractor
    const thankYouHtml = action === 'confirm' ? `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="text-align: center; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
<div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px;">
<div style="font-size: 60px; margin-bottom: 20px;">✅</div>
<h2 style="color: #059669; margin: 0 0 15px;">Thanks for responding!</h2>
<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
<p style="margin: 5px 0;"><strong>Lead:</strong> ${lead.name}</p>
<p style="margin: 5px 0;"><strong>Phone:</strong> ${lead.phone}</p>
<p style="margin: 5px 0;"><strong>City:</strong> ${lead.city}</p>
</div>
<p style="color: #666; margin-top: 20px;">Need help? Contact Tyler: <strong>tylerbelislefl@gmail.com</strong></p>
<p style="font-size: 12px; color: #999; margin-top: 30px;">You can close this window</p>
</div>
</body>
</html>
    ` : action === 'decline' ? `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="text-align: center; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
<div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px;">
<div style="font-size: 60px; margin-bottom: 20px;">❌</div>
<h2 style="color: #D97706; margin: 0 0 15px;">Lead Passed On</h2>
<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
<p style="margin: 5px 0;"><strong>Lead:</strong> ${lead.name}</p>
<p style="margin: 5px 0;"><strong>Phone:</strong> ${lead.phone}</p>
</div>
<p style="color: #666; margin-top: 20px;">This lead has been passed to the next contractor.</p>
<p style="font-size: 12px; color: #999; margin-top: 30px;">You can close this window</p>
</div>
</body>
</html>
    ` : ''

    return new Response(thankYouHtml || `
      <!DOCTYPE html>
      <html><body style="font-family: Arial; text-align: center; padding: 40px;">
        <h2>Done</h2>
      </body></html>
    `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } })

  } catch (error) {
    return new Response(`
      <!DOCTYPE html>
      <html><body style="font-family: Arial; text-align: center; padding: 40px;">
        <h2 style="color: red;">Error</h2>
        <p>${error.message}</p>
      </body></html>
    `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } })
  }
})

async function sendGmailNotification(to: string, password: string, subject: string, html: string) {
  // Use proper UTF-8 encoding
  const utf8Bytes = new TextEncoder().encode(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`)
  const base64 = btoa(String.fromCharCode(...utf8Bytes))
  const credentials = btoa(`tylerbelislefl@gmail.com:${password}`)
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: base64
    })
  })
  return { status: response.status }
}

async function sendGmailDirect(password: string, to: string, subject: string, html: string) {
  const utf8Bytes = new TextEncoder().encode(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`)
  const base64 = btoa(String.fromCharCode(...utf8Bytes))
  const credentials = btoa(`tylerbelislefl@gmail.com:${password}`)
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: base64
    })
  })
  return { status: response.status }
}