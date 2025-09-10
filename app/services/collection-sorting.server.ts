// COLLECTION SORTING SERVICE
// Handles fetching products from Shopify collections and preparing data for sorting

import type { AdminApiContext } from '@shopify/shopify-app-remix/server';

// TypeScript interfaces for our data structures
export interface ProductVariant {
  id: string;
  inventoryQuantity: number;
  availableForSale: boolean;
}

export interface ProductForSorting {
  id: string;
  title: string;
  handle: string;
  tags: string[];
  variants: ProductVariant[];
  isInStock: boolean;
}

export interface CollectionProducts {
  id: string;
  title: string;
  products: ProductForSorting[];
  totalCount: number;
}

// GraphQL query to fetch collection products with inventory data
const FETCH_COLLECTION_PRODUCTS_QUERY = `
  query getCollectionProducts($collectionId: ID!, $first: Int!, $after: String, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean) {
    collection(id: $collectionId) {
      id
      title
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
            tags
            variants(first: 100) {
              edges {
                node {
                  id
                  inventoryQuantity
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Sort type mapping: UI values to Shopify GraphQL sort keys
// Valid ProductCollectionSortKeys from Shopify Admin GraphQL API:
// BEST_SELLING, COLLECTION_DEFAULT, CREATED, ID, MANUAL, PRICE, RELEVANCE, TITLE
export const SORT_TYPE_MAPPING = {
  'bestsellers asc': { sortKey: 'BEST_SELLING', reverse: false },
  'alpha_asc asc': { sortKey: 'TITLE', reverse: false },
  'alpha_desc desc': { sortKey: 'TITLE', reverse: true },
  'price_desc desc': { sortKey: 'PRICE', reverse: true },
  'price_asc asc': { sortKey: 'PRICE', reverse: false },
  'date_desc desc': { sortKey: 'CREATED', reverse: true },
  'date_asc asc': { sortKey: 'CREATED', reverse: false },
  'manual asc': { sortKey: 'MANUAL', reverse: false },
} as const;

// Map our sort types to Shopify collection sort orders
export const COLLECTION_SORT_ORDER_MAPPING = {
  'bestsellers asc': 'BEST_SELLING',
  'alpha_asc asc': 'ALPHA_ASC', 
  'alpha_desc desc': 'ALPHA_DESC',
  'price_desc desc': 'PRICE_DESC',
  'price_asc asc': 'PRICE_ASC',
  'date_desc desc': 'CREATED_DESC',
  'date_asc asc': 'CREATED',
  'manual asc': 'MANUAL',
} as const;

export type SortTypeValue = keyof typeof SORT_TYPE_MAPPING;

/**
 * Fetches all products from a Shopify collection with inventory data
 * Handles pagination automatically to get all products
 */
export async function fetchCollectionProducts(
  admin: AdminApiContext,
  collectionId: string,
  sortType: SortTypeValue = 'bestsellers asc'
): Promise<CollectionProducts> {
  const allProducts: ProductForSorting[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  // Get sort parameters from mapping
  const sortConfig = SORT_TYPE_MAPPING[sortType] || SORT_TYPE_MAPPING['bestsellers asc'];
  
  console.log(`📦 Fetching products for collection: ${collectionId}`);
  console.log(`🔄 Sort type requested: "${sortType}"`);
  console.log(`🛠️ Sort config: sortKey=${sortConfig.sortKey}, reverse=${sortConfig.reverse}`);
  console.log(`🗺 Available sort types:`, Object.keys(SORT_TYPE_MAPPING));

  while (hasNextPage) {
    try {
      const response = await admin.graphql(FETCH_COLLECTION_PRODUCTS_QUERY, {
        variables: {
          collectionId,
          first: 250, // Max products per request
          after: cursor,
          sortKey: sortConfig.sortKey,
          reverse: sortConfig.reverse,
        },
      });

      const data = await response.json();
      
      if (data.errors) {
        console.error('❌ GraphQL errors:', data.errors);
        console.error('📁 Query variables were:', {
          collectionId,
          first: 250,
          after: cursor,
          sortKey: sortConfig.sortKey,
          reverse: sortConfig.reverse,
        });
        throw new Error(`GraphQL error: ${data.errors[0]?.message}`);
      }

      const collection = data.data?.collection;
      if (!collection) {
        throw new Error(`Collection not found: ${collectionId}`);
      }

      // Process products from this page
      const products = collection.products.edges.map((edge: any) => {
        const product = edge.node;
        
        // Process variants to determine stock status
        const variants: ProductVariant[] = product.variants.edges.map((vEdge: any) => ({
          id: vEdge.node.id,
          inventoryQuantity: vEdge.node.inventoryQuantity || 0,
          availableForSale: vEdge.node.availableForSale || false,
        }));

        // Determine if product is in stock (any variant has inventory > 0)
        const isInStock = variants.some(variant => 
          variant.inventoryQuantity > 0 && variant.availableForSale
        );

        return {
          id: product.id,
          title: product.title,
          handle: product.handle,
          tags: product.tags || [],
          variants,
          isInStock,
        };
      });

      allProducts.push(...products);

      // Update pagination info
      hasNextPage = collection.products.pageInfo.hasNextPage;
      cursor = collection.products.pageInfo.endCursor;

      console.log(`📦 Fetched ${products.length} products (${allProducts.length} total)`);

    } catch (error) {
      console.error('❌ Error fetching collection products:', error);
      throw error;
    }
  }

  console.log(`✅ Successfully fetched ${allProducts.length} products from collection`);

  return {
    id: collectionId,
    title: '', // We'll get this from the first response
    products: allProducts,
    totalCount: allProducts.length,
  };
}

/**
 * Determines if a product should be excluded from out-of-stock sorting
 * based on its tags and the collection's exclusion rules
 */
export function shouldExcludeProduct(
  product: ProductForSorting,
  exclusionTags: string[]
): boolean {
  if (exclusionTags.length === 0) return false;
  
  return product.tags.some(tag => 
    exclusionTags.includes(tag.toLowerCase())
  );
}

/**
 * Sorts products using dual-layer approach:
 * 1. First by stock status (in-stock first, unless excluded by tags)
 * 2. Then by the original collection order (already sorted by best-selling)
 */
export function sortProductsWithInventory(
  products: ProductForSorting[],
  exclusionTags: string[] = []
): { inStock: ProductForSorting[]; outOfStock: ProductForSorting[] } {
  console.log(`🔄 Sorting ${products.length} products with exclusion tags:`, exclusionTags);
  
  const inStock: ProductForSorting[] = [];
  const outOfStock: ProductForSorting[] = [];

  for (const product of products) {
    const isExcluded = shouldExcludeProduct(product, exclusionTags);
    
    if (product.isInStock || isExcluded) {
      // Keep in original position (in-stock products + excluded products)
      inStock.push(product);
    } else {
      // Move to end (out-of-stock products without exclusion tags)
      outOfStock.push(product);
    }
  }

  console.log(`✅ Sorted: ${inStock.length} in-stock/excluded, ${outOfStock.length} out-of-stock`);
  
  return { inStock, outOfStock };
}

// GraphQL mutation to update collection sort order to manual
const UPDATE_COLLECTION_SORT_ORDER_MUTATION = `
  mutation collectionUpdate($input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection {
        id
        sortOrder
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation to reorder products in a collection
const REORDER_COLLECTION_PRODUCTS_MUTATION = `
  mutation collectionReorderProducts($id: ID!, $moves: [MoveInput!]!) {
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
`;

/**
 * Updates collection sort order
 */
async function updateCollectionSortOrder(
  admin: AdminApiContext,
  collectionId: string,
  sortOrder: string = 'MANUAL'
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🔧 Setting collection ${collectionId} to ${sortOrder} sort order`);

    const response = await admin.graphql(UPDATE_COLLECTION_SORT_ORDER_MUTATION, {
      variables: {
        input: {
          id: collectionId,
          sortOrder: sortOrder,
        },
      },
    });

    const data = await response.json();

    if (data.errors) {
      console.error('❌ GraphQL errors updating sort order:', data.errors);
      return { 
        success: false, 
        error: `GraphQL error: ${data.errors[0]?.message}` 
      };
    }

    const result = data.data?.collectionUpdate;
    
    if (result?.userErrors?.length > 0) {
      console.error('❌ User errors updating sort order:', result.userErrors);
      return { 
        success: false, 
        error: `Sort order error: ${result.userErrors[0]?.message}` 
      };
    }

    console.log(`✅ Collection sort order updated to ${sortOrder}`);
    return { success: true };

  } catch (error) {
    console.error('❌ Error updating collection sort order:', error);
    return { 
      success: false, 
      error: `Failed to update sort order: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Reorders products in a Shopify collection using the Admin API
 * Takes the sorted product IDs and applies the new order to the collection
 * Then restores the original sort order
 */
export async function reorderCollectionProducts(
  admin: AdminApiContext,
  collectionId: string,
  sortedProductIds: string[],
  originalSortType: SortTypeValue = 'bestsellers asc'
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    console.log(`🔄 Reordering ${sortedProductIds.length} products in collection ${collectionId}`);

    // First, ensure collection is set to manual sort order
    const sortOrderResult = await updateCollectionSortOrder(admin, collectionId);
    if (!sortOrderResult.success) {
      return { 
        success: false, 
        error: sortOrderResult.error 
      };
    }

    // Build moves array - each product moves to its new position
    const moves = sortedProductIds.map((productId, newIndex) => ({
      id: productId,
      newPosition: `${newIndex}`, // Shopify expects string position
    }));

    console.log(`📋 Generated ${moves.length} move operations`);

    const response = await admin.graphql(REORDER_COLLECTION_PRODUCTS_MUTATION, {
      variables: {
        id: collectionId,
        moves: moves,
      },
    });

    const data = await response.json();

    if (data.errors) {
      console.error('❌ GraphQL errors during reorder:', data.errors);
      return { 
        success: false, 
        error: `GraphQL error: ${data.errors[0]?.message}` 
      };
    }

    const result = data.data?.collectionReorderProducts;
    
    if (result?.userErrors?.length > 0) {
      console.error('❌ User errors during reorder:', result.userErrors);
      return { 
        success: false, 
        error: `Reorder error: ${result.userErrors[0]?.message}` 
      };
    }

    const jobId = result?.job?.id;
    const jobDone = result?.job?.done;

    console.log(`✅ Collection reorder initiated:`, { jobId, jobDone });

    // Now restore the original collection sort order
    // Only restore if it's not manual (manual should stay manual)
    if (originalSortType !== 'manual asc') {
      const originalSortOrder = COLLECTION_SORT_ORDER_MAPPING[originalSortType];
      console.log(`🔄 Restoring collection sort order to: ${originalSortOrder}`);
      
      const restoreResult = await updateCollectionSortOrder(admin, collectionId, originalSortOrder);
      if (!restoreResult.success) {
        console.warn('⚠️ Failed to restore collection sort order:', restoreResult.error);
        // Don't fail the whole operation, just log the warning
      } else {
        console.log(`✅ Collection sort order restored to ${originalSortOrder}`);
      }
    }

    return { 
      success: true, 
      jobId: jobId || undefined 
    };

  } catch (error) {
    console.error('❌ Error reordering collection products:', error);
    return { 
      success: false, 
      error: `Failed to reorder: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}