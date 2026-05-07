// TampaRestore Lead Database - FULL VERSION

// ==================== WRITE LEAD ====================
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Sheet not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const params = e.parameter;
  
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
  
  // Append row to sheet
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

// ==================== READ LEADS (for Dashboard) ====================
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Sheet not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leads = [];
  
  // Skip header row, get all data
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1]) { // If name exists
      leads.push({
        id: row[0],
        name: row[1],
        phone: row[2],
        email: row[3],
        city: row[4],
        damage_type: row[5],
        description: row[6],
        lat: row[7],
        lng: row[8],
        status: row[9],
        created_at: row[10],
        notes: row[11]
      });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ leads: leads }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== UPDATE STATUS ====================
function updateStatus(e) {
  // This would need more complex setup - for now just use Sheet directly
}