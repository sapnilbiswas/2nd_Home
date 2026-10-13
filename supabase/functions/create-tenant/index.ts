import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }

    // 1. Verify caller has valid admin session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if caller is active admin
    const { data: callerProfile, error: profileCheckError } = await callerClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerUser.id)
      .single();

    if (profileCheckError || callerProfile?.role !== 'admin' || !callerProfile?.is_active) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request payload
    const body = await req.json();
    const { name, phone, roomId, tempPassword } = body;

    if (!phone || !name) {
      return new Response(JSON.stringify({ error: 'Name and Phone are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanedPhone = phone.trim().replace(/\D/g, '');
    const email = phone.includes('@') ? phone.trim().toLowerCase() : `${cleanedPhone}@house.app`;
    const finalPassword = tempPassword?.trim() || `Welcome@${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Create auth user with service-role key
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: newUserData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        phone: cleanedPhone,
        must_change_password: true,
      },
    });

    if (createUserError || !newUserData.user) {
      return new Response(
        JSON.stringify({ error: createUserError?.message || 'Failed to create user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = newUserData.user.id;

    // 4. Upsert tenant profile
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: tenantId,
      name: name.trim(),
      phone: cleanedPhone,
      role: 'tenant',
      is_active: true,
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    // 5. If roomId provided, create tenancy
    let tenancyData = null;
    if (roomId) {
      const today = new Date().toISOString().split('T')[0];
      const { data: createdTenancy, error: tenancyError } = await adminClient
        .from('tenancies')
        .insert({
          tenant_id: tenantId,
          room_id: Number(roomId),
          start_date: today,
        })
        .select()
        .single();

      if (tenancyError) {
        console.error('Tenancy creation error:', tenancyError);
      } else {
        tenancyData = createdTenancy;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant: {
          id: tenantId,
          name: name.trim(),
          phone: cleanedPhone,
          email,
          tempPassword: finalPassword,
          must_change_password: true,
        },
        tenancy: tenancyData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
