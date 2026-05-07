// TampaRestore Lead Database

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Sheet not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const params = e.parameter;
  
  // Get data from form - MATCHES SHEET COLUMNS EXACTLY
  const name = params.name || '';
  const phone = params.phone || '';
  const email = params.email || '';
  const city = params.city || '';
  const damageType = params.damage_type || '';
  const description = params.description || '';
  const lat = params.lat || '';
  const lng = params.lng || '';
  const timestamp = new Date().toISOString();
  
  // Honeypot check
  if (params.bot_field) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Validation
  if (!name || !phone || !city) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing required fields' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Append row to sheet - COLUMN ORDER MATCHES YOUR SHEET
  // A:id, B:name, C:phone, D:email, E:city, F:damage_type, G:description, H:lat, I:lng, J:status, K:created_at, L:notes
  sheet.appendRow([
    Utilities.getUuid(),
    name,
    phone,
    email,
    city,
    damageType,
    description,
    lat,
    lng,
    'new',
    timestamp,
    ''
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', lead: name }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput('TampaRestore API is running')
    .setMimeType(ContentService.MimeType.TEXT);
}