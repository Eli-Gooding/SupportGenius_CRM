import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  console.log('\n=== Getting Access Token ===');
  console.log('Using refresh token length:', refreshToken?.length || 0);
  console.log('Client ID format:', clientId?.endsWith('.apps.googleusercontent.com') ? 'Valid format' : 'Invalid format');
  console.log('Client Secret starts with:', clientSecret?.substring(0, 4) + '...');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send'
      ].join(' ')
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('\nFull token error response:', error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  console.log('Successfully obtained access token');
  return data.access_token;
}

async function getGmailUserInfo(accessToken: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to get Gmail user info');
  }
  
  return await response.json();
}

async function main() {
  console.log('\n=== Starting Setup ===');
  
  // Get the current working directory and go up three levels to the project root
  const currentDir = Deno.cwd();
  console.log('Current directory:', currentDir);
  
  // Construct path to root .env file
  const envPath = join(currentDir, '..', '..', '..', '.env');
  console.log('Looking for .env at:', envPath);
  
  // Load environment variables
  const env = await load({ envPath });
  
  // Check environment variables
  console.log('\nChecking environment variables:');
  const requiredVars = [
    'GMAIL_CLIENT_ID', 
    'GMAIL_CLIENT_SECRET', 
    'GMAIL_REFRESH_TOKEN',
    'GOOGLE_CLOUD_PROJECT',
    'PUBSUB_TOPIC'
  ];
  
  requiredVars.forEach(varName => {
    console.log(`${varName}: ${env[varName] ? 'Present' : 'Missing'}`);
  });

  // Additional validation
  if (!env["GOOGLE_CLOUD_PROJECT"] || !env["PUBSUB_TOPIC"]) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT or PUBSUB_TOPIC in .env file');
  }
  
  try {
    // Get access token using refresh token
    const accessToken = await getAccessToken(
      env["GMAIL_REFRESH_TOKEN"]!,
      env["GMAIL_CLIENT_ID"]!,
      env["GMAIL_CLIENT_SECRET"]!
    );
    
    // Get and display Gmail user info
    console.log('\n=== Checking Gmail Account ===');
    const userInfo = await getGmailUserInfo(accessToken);
    console.log('Setting up watch for Gmail account:', userInfo.emailAddress);
    
    // Prepare watch request
    const watchBody = {
      topicName: `projects/${env["GOOGLE_CLOUD_PROJECT"]}/topics/${env["PUBSUB_TOPIC"]}`,
      labelIds: ['INBOX']
    };
    
    console.log('\n=== Setting up Gmail watch ===');
    console.log('Watch request body:', JSON.stringify(watchBody, null, 2));
    
    // Set up Gmail watch
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(watchBody)
    });

    const responseText = await response.text();
    console.log('\nFull Gmail watch response:', responseText);

    if (!response.ok) {
      throw new Error(`Failed to set up Gmail watch: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('\n=== Success! ===');
    console.log('Watch setup complete. Details:');
    console.log('- Expiration:', new Date(parseInt(data.expiration)).toLocaleString());
    console.log('- History ID:', data.historyId);
    console.log('\nNote: You\'ll need to renew this watch within 7 days.');
  } catch (error) {
    console.error('\n=== Error ===');
    console.error('Error details:', error);
    throw error;
  }
}

// Run the main function
main(); 