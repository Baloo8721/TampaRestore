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
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
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
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
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
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
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

    // Simple thank you for contractor
    if (action === 'confirm') {
      return new Response(
        '<html><head><meta charset="utf-8"><title>Thanks</title></head><body style="font-family:Arial;text-align:center;padding:40px;background:#f5f5f5;"><h1 style="color:green;">THANKS!</h1><p><strong>' + lead.name + '</strong></p><p>' + lead.phone + '</p><p>' + lead.city + '</p><hr><p>Questions? Email: tylerbelislefl@gmail.com</p></body></html>',
        { 'Content-Type': 'text/html' }
      )
    }
    
    if (action === 'decline') {
      return new Response(
        '<html><head><meta charset="utf-8"><title>Passed</title></head><body style="font-family:Arial;text-align:center;padding:40px;background:#f5f5f5;"><h1 style="color:orange;">PASSED</h1><p><strong>' + lead.name + '</strong></p><p>' + lead.phone + '</p><hr><p>This lead has been passed on.</p></body></html>',
        { 'Content-Type': 'text/html' }
      )
    }

    return new Response('Done', { 'Content-Type': 'text/plain' })

  } catch (error) {
    return new Response(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"></head><body style="font-family: Arial; text-align: center; padding: 40px;">
        <h2 style="color: red;">Error</h2>
        <p>${error.message}</p>
      </body></html>
    `, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
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