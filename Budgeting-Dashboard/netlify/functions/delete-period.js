import { createClient } from '@supabase/supabase-js'

export const handler = async (event) => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  if (event.httpMethod !== 'DELETE') return { statusCode: 405, body: 'Method not allowed' }
  const { period } = JSON.parse(event.body)

  const { error } = await supabase.from('uploads').delete().eq('period', period)
  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, body: JSON.stringify({ deleted: period }) }
}
