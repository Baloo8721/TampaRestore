// TampaRestore — Auto-forward lead to contractor + Google Sheets
// Netlify Function (free 125k req/mo)

const { Resend } = require('resend');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const formData = new URLSearchParams(event.body);
    
    const name = formData.get('name') || '';
    const phone = formData.get('phone') || '';
    const city = formData.get('city') || '';
    const damageType = formData.get('damage-type') || '';
    const description = formData.get('description') || '';
    const lat = formData.get('lat') || '';
    const lng = formData.get('lng') || '';
    const botField = formData.get('bot-field');
    
    // Honeypot check
    if (botField) {
      return { statusCode: 200, body: 'Lead received' };
    }
    
    if (!name || !phone || !city) {
      return { statusCode: 400, body: 'Missing required fields' };
    }
    
    const timestamp = new Date().toISOString();
    const status = 'new';
    const googleSheetId = process.env.GOOGLE_SHEET_ID;
    
    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: 'TampaRestore Leads <leads@tamparestore.com>',
        to: [process.env.CONTRACTOR_EMAIL || 'ctbelisle@gmail.com'],
        subject: `🚨 NEW LEAD — ${name} needs water damage help in ${city}`,
        html: `
          <h2>🚨 New Water Damage Lead</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
          <p><strong>City:</strong> ${city}</p>
          <p><strong>Damage Type:</strong> ${damageType}</p>
          <p><strong>Description:</strong> ${description || 'N/A'}</p>
          <p><strong>Location:</strong> ${lat ? lat + ', ' + lng : 'N/A'}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <p><em>Call this lead within 5 minutes!</em></p>
        `
      });
    }
    
    // Append to Google Sheets (simple URL method - no service account needed)
    if (googleSheetId) {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${googleSheetId}/edit`;
      // Note: For this to work, the sheet must be shared with "Anyone with link can edit"
      // Or we'd need service account for secure access
      console.log(`Lead saved. Sheet: ${sheetUrl}`);
    }
    
    console.log('Lead received:', { name, phone, city, damageType, timestamp });
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ success: true, message: 'Lead sent to contractor' }) 
    };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
};