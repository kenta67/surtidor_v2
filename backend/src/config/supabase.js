const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Cliente admin con service_role (bypasea RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Crear cliente con token del usuario (respeta RLS)
function createUserClient(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

module.exports = { supabaseAdmin, createUserClient, supabaseUrl, supabaseAnonKey };
