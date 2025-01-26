import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("1. Module initialization started");

const PUBSUB_PROJECT = "supportgenius-448720";
const SUBSCRIPTION = "gmail-notifications-sub";

console.log("2. Starting serve");

serve(async (req: Request) => {
  try {
    console.log("3. Received request");
    
    // Log headers properly
    const headersObject = Object.fromEntries(req.headers);
    console.log(`4. Request headers: ${JSON.stringify(headersObject, null, 2)}`);

    console.log("5. Getting access token");
    
    // Check environment variables
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    if (!serviceAccountKey) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT environment variable is not set");
    }
    
    console.log("5b. Environment variables check:");
    console.log(`- Service Account present: ${!!serviceAccountKey}`);
    
    const accessToken = await getAccessToken(serviceAccountKey);
    console.log("6. Got access token");

    console.log("7. Pulling messages from subscription");
    const pullRequestBody = {
      maxMessages: 10,
      returnImmediately: false
    };
    console.log(`7a. Pull request body: ${JSON.stringify(pullRequestBody)}`);
    
    const pullResponse = await fetch(
      `https://pubsub.googleapis.com/v1/projects/${PUBSUB_PROJECT}/subscriptions/${SUBSCRIPTION}:pull`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pullRequestBody)
      }
    );

    console.log(`8. Pull response status: ${pullResponse.status}`);
    const pullResponseText = await pullResponse.text();
    console.log(`8a. Raw pull response: ${pullResponseText}`);
    
    let pullData;
    try {
      pullData = JSON.parse(pullResponseText);
      console.log(`9. Pull response data: ${JSON.stringify(pullData, null, 2)}`);
    } catch (error) {
      console.error("Failed to parse pull response:", error);
      throw new Error(`Invalid JSON response: ${pullResponseText}`);
    }

    if (!pullResponse.ok) {
      throw new Error(`Failed to pull messages: ${pullResponse.status} ${JSON.stringify(pullData)}`);
    }

    // If we have messages, acknowledge them
    if (pullData.receivedMessages && pullData.receivedMessages.length > 0) {
      console.log(`10. Processing ${pullData.receivedMessages.length} messages to acknowledge`);
      
      // Forward each message to process-email function
      for (const message of pullData.receivedMessages) {
        try {
          console.log("Message structure:", {
            hasMessage: !!message.message,
            messageData: message.message,
            ackId: message.ackId,
            // Log the full message for debugging (be careful with sensitive data)
            fullMessage: JSON.stringify(message, null, 2)
          });

          const processResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-email`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: message.message,  // Send the entire message object
                historyId: message.message?.attributes?.historyId
              })
            }
          );

          if (!processResponse.ok) {
            const errorText = await processResponse.text();
            console.error(`Failed to process message: ${errorText}`);
          } else {
            console.log(`Successfully forwarded message to process-email function`);
          }
        } catch (error) {
          console.error('Error forwarding message:', error);
        }
      }
      
      // Continue with acknowledgment...
      const ackIds = pullData.receivedMessages.map((msg: any) => msg.ackId);
      console.log(`10a. Acknowledgment IDs: ${JSON.stringify(ackIds)}`);
      
      try {
        const ackResponse = await fetch(
          `https://pubsub.googleapis.com/v1/projects/${PUBSUB_PROJECT}/subscriptions/${SUBSCRIPTION}:acknowledge`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ackIds: ackIds
            })
          }
        );

        console.log(`11. Acknowledge response status: ${ackResponse.status}`);
        if (!ackResponse.ok) {
          const ackError = await ackResponse.text();
          console.error(`Failed to acknowledge messages: ${ackResponse.status}`);
          console.error(`Acknowledge error details: ${ackError}`);
          throw new Error(`Acknowledgment failed: ${ackError}`);
        } else {
          console.log("11a. Successfully acknowledged messages");
        }
      } catch (ackError) {
        console.error("Error during acknowledgment:", ackError);
        throw ackError;
      }
    } else {
      console.log("10. No messages to acknowledge");
    }

    return new Response(JSON.stringify({ 
      success: true,
      receivedMessages: pullData.receivedMessages || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const now = Math.floor(Date.now() / 1000);
    
    // Add debug logging for private key
    console.log("5b1. Private key format check:");
    console.log(`- Key starts with: ${serviceAccount.private_key.substring(0, 30)}...`);
    
    // Clean and format private key properly
    const privateKey = serviceAccount.private_key
      .replace(/\\n/g, '\n')  // Replace escaped newlines
      .replace(/^"|"$/g, '')  // Remove surrounding quotes
      .replace(/-----BEGIN PRIVATE KEY-----\n/, '')  // Remove header
      .replace(/\n-----END PRIVATE KEY-----(\n)?/, '')  // Remove footer
      .replace(/\s/g, '');  // Remove all whitespace
    
    console.log("5b2. Cleaned key format check:");
    console.log(`- Cleaned key starts with: ${privateKey.substring(0, 30)}...`);
    
    // Create JWT header
    const header = {
      alg: "RS256",
      typ: "JWT"
    };

    // Create JWT claim
    const claim = {
      iss: serviceAccount.client_email,
      scope: [
        "https://www.googleapis.com/auth/pubsub",
        "https://www.googleapis.com/auth/cloud-platform"
      ].join(' '),
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };

    // Create base64-encoded header and claim
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedClaim = btoa(JSON.stringify(claim));
    
    try {
      // Sign the JWT
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "pkcs8",
        base64ToArrayBuffer(privateKey),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" },
        key,
        encoder.encode(`${encodedHeader}.${encodedClaim}`)
      );

      const jwt = `${encodedHeader}.${encodedClaim}.${arrayBufferToBase64(signature)}`;
      
      console.log("5c. Token request details:");
      console.log(`- URL: ${tokenUrl}`);
      console.log("- Using service account JWT");
      
      const params = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      });
      
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params
      });

      console.log(`5d. Token response status: ${response.status}`);
      const responseText = await response.text();
      const maskedResponse = responseText.replace(/"access_token":"[^"]+"/g, '"access_token":"[MASKED]"');
      console.log(`5e. Token response body: ${maskedResponse}`);

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status} ${responseText}`);
      }

      const data = JSON.parse(responseText);
      return data.access_token;
    } catch (cryptoError) {
      console.error("Crypto operation failed:", cryptoError);
      if (cryptoError instanceof Error) {
        console.error("Crypto error details:", cryptoError.message);
        console.error("Crypto error stack:", cryptoError.stack);
      }
      throw cryptoError;
    }
  } catch (error) {
    console.error("Error getting access token:", error);
    if (error instanceof Error) {
      console.error("Detailed error:", error.message);
      console.error("Stack trace:", error.stack);
    }
    throw error;
  }
}

// Utility functions for JWT signing
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
} 