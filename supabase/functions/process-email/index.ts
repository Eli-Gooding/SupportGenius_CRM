import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OAuth2Client } from "https://deno.land/x/oauth2_client@v1.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GmailPushNotification {
  message: {
    data: string; // Base64 encoded JSON
    messageId: string;
    publishTime: string;
    attributes?: {
      historyId: string;
    };
  };
  subscription: string;
}

// Initialize Supabase client
const supabaseClient: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Initialize OAuth2 client for Gmail
const oauth2Client = new OAuth2Client({
  clientId: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
  clientSecret: Deno.env.get('GMAIL_CLIENT_SECRET') ?? '',
  authorizationEndpointUri: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUri: 'https://oauth2.googleapis.com/token',
});

// Set refresh token
oauth2Client.setCredentials({
  refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN')
});

async function getEmailTemplate(templateKey: string): Promise<{ subject_template: string; body_template: string; } | null> {
  const { data: template, error } = await supabaseClient
    .from('email_templates')
    .select('subject_template, body_template')
    .eq('template_key', templateKey)
    .single();
  
  if (error) {
    console.error('Error fetching template:', error);
    return null;
  }
  
  return template;
}

function formatTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => variables[key] || `{${key}}`);
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the push notification data
    const pushData = await req.json() as GmailPushNotification;
    
    // Decode the base64 data
    const decodedData = JSON.parse(atob(pushData.message.data));
    const emailId = decodedData.message?.id || decodedData.emailId;
    const historyId = pushData.message.attributes?.historyId || decodedData.historyId;

    if (!emailId) {
      throw new Error('No email ID found in notification');
    }

    // Get the email details from Gmail API
    const response = await oauth2Client.request({
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email details');
    }

    const emailData = await response.json();
    
    // Extract email details
    const headers = emailData.payload.headers;
    const from = headers.find((h: any) => h.name === 'From')?.value ?? '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value ?? '';
    const senderEmail = from.match(/<(.+)>/)?.[1] || from;

    // Get email body
    let body = '';
    if (emailData.payload.parts) {
      const textPart = emailData.payload.parts.find((part: any) => part.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    } else if (emailData.payload.body.data) {
      body = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    // Check if user exists
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', senderEmail)
      .single();

    let userId: string;
    let isNewUser = false;
    let tempPassword = '';

    if (!existingUser) {
      // Create new user with temporary password
      tempPassword = generateTempPassword();
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
        email: senderEmail,
        password: tempPassword,
        email_confirm: true
      });

      if (authError) throw authError;

      // Create user record with default name and company
      const { data: newUser, error: userError } = await supabaseClient
        .from('users')
        .insert({
          id: authUser.user.id,
          email: senderEmail,
          full_name: from.split('<')[0].trim() || 'New User',
          company_id: Deno.env.get('DEFAULT_COMPANY_ID')
        })
        .single();

      if (userError) throw userError;

      userId = authUser.user.id;
      isNewUser = true;
    } else {
      userId = existingUser.id;
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .insert({
        title: subject || 'New Support Request',
        created_by_user_id: userId,
        ticket_status: 'new',
        priority: 'medium',
        category_id: Deno.env.get('DEFAULT_TICKET_CATEGORY')
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Create initial message
    const { error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        ticket_id: ticket.id,
        sender_type: 'user',
        sender_id: userId,
        content: body
      });

    if (messageError) throw messageError;

    // Get appropriate email template
    const templateKey = isNewUser ? 'new_user_ticket' : 'existing_user_ticket';
    const template = await getEmailTemplate(templateKey);
    
    if (!template) {
      throw new Error(`Email template '${templateKey}' not found`);
    }

    // Format template with variables
    const variables = {
      user_name: existingUser?.full_name || from.split('<')[0].trim() || 'User',
      user_email: senderEmail,
      ticket_id: ticket.id,
      temp_password: tempPassword,
      login_url: Deno.env.get('NEXT_PUBLIC_APP_URL') || ''
    };

    const emailSubject = formatTemplate(template.subject_template, variables);
    const emailBody = formatTemplate(template.body_template, variables);

    // Send response email
    const message = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      'MIME-Version: 1.0\n',
      'Content-Transfer-Encoding: 7bit\n',
      `To: ${senderEmail}\n`,
      `From: ${Deno.env.get('SUPPORT_EMAIL')}\n`,
      `Subject: ${emailSubject}\n\n`,
      emailBody
    ].join('');

    await oauth2Client.request({
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      method: 'POST',
      body: JSON.stringify({
        raw: btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      })
    });

    return new Response(JSON.stringify({ 
      success: true,
      ticket_id: ticket.id,
      history_id: historyId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateTempPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each required character type
  password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // uppercase
  password += getRandomChar('abcdefghijklmnopqrstuvwxyz'); // lowercase
  password += getRandomChar('0123456789'); // number
  password += getRandomChar('!@#$%^&*'); // special
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function getRandomChar(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)];
} 