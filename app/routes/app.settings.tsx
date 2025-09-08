// GLOBAL SETTINGS CONFIGURATION PAGE
// This page handles app-wide settings that apply across all enabled collections
// Separated from the main collections page to keep UX clean and focused

// REMIX FRAMEWORK IMPORTS
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

// REACT IMPORTS
import { useState } from "react";

// SHOPIFY POLARIS UI COMPONENTS
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Tag,
  Button,
  Checkbox,
  Icon,
  Tooltip,
} from "@shopify/polaris";

// SHOPIFY POLARIS ICONS
import { InfoIcon } from "@shopify/polaris-icons";

// SHOPIFY APP BRIDGE COMPONENTS
import { TitleBar } from "@shopify/app-bridge-react";

// SHOPIFY AUTHENTICATION
import { authenticate } from "../shopify.server";

// CUSTOM COMPONENTS
import { TagAutocomplete } from "../components/TagAutocomplete";

// SERVER-SIDE DATA LOADER
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  // FETCH ALL PRODUCT TAGS FROM SHOPIFY
  // Get all unique tags used across all products for autocomplete suggestions
  const tagsResponse = await admin.graphql(`
    #graphql
    query GetProductTags($first: Int!) {
      products(first: $first) {
        edges {
          node {
            tags  # Array of tag strings (e.g., ["sale", "featured", "preorder"])
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `, {
    variables: { first: 250 }  // Fetch from first 250 products (most stores don't need more for tag discovery)
  });

  // Extract and flatten all unique tags from all products
  const tagsData = await tagsResponse.json();
  const allTags = tagsData.data?.products?.edges?.reduce((tags: string[], edge: any) => {
    const productTags = edge.node.tags || [];
    productTags.forEach((tag: string) => {
      if (!tags.includes(tag.toLowerCase())) {
        tags.push(tag.toLowerCase());
      }
    });
    return tags;
  }, []) || [];
  
  // Sort tags alphabetically for better UX
  const sortedTags = allTags.sort();
  
  // TODO: Load global settings from database
  // For now, return empty settings
  return json({
    globalExclusionTags: [], // Global tags that apply to all collections
    excludeContinueSellingProducts: true, // Exclude products with "continue selling when out of stock"
    availableTags: sortedTags, // All unique product tags for autocomplete
    shop: session.shop,
  });
};

// SERVER-SIDE FORM HANDLER
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // TODO: Handle saving global settings to database
  
  return json({ success: true });
};

// MAIN REACT COMPONENT
export default function Settings() {
  // GET DATA FROM SERVER
  const { globalExclusionTags, excludeContinueSellingProducts, availableTags, shop } = useLoaderData<typeof loader>();
  
  // COMPONENT STATE MANAGEMENT
  // Global exclusion tags that apply to all enabled collections
  const [exclusionTags, setExclusionTags] = useState<string[]>(globalExclusionTags || []);
  
  
  // Whether to exclude products with "continue selling when out of stock" enabled
  const [excludeContinueSelling, setExcludeContinueSelling] = useState<boolean>(excludeContinueSellingProducts);
  
  // Whether to exclude draft products from sorting
  const [excludeDraftProducts, setExcludeDraftProducts] = useState<boolean>(true);

  // EVENT HANDLERS
  
  // Add new exclusion tag
  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !exclusionTags.includes(normalizedTag)) {
      setExclusionTags(prev => [...prev, normalizedTag]);
    }
  };

  // Remove exclusion tag
  const handleRemoveTag = (tagToRemove: string) => {
    setExclusionTags(prev => prev.filter(tag => tag !== tagToRemove));
  };


  return (
    <Page>
      <TitleBar title="Global Settings" />
      <Layout>
        <Layout.Section>
          {/* GLOBAL EXCLUSION TAGS SECTION */}
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" align="start">
                <Text as="h2" variant="headingMd">
                  Global Exclusion Tags
                </Text>
                <Tooltip content="Tags that apply to all collections. Products with these tags won't be pushed down when out of stock.">
                  <Icon source={InfoIcon} tone="subdued" />
                </Tooltip>
              </InlineStack>

              <TagAutocomplete
                availableTags={availableTags}
                selectedTags={exclusionTags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                placeholder="Add global exclusion tag (e.g., preorder, coming-soon)"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {/* ADDITIONAL OPTIONS */}
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" align="start">
                <Text as="h2" variant="headingMd">
                  Additional Options
                </Text>
              </InlineStack>

              <Checkbox
                label='Exclude "Continue selling when out of stock" products'
                checked={excludeContinueSelling}
                onChange={setExcludeContinueSelling}
                helpText={
                  <InlineStack gap="100" align="start">
                    <Text as="span" variant="bodySm">
                      Products with this Shopify setting stay in position when out of stock
                    </Text>
                    <Tooltip content="Products set to 'Continue selling when out of stock' are typically intended for backorder/dropship, so they maintain their sorted position even at zero inventory.">
                      <Icon source={InfoIcon} tone="subdued" />
                    </Tooltip>
                  </InlineStack>
                }
              />
              
              <Checkbox
                label="Exclude draft products from sorting"
                checked={excludeDraftProducts}
                onChange={setExcludeDraftProducts}
                helpText={
                  <InlineStack gap="100" align="start">
                    <Text as="span" variant="bodySm">
                      Draft products maintain their position regardless of stock status
                    </Text>
                    <Tooltip content="Draft products are typically being prepared for launch and should not be affected by automatic sorting based on inventory levels.">
                      <Icon source={InfoIcon} tone="subdued" />
                    </Tooltip>
                  </InlineStack>
                }
              />

              <InlineStack gap="300" align="start">
                <Button variant="primary">
                  Save Settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}