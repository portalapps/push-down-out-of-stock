export const loader = async () => {
  return new Response(JSON.stringify({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasApiKey: !!process.env.SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasSessionSecret: !!process.env.SHOPIFY_APP_SESSION_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    }
  }), {
    headers: { "Content-Type": "application/json" }
  });
};