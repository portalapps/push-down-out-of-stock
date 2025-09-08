# Shopify API Comprehensive Reference

*Last Updated: September 2025*

## 1. API Overview

### Core Shopify APIs

#### GraphQL Admin API
- **Purpose**: Build apps that extend and enhance the Shopify admin
- **Access**: Products, customers, orders, inventory, fulfillment data  
- **Use Cases**: Merchant-facing apps, inventory management, order processing
- **Authentication**: OAuth 2.0 with access scopes

#### Storefront API  
- **Purpose**: Create custom shopping experiences for any platform
- **Access**: Public store data, product catalogs, cart management
- **Use Cases**: Headless commerce, mobile apps, custom storefronts
- **Authentication**: Storefront access tokens

#### Partner API
- **Purpose**: Scale partner/developer business operations
- **Access**: Partner Dashboard data, app management, billing
- **Use Cases**: App analytics, automated operations, partner tools
- **Authentication**: Partner API credentials

---

## 2. GraphQL vs REST

### GraphQL Advantages (Recommended)
- **Precision**: Request exactly the data you need
- **Efficiency**: Single endpoint, multiple resources
- **Type Safety**: Strongly typed schema with built-in validation
- **Flexibility**: Evolving API without versioning issues
- **Documentation**: Self-documenting through schema introspection

### REST (Legacy, Still Supported)
- **Familiar**: Traditional HTTP methods (GET, POST, PUT, DELETE)
- **Caching**: Easier to cache with standard HTTP headers
- **Tooling**: More widespread tooling support
- **Learning Curve**: Lower barrier to entry

### When to Use Each
- **GraphQL**: New development, complex data requirements, performance critical
- **REST**: Legacy integrations, simple CRUD operations, team familiarity

---

## 3. API Versioning & Stability

### Version Strategy
- **Current Stable**: 2025-07 (recommended for production)
- **Release Cycle**: Quarterly releases (January, April, July, October)
- **Support Period**: 12 months minimum support
- **Deprecation**: 6-month advance notice for breaking changes

### Version Headers
```http
X-Shopify-Access-Token: your-access-token
X-Shopify-API-Version: 2025-07
Content-Type: application/json
```

### Best Practices
1. Always specify API version
2. Test against release candidates
3. Monitor deprecation notices
4. Update to latest stable versions regularly

---

## 4. Authentication & Authorization

### OAuth 2.0 Flow
```javascript
// 1. Authorization URL
const authUrl = `https://{shop}.myshopify.com/admin/oauth/authorize?` +
  `client_id=${clientId}&` +
  `scope=${scopes}&` +
  `redirect_uri=${redirectUri}&` +
  `state=${state}`;

// 2. Exchange code for token
const tokenResponse = await fetch(`https://{shop}.myshopify.com/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    code: authCode
  })
});
```

### Access Scopes
```javascript
// Common scopes
const scopes = [
  'read_products',
  'write_products', 
  'read_orders',
  'write_orders',
  'read_customers',
  'write_inventory',
  'read_analytics'
].join(',');
```

### Session Management
```javascript
// Store session data securely
const session = {
  shop: 'example.myshopify.com',
  accessToken: 'access-token',
  scope: 'read_products,write_products',
  expiresAt: null // Tokens don't expire but can be revoked
};
```

---

## 5. Rate Limiting

### Admin API Limits
- **Standard**: 40 requests per second per app
- **Plus/Advanced**: Higher limits available
- **Burst**: Short bursts allowed above sustained rate
- **Measurement**: Leaky bucket algorithm

### Rate Limit Headers
```http
HTTP/1.1 200 OK
X-Shopify-Shop-Api-Call-Limit: 32/40
Retry-After: 2.0
```

### Best Practices
1. **Implement Backoff**: Exponential backoff on 429 errors
2. **Batch Operations**: Use bulk operations when available
3. **Cache Data**: Reduce unnecessary API calls
4. **Monitor Usage**: Track API call consumption

```javascript
// Rate limit handling
async function makeApiCall(query, variables) {
  try {
    const response = await graphql(query, variables);
    return response;
  } catch (error) {
    if (error.status === 429) {
      const retryAfter = error.headers['retry-after'] || 1;
      await sleep(retryAfter * 1000);
      return makeApiCall(query, variables); // Retry
    }
    throw error;
  }
}
```

---

## 6. GraphQL Admin API Deep Dive

### Query Structure
```graphql
query GetProductsWithVariants($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        handle
        title
        status
        vendor
        productType
        tags
        createdAt
        updatedAt
        
        # Nested resource
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
              compareAtPrice
              inventoryQuantity
              sku
              barcode
            }
          }
        }
        
        # Media
        featuredImage {
          url
          altText
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Mutation Patterns
```graphql
mutation ProductCreate($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      handle
      title
    }
    userErrors {
      field
      message
    }
  }
}
```

### Pagination Best Practices
```javascript
async function getAllProducts() {
  let allProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node { id title }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    
    const response = await graphql(query, { 
      first: 50, 
      after: cursor 
    });
    
    allProducts.push(...response.data.products.edges);
    hasNextPage = response.data.products.pageInfo.hasNextPage;
    cursor = response.data.products.pageInfo.endCursor;
  }
  
  return allProducts;
}
```

---

## 7. Common Operations & Patterns

### Product Management
```graphql
# Create product with variants
mutation ProductCreate($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      title
      variants(first: 10) {
        edges {
          node {
            id
            price
            inventoryQuantity
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}

# Update inventory levels
mutation InventoryAdjustQuantity($input: InventoryAdjustQuantityInput!) {
  inventoryAdjustQuantity(input: $input) {
    inventoryLevel {
      id
      available
    }
    userErrors {
      field
      message
    }
  }
}
```

### Order Processing  
```graphql
# Get orders with line items
query GetOrders($first: Int!, $query: String) {
  orders(first: $first, query: $query) {
    edges {
      node {
        id
        name
        email
        createdAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItems(first: 10) {
          edges {
            node {
              id
              title
              quantity
              variant {
                id
                title
              }
            }
          }
        }
      }
    }
  }
}

# Fulfill order
mutation FulfillmentCreate($fulfillment: FulfillmentInput!) {
  fulfillmentCreate(fulfillment: $fulfillment) {
    fulfillment {
      id
      status
      trackingInfo {
        company
        number
        url
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### Collection Management
```graphql
# Create collection with products
mutation CollectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection {
      id
      handle
      title
      productsCount {
        count
      }
    }
    userErrors {
      field
      message
    }
  }
}

# Reorder products in collection
mutation CollectionReorderProducts($id: ID!, $moves: [MoveInput!]!) {
  collectionReorderProducts(id: $id, moves: $moves) {
    job {
      id
      done
    }
    userErrors {
      field
      message
    }
  }
}
```

---

## 8. Bulk Operations

### Why Use Bulk Operations?
- **Efficiency**: Process thousands of records
- **Rate Limits**: Avoid hitting API limits
- **Background Processing**: Asynchronous execution

### Bulk Query Example
```graphql
mutation BulkOperationRunQuery($query: String!) {
  bulkOperationRunQuery(query: $query) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

### Bulk Query Pattern
```javascript
async function runBulkQuery() {
  // Start bulk operation
  const mutation = `
    mutation {
      bulkOperationRunQuery(
        query: """
        {
          products {
            edges {
              node {
                id
                handle
                title
              }
            }
          }
        }
        """
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const result = await graphql(mutation);
  const operationId = result.data.bulkOperationRunQuery.bulkOperation.id;
  
  // Poll for completion
  let completed = false;
  while (!completed) {
    const statusQuery = `
      query {
        currentBulkOperation {
          id
          status
          errorCode
          createdAt
          completedAt
          objectCount
          fileSize
          url
        }
      }
    `;
    
    const status = await graphql(statusQuery);
    const operation = status.data.currentBulkOperation;
    
    if (operation.status === 'COMPLETED') {
      // Download JSONL file from operation.url
      completed = true;
    } else if (operation.status === 'FAILED') {
      throw new Error(`Bulk operation failed: ${operation.errorCode}`);
    }
    
    await sleep(5000); // Wait 5 seconds before next poll
  }
}
```

---

## 9. Webhook Integration

### Webhook Topics
```javascript
// Common webhook topics
const webhookTopics = [
  'orders/create',
  'orders/updated',
  'orders/paid',
  'orders/cancelled',
  'products/create',
  'products/update',
  'inventory_levels/update',
  'app/uninstalled',
  'customers/create',
  'customers/update'
];
```

### Webhook Handler
```javascript
import crypto from 'crypto';

export async function handleWebhook(request) {
  const body = await request.text();
  const signature = request.headers.get('X-Shopify-Hmac-Sha256');
  const topic = request.headers.get('X-Shopify-Topic');
  
  // Verify webhook authenticity
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body)
    .digest('base64');
    
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const data = JSON.parse(body);
  
  // Handle different webhook topics
  switch (topic) {
    case 'orders/create':
      await handleNewOrder(data);
      break;
    case 'products/update':
      await handleProductUpdate(data);
      break;
    case 'inventory_levels/update':
      await handleInventoryUpdate(data);
      break;
  }
  
  return new Response('OK', { status: 200 });
}
```

---

## 10. Error Handling

### GraphQL Error Types
```javascript
// User errors (validation, business logic)
{
  "data": {
    "productCreate": {
      "product": null,
      "userErrors": [
        {
          "field": ["title"],
          "message": "Title can't be blank"
        }
      ]
    }
  }
}

// System errors (network, server issues)
{
  "errors": [
    {
      "message": "Internal server error",
      "locations": [{"line": 2, "column": 3}],
      "path": ["products"]
    }
  ]
}
```

### Error Handling Patterns
```javascript
async function handleApiResponse(response) {
  // Handle GraphQL errors
  if (response.errors) {
    console.error('GraphQL errors:', response.errors);
    throw new Error('API request failed');
  }
  
  // Handle user errors
  const operation = Object.values(response.data)[0];
  if (operation.userErrors?.length > 0) {
    console.warn('User errors:', operation.userErrors);
    return { success: false, errors: operation.userErrors };
  }
  
  return { success: true, data: operation };
}
```

---

## 11. Testing & Development

### GraphQL Explorers
- **Admin API Explorer**: Test admin queries
- **Storefront API Explorer**: Test storefront queries  
- **Partner API Explorer**: Test partner operations

### Development Tools
```javascript
// Using Shopify CLI
shopify app generate schema        # Generate GraphQL schema
shopify app open                  # Open app in browser
shopify app info                  # Show app information

// Environment setup
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret
SHOPIFY_SCOPES=read_products,write_products
SHOPIFY_APP_URL=https://your-app.com
```

### Testing Patterns
```javascript
// Mock API responses for testing
const mockGraphQL = jest.fn();

describe('Product API', () => {
  test('creates product successfully', async () => {
    mockGraphQL.mockResolvedValue({
      data: {
        productCreate: {
          product: { id: 'gid://shopify/Product/123', title: 'Test Product' },
          userErrors: []
        }
      }
    });
    
    const result = await createProduct({ title: 'Test Product' });
    expect(result.success).toBe(true);
    expect(result.data.product.title).toBe('Test Product');
  });
});
```

---

## 12. Performance Optimization

### Query Optimization
```graphql
# Good: Request only needed fields
query GetProducts($first: Int!) {
  products(first: $first) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}

# Avoid: Requesting all fields
query GetProducts($first: Int!) {
  products(first: $first) {
    edges {
      node {
        # Don't request everything unless needed
      }
    }
  }
}
```

### Caching Strategies
```javascript
// In-memory cache
const cache = new Map();

async function getCachedData(key, fetcher, ttl = 300000) {
  const cached = cache.get(key);
  
  if (cached && (Date.now() - cached.timestamp) < ttl) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

// Usage
const products = await getCachedData('products', () => fetchProducts());
```

### Batch Operations
```javascript
// Batch multiple operations
async function batchProductUpdates(updates) {
  const mutations = updates.map(update => ({
    mutation: PRODUCT_UPDATE_MUTATION,
    variables: { input: update }
  }));
  
  // Process in chunks to avoid overwhelming the API
  const chunks = chunkArray(mutations, 10);
  const results = [];
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(({ mutation, variables }) => graphql(mutation, variables))
    );
    results.push(...chunkResults);
    
    // Small delay between batches
    await sleep(100);
  }
  
  return results;
}
```

This comprehensive reference covers the essential aspects of working with Shopify APIs for app development, providing practical patterns and best practices for building robust, scalable applications.