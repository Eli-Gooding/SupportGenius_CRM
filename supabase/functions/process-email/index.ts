import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OAuth2Client } from "https://deno.land/x/oauth2_client@v1.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessEmailRequest {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: {
      historyId: string;
    };
  };
  historyId?: string;
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
  redirectUri: '',
  defaults: {
    refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN')
  }
});

// After oauth2Client initialization, add this helper function
async function makeGmailRequest(url: string, options: RequestInit = {}) {
  try {
    // Get access token using the proven implementation from setup.ts
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GMAIL_CLIENT_SECRET') ?? '',
        refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN') ?? '',
        grant_type: 'refresh_token',
        scope: [
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.send'
        ].join(' ')
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token refresh error:', error);
      throw new Error(`Failed to refresh access token: ${error}`);
    }

    const tokens = await tokenResponse.json();
    
    // Make request with token
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    return response;
  } catch (error) {
    console.error('Error in makeGmailRequest:', error);
    throw error;
  }
}

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
    console.log("1. Processing incoming request");
    
    const requestData = await req.json() as ProcessEmailRequest;
    console.log("2. Full request data:", JSON.stringify(requestData, null, 2));
    
    if (!requestData.message?.data) {
      throw new Error('No message data received');
    }

    // Decode the base64 data
    const decodedString = atob(requestData.message.data);
    console.log("3. Decoded string:", decodedString);
    
    const decodedData = JSON.parse(decodedString);
    console.log("4. Parsed data:", JSON.stringify(decodedData, null, 2));
    
    // Get the history details to find the email ID
    const historyId = decodedData.historyId;
    console.log("4a. Using historyId:", historyId);
    
    if (!historyId) {
      throw new Error('No history ID found in notification');
    }

    // Instead of history, get the most recent message
    const messagesResponse = await makeGmailRequest(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&labelIds=INBOX&q=newer_than:1h'
    );

    if (!messagesResponse.ok) {
      const error = await messagesResponse.text();
      console.error('Messages response error:', error);
      throw new Error(`Failed to fetch messages: ${error}`);
    }

    const messagesData = await messagesResponse.json();
    console.log("5. Messages response:", JSON.stringify(messagesData, null, 2));

    const emailId = messagesData.messages?.[0]?.id;

    if (!emailId) {
      console.error("Messages data:", {
        hasMessages: !!messagesData.messages,
        messageCount: messagesData.messages?.length,
        firstMessage: JSON.stringify(messagesData.messages?.[0])
      });
      throw new Error('No recent messages found');
    }

    // Validate base64 string
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(requestData.message.data)) {
      console.error("Invalid base64 data received:", requestData.message.data.substring(0, 100) + "...");
      throw new Error('Invalid base64 data format');
    }
    
    // Get the email details from Gmail API
    const response = await makeGmailRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`
    );

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

    await makeGmailRequest(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        body: JSON.stringify({
          raw: btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        })
      }
    );

    return new Response(JSON.stringify({ 
      success: true,
      ticket_id: ticket.id,
      history_id: historyId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error("Detailed error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }), {
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