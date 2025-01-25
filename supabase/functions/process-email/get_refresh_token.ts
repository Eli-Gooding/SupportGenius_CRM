import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { OAuth2Client } from "https://deno.land/x/oauth2_client@v1.0.2/mod.ts";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// Load environment variables
const env = await load({ envPath: "../../../.env" });

// Create OAuth2 client with exact playground settings
const oauth2Client = new OAuth2Client({
  clientId: env["GMAIL_CLIENT_ID"]!,
  clientSecret: env["GMAIL_CLIENT_SECRET"]!,
  authorizationEndpointUri: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUri: "https://oauth2.googleapis.com/token",
  redirectUri: "http://localhost:54321/callback",
  defaults: {
    scope: "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send"
  }
});

// Store PKCE verifier
let codeVerifier: string;

// Generate authorization URL with exact playground settings
const { uri: authorizeUrl, codeVerifier: generatedVerifier } = await oauth2Client.code.getAuthorizationUri({
  access_type: "offline",  // Match playground setting
  prompt: "consent",       // Match playground setting
  response_type: "code",   // Server-side flow
  usePKCE: true
});

// Store the code verifier for later use
codeVerifier = generatedVerifier;

console.log("\nIMPORTANT: Please follow these steps:");
console.log("1. Open this URL in an incognito window:");
console.log(authorizeUrl);
console.log("\n2. Sign in with supgenius.crmdemo@gmail.com");
console.log("3. Grant all requested permissions");
console.log("\nWaiting for authorization...");

// Start local server to handle the OAuth callback
serve(async (req: Request) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("No code received", { status: 400 });
    }

    try {
      // Exchange code for tokens using server-side flow
      const tokens = await oauth2Client.code.getToken(url, {
        codeVerifier,
        extraParams: {
          access_type: "offline",  // Ensure offline access
          grant_type: "authorization_code"  // Server-side flow
        }
      });
      
      if (!tokens.refreshToken) {
        return new Response(`
          <html>
            <body>
              <h1>No Refresh Token Received</h1>
              <p>Please try again and make sure to:</p>
              <ol>
                <li>Use an incognito window</li>
                <li>Sign in with supgenius.crmdemo@gmail.com</li>
                <li>Grant all permissions when prompted</li>
              </ol>
            </body>
          </html>
        `, {
          headers: { "content-type": "text/html" },
        });
      }

      console.log("\n=== Token Information ===");
      console.log("Refresh Token:", tokens.refreshToken);
      console.log("\nAdd this to your .env file as GMAIL_REFRESH_TOKEN");
      console.log("\nAccess Token (temporary):", tokens.accessToken);
      console.log("Scopes granted:", tokens.scope);

      return new Response(`
        <html>
          <body>
            <h1>Authorization Successful!</h1>
            <p>You can close this window and check your terminal for the refresh token.</p>
          </body>
        </html>
      `, {
        headers: { "content-type": "text/html" },
      });
    } catch (error) {
      console.error("Error getting tokens:", error);
      return new Response(`Error getting tokens: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
    }
  }

  return new Response("Not found", { status: 404 });
}, { port: 54321 }); 