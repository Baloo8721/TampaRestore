// TampaRestore Lead Database - WITH CORS FIX

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found' });
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
  
  if (params.bot_field) {
    return jsonResponse({ status: 'ok' });
  }
  
  if (!name || !phone || !city) {
    return jsonResponse({ error: 'Missing required fields' });
  }
  
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
  
  return jsonResponse({ status: 'ok', lead: name });
}

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found' });
  }
  
  const data = sheet.getDataRange().getValues();
  const leads = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1]) {
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
  
  return jsonResponse({ leads: leads });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}