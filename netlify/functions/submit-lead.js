// TampaRestore — Lead handling with Supabase + Resend
// Netlify Function (free 125k req/mo)

const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const formData = new URLSearchParams(event.body);
    
    // Get all form fields
    const name = formData.get('name') || '';
    const phone = formData.get('phone') || '';
    const email = formData.get('email') || '';
    const city = formData.get('city') || '';
    const damageType = formData.get('damage-type') || '';
    const description = formData.get('description') || '';
    const lat = formData.get('lat') || '';
    const lng = formData.get('lng') || '';
    const source = formData.get('source') || 'website';
    const referralCode = formData.get('ref') || '';
    const botField = formData.get('bot-field');
    
    // Honeypot check - silently reject bot submissions
    if (botField) {
      return { statusCode: 200, body: 'Lead received' };
    }
    
    // Validate required fields
    if (!name || !phone || !city) {
      return { statusCode: 400, body: 'Missing required fields' };
    }
    
    const timestamp = new Date().toISOString();
    const contractorEmail = process.env.CONTRACTOR_EMAIL || 'ctbelisle@gmail.com';
    const adminEmail = process.env.ADMIN_EMAIL || 'tylerbelislefl@gmail.com';
    
    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    let supabase;
    
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }
    
    // Prepare lead data for Supabase
    const leadData = {
      name: name,
      phone: phone,
      email: email || null,
      city: city,
      state: 'FL',
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      damage_type: damageType,
      description: description || null,
      status: 'new',
      source: source,
      referral_code: referralCode || null,
      sent_to_contractor_at: timestamp,
      assigned_contractor_email: contractorEmail
    };
    
    // Save to Supabase if configured
    let supabaseResult = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select();
      
      if (error) {
        console.error('Supabase error:', error);
      } else {
        supabaseResult = data;
        console.log('Lead saved to Supabase:', data[0]?.id);
      }
    }
    
    // Send emails via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      // Email to CONTRACTOR (with full details)
      await resend.emails.send({
        from: 'TampaRestore Leads <leads@tamparestore.com>',
        to: [contractorEmail],
        subject: `🚨 NEW LEAD — ${name} needs water damage help in ${city}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #D92B2B;">🚨 New Water Damage Lead</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
            <p><strong>Email:</strong> ${email || 'N/A'}</p>
            <p><strong>City:</strong> ${city}</p>
            <p><strong>Damage Type:</strong> ${damageType || 'N/A'}</p>
            <p><strong>Description:</strong> ${description || 'N/A'}</p>
            <p><strong>Location:</strong> ${lat && lng ? `${lat}, ${lng}` : 'N/A'}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            <p style="color: #D92B2B; font-weight: bold;">⚠️ CALL THIS LEAD WITHIN 5 MINUTES!</p>
            <p>Lead ID: ${supabaseResult ? supabaseResult[0].id : 'N/A'}</p>
          </div>
        `
      });
      
      // Email to YOU (admin notification)
      await resend.emails.send({
        from: 'TampaRestore Admin <leads@tamparestore.com>',
        to: [adminEmail],
        subject: `📋 New Lead: ${name} - ${city} - ${damageType || 'Water Damage'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>📋 New Lead Received</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email || 'N/A'}</p>
            <p><strong>City:</strong> ${city}</p>
            <p><strong>Damage Type:</strong> ${damageType || 'N/A'}</p>
            <p><strong>Description:</strong> ${description || 'N/A'}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Contractor Notified:</strong> ${contractorEmail}</p>
            ${supabaseResult ? `<p><strong>DB ID:</strong> ${supabaseResult[0].id}</p>` : ''}
          </div>
        `
      });
    }
    
    console.log('Lead processed:', { name, phone, city, damageType, timestamp, supabaseId: supabaseResult?.[0]?.id });
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true, 
        message: 'Lead received and sent to contractor',
        leadId: supabaseResult ? supabaseResult[0].id : null
      }) 
    };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: 'Internal error: ' + error.message };
  }
};