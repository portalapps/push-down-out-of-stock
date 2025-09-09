export const loader = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);
  
  return new Response(JSON.stringify({
    status: "working",
    timestamp: new Date().toISOString(),
    url: request.url,
    searchParams,
    headers: Object.fromEntries(request.headers.entries()),
    env: {
      hasApiKey: !!process.env.SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasSessionSecret: !!process.env.SHOPIFY_APP_SESSION_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      apiKey: process.env.SHOPIFY_API_KEY?.substring(0, 8) + "...",
      nodeEnv: process.env.NODE_ENV
    }
  }, null, 2), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
};