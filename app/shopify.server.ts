// SHOPIFY INTEGRATION SETUP
// This file configures our connection to Shopify and provides authentication/API functionality
// It's the bridge between our app and the Shopify platform

// Import Node.js adapter for the Shopify app framework
import "@shopify/shopify-app-remix/adapters/node";

// Import core Shopify app functionality
import {
  ApiVersion,           // Defines which version of Shopify's API to use
  AppDistribution,      // Defines how our app is distributed (App Store vs Custom)
  shopifyApp,          // Main function that creates our Shopify app instance
} from "@shopify/shopify-app-remix/server";

// Import Prisma session storage
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// MAIN SHOPIFY APP CONFIGURATION
// This creates the core app instance that handles all Shopify interactions
const shopify = shopifyApp({
  // App credentials (set in environment variables for security)
  apiKey: process.env.SHOPIFY_API_KEY,                    // Public app identifier
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",     // Secret key for authentication
  
  // API version to use (January 2025 is the latest stable version)
  apiVersion: ApiVersion.January25,
  
  // Permissions our app needs (from environment or fallback to empty)
  scopes: process.env.SCOPES?.split(","),
  
  // The URL where our app is hosted
  appUrl: process.env.SHOPIFY_APP_URL || "",
  
  // URL prefix for OAuth authentication routes
  authPathPrefix: "/auth",
  
  // How to store user sessions (using official Prisma session storage)
  sessionStorage: new PrismaSessionStorage(prisma),
  
  // How our app is distributed (App Store means it's publicly available)
  distribution: AppDistribution.AppStore,
  
  // Feature flags for new/experimental functionality
  future: {
    unstable_newEmbeddedAuthStrategy: true,  // Use the latest embedded app auth flow
    removeRest: true,                        // Remove legacy REST API support (we only use GraphQL)
  },
  
  // Support for custom domains (if environment variable is set)
  // This allows the app to work with shops that use custom domains
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// EXPORTED FUNCTIONALITY
// These exports make Shopify functionality available to other parts of our app

export default shopify;  // The main shopify app instance

// API version constant (used for consistency across the app)
export const apiVersion = ApiVersion.January25;

// Response header management (handles CORS, security headers, etc.)
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;

// Authentication functions
export const authenticate = shopify.authenticate;      // Verify user is logged in and get their session
export const unauthenticated = shopify.unauthenticated; // Handle requests from non-authenticated users
export const login = shopify.login;                   // Initiate the login flow

// Webhook management
export const registerWebhooks = shopify.registerWebhooks; // Register webhook subscriptions

// Session management
export const sessionStorage = shopify.sessionStorage;     // Access to session storage methods
