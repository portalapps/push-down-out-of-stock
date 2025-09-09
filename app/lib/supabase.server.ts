import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gbfvnmdjgnggnrvhyxgp.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)