import prisma from "../db.server";

export async function loader({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    
    // Test database connection
    let dbTest = "Not tested";
    let dbError = null;
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      dbTest = "SUCCESS - Connected to PostgreSQL";
    } catch (error: any) {
      dbTest = "FAILED";
      dbError = error.message;
    }

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
            <li>DATABASE_URL: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'MISSING'}</li>
          </ul>
          <h2>Database Connection Test:</h2>
          <p>Status: ${dbTest}</p>
          ${dbError ? `<p>Error: ${dbError}</p>` : ''}
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error: any) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}