// Shared gate check for unpaid commissions
// Used by send-email and contractor-action

const SUPABASE_URL = Deno.env.get('DB_URL') || 'https://aqafvfzsybcqfxqklqsd.supabase.co'
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''

export async function hasUnpaidCommissions(contractorEmail: string): Promise<boolean> {
  try {
    if (!SUPABASE_KEY) return false
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/commissions?contractor_email=eq.${encodeURIComponent(contractorEmail)}&status=eq.pending&select=id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        }
      }
    )
    const data = await res.json()
    return Array.isArray(data) && data.length > 0
  } catch (e) {
    console.error('Gate check failed:', e)
    return false // Fail open if check fails
  }
}

export async function getAvailableContractors(contractors: any[]): Promise<any[]> {
  const available: any[] = []
  for (const c of contractors) {
    const blocked = await hasUnpaidCommissions(c.email)
    if (!blocked) {
      available.push(c)
    }
  }
  return available.length > 0 ? available : contractors // Fall through to all if all blocked
}
