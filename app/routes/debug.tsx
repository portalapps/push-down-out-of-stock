export async function loader({ request }: { request: Request }) {
  try {
    // Simple debug route - no Shopify auth, just see if basic routing works
    const url = new URL(request.url);
    return new Response(`
      <html>
        <body>
          <h1>Debug Route Working</h1>
          <p>URL: ${url}</p>
          <p>Time: ${new Date().toISOString()}</p>
          <p>Environment Check:</p>
          <ul>
            <li>SHOPIFY_API_KEY: ${process.env.SHOPIFY_API_KEY ? 'SET' : 'MISSING'}</li>
            <li>SHOPIFY_API_SECRET: ${process.env.SHOPIFY_API_SECRET ? 'SET' : 'MISSING'}</li>
            <li>SHOPIFY_APP_SESSION_SECRET: ${process.env.SHOPIFY_APP_SESSION_SECRET ? 'SET' : 'MISSING'}</li>
            <li>DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'MISSING'}</li>
          </ul>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error: any) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}