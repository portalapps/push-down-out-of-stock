// COLLECTIONS CONFIGURATION PAGE
// Modern Polaris-based interface for managing collection sorting

// REMIX FRAMEWORK IMPORTS
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { useLoaderData, useFetcher } from "@remix-run/react";

// REACT IMPORTS
import { useState, useCallback } from "react";
import React from "react";

// SHOPIFY POLARIS UI COMPONENTS
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  ButtonGroup,
  useIndexResourceState,
  Select,
  BlockStack,
  InlineStack,
  Toast,
  Frame,
  IndexFilters,
  useSetIndexFiltersMode,
  ChoiceList,
  Banner,
  Tooltip,
  Icon,
  Spinner,
} from "@shopify/polaris";
import { InfoIcon, CheckIcon, AlertTriangleIcon } from "@shopify/polaris-icons";

// COMPONENTS
import { TagAutocomplete } from "../components/TagAutocomplete";

// SHOPIFY APP BRIDGE
import { TitleBar } from "@shopify/app-bridge-react";

// SHOPIFY AUTHENTICATION AND DATABASE
import { authenticate } from "../shopify.server";
import db from "../db.server";

// SUPERVISOR PATTERN
import { useSupervisor } from "../hooks/useSupervisor";
import type { CollectionState } from "../utils/supervisor.client";

// SERVER-SIDE DATA LOADER
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    // FETCH COLLECTIONS WITH LIMITED PRODUCTS AND THEIR TAGS
    const [collectionsResponse, tagsResponse] = await Promise.all([
      admin.graphql(`
        #graphql
        query GetCollections($first: Int!, $productsFirst: Int!) {
          collections(first: $first) {
            edges {
              node {
                id
                title
                productsCount {
                  count
                }
                products(first: $productsFirst) {
                  edges {
                    node {
                      id
                      tags
                    }
                  }
                }
              }
            }
          }
        }
      `, {
        variables: { 
          first: 50,        // Reduced from 250 to 50 collections
          productsFirst: 10  // Reduced from 50 to 10 products per collection
        }
      }),
    admin.graphql(`
      #graphql
      query GetProductTags($first: Int!) {
        productTags(first: $first) {
          edges {
            node
          }
        }
      }
    `, {
      variables: { first: 1000 }
    })
  ]);

  const [collectionsData, tagsData] = await Promise.all([
    collectionsResponse.json(),
    tagsResponse.json()
  ]);
  
  const collections = collectionsData.data?.collections?.edges?.map((edge: any) => {
    const collection = edge.node;
    // Extract all unique tags from products in this collection
    const productTags = new Set<string>();
    collection.products?.edges?.forEach((productEdge: any) => {
      const tags = productEdge.node.tags || [];
      tags.forEach((tag: string) => productTags.add(tag));
    });
    
    return {
      ...collection,
      productTags: Array.from(productTags)
    };
  }) || [];
  
  const productTags = tagsData.data?.productTags?.edges?.map((edge: any) => edge.node) || [];

    // FETCH EXISTING COLLECTION SETTINGS FROM DATABASE
    const existingSettings = await db.collectionSetting.findMany({
      where: {
        shop: session.shop,
      },
    });
    console.log('Loader - Found collection settings:', existingSettings);
    
    // FETCH EXISTING EXCLUSION TAGS FROM DATABASE (per collection)
    const existingTags = await db.exclusionTag.findMany({
      where: {
        shop: session.shop,
      },
    });
    console.log('Loader - Found exclusion tags:', existingTags);

    return json({
      collections,
      productTags,
      shop: session.shop,
      existingSettings,
      existingTags,
    });
  } catch (error) {
    console.error('Error loading collections data:', error);
    
    // Return empty data on error to prevent app crash
    return json({
      collections: [],
      productTags: [],
      shop: '',
      existingSettings: [],
      existingTags: [],
      error: 'Failed to load collections data. Please try again.',
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('ACTION HANDLER CALLED - Method:', request.method);
  console.log('🕵️ ACTION HANDLER - Request URL:', request.url);
  console.log('🕵️ ACTION HANDLER - Request headers:', Object.fromEntries(request.headers));
  
  const { admin, session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  console.log('ACTION HANDLER - FormData received:', Object.fromEntries(formData));
  
  // Add stack trace to see what's calling this
  console.log('🔍 ACTION HANDLER - Stack trace:');
  console.trace('Called from:');
  
  const action = formData.get('action')?.toString();
  
  if (action === 'sortCollection') {
    try {
      const collectionId = formData.get('collectionId')?.toString();
      
      if (!collectionId) {
        return json({ success: false, error: 'Collection ID is required' });
      }

      console.log('🔄 Starting collection sort for:', collectionId);

      // Get collection settings from database to determine sort type
      const collectionSetting = await db.collectionSetting.findFirst({
        where: {
          shop: session.shop,
          collectionId: collectionId,
        },
        select: {
          sortType: true,
        },
      });

      const sortType = (collectionSetting?.sortType || 'bestsellers asc') as keyof typeof SORT_TYPE_MAPPING;
      console.log('🔄 Using sort type:', sortType);

      // Import our sorting service
      const { fetchCollectionProducts, sortProductsWithInventory, reorderCollectionProducts, SORT_TYPE_MAPPING } = await import('../services/collection-sorting.server');

      // Fetch collection products with inventory data using the specified sort type
      const collectionData = await fetchCollectionProducts(admin, collectionId, sortType);

      // Get exclusion tags for this collection from database
      const exclusionTags = await db.exclusionTag.findMany({
        where: {
          shop: session.shop,
          collectionId: collectionId,
        },
        select: {
          tag: true,
        },
      });

      const exclusionTagList = exclusionTags.map(et => et.tag.toLowerCase());
      console.log('🏷️ Debug exclusion tags:', { 
        collectionId, 
        exclusionTagsFromDB: exclusionTags,
        processedTagList: exclusionTagList 
      });

      // Sort products using our dual-layer algorithm
      const { inStock, outOfStock } = sortProductsWithInventory(
        collectionData.products,
        exclusionTagList
      );

      // Combine sorted arrays (in-stock first, then out-of-stock)
      const sortedProductIds = [
        ...inStock.map(p => p.id),
        ...outOfStock.map(p => p.id),
      ];

      console.log('📋 Sorted product order:', { 
        totalProducts: sortedProductIds.length,
        inStockCount: inStock.length,
        outOfStockCount: outOfStock.length 
      });
      
      // Debug: log the actual order being sent to Shopify
      console.log('🎯 IN-STOCK products (staying at top):', inStock.map(p => p.title));
      console.log('❌ OUT-OF-STOCK products (moving to bottom):', outOfStock.map(p => p.title));
      console.log('📋 Final product order (top to bottom):', [
        ...inStock.map(p => p.title),
        ...outOfStock.map(p => p.title)
      ]);

      // Apply the new order to the collection via Shopify API
      const reorderResult = await reorderCollectionProducts(
        admin,
        collectionId,
        sortedProductIds,
        sortType // Pass the sort type so it can be restored after reordering
      );

      if (!reorderResult.success) {
        console.error('❌ Failed to reorder collection:', reorderResult.error);
        return json({ 
          success: false, 
          error: `Failed to reorder collection: ${reorderResult.error}` 
        });
      }

      console.log('✅ Collection successfully reordered in Shopify');

      return json({ 
        success: true, 
        message: 'Collection sorted and reordered successfully',
        stats: {
          totalProducts: sortedProductIds.length,
          inStockCount: inStock.length,
          outOfStockCount: outOfStock.length,
        }
      });

    } catch (error) {
      console.error('❌ Error sorting collection:', error);
      return json({ 
        success: false, 
        error: `Failed to sort collection: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }
  
  if (action === 'updateSetting') {
    try {
      const collectionId = formData.get('collectionId')?.toString();
      const enabled = formData.get('enabled')?.toString() === 'true';
      const sortType = formData.get('sortType')?.toString();
      const exclusionTagsStr = formData.get('exclusionTags')?.toString();
      const exclusionTags = exclusionTagsStr ? JSON.parse(exclusionTagsStr) : [];
      const operationTagStr = formData.get('operationTag')?.toString();
      const operationTag = operationTagStr ? JSON.parse(operationTagStr) : null;
      
      console.log('📥 SUPERVISOR updateSetting received:', { collectionId, enabled, sortType, exclusionTags, operationTag });
      
      // Upsert collection setting (create or update)
      await db.collectionSetting.upsert({
        where: {
          shop_collectionId: {
            shop: session.shop,
            collectionId: collectionId,
          },
        },
        update: {
          enabled,
          sortType,
          updatedAt: new Date(),
        },
        create: {
          shop: session.shop,
          collectionId,
          enabled,
          sortType,
        },
      });
      
      // Handle exclusion tags separately if provided
      if (exclusionTags !== undefined) {
        // First, delete existing tags for this shop/collection
        await db.exclusionTag.deleteMany({
          where: {
            shop: session.shop,
            collectionId: collectionId,
          },
        });
        
        // Then create new tags for this specific collection
        if (exclusionTags.length > 0) {
          // Create each tag individually to handle duplicates properly with SQLite
          for (const tag of exclusionTags) {
            try {
              await db.exclusionTag.create({
                data: {
                  shop: session.shop,
                  collectionId: collectionId,
                  tag,
                },
              });
            } catch (error: any) {
              // Ignore duplicate errors (unique constraint violations)
              if (error.code !== 'P2002') {
                throw error;
              }
            }
          }
        }
      }
      
      console.log('✅ SUPERVISOR updateSetting completed successfully:', { collectionId, enabled, sortType });
      
      // If enabled, trigger auto-sort and return after sort completion
      if (enabled) {
        console.log('🎯 SUPERVISOR triggering auto-sort after settings save:', collectionId);
        
        // Import sorting service
        const { fetchCollectionProducts, sortProductsWithInventory, reorderCollectionProducts, SORT_TYPE_MAPPING } = await import('../services/collection-sorting.server');
        
        // Perform sort operation
        const collectionData = await fetchCollectionProducts(admin, collectionId, sortType as keyof typeof SORT_TYPE_MAPPING);
        const exclusionTagList = exclusionTags.map((tag: string) => tag.toLowerCase());
        const { inStock, outOfStock } = sortProductsWithInventory(collectionData.products, exclusionTagList);
        const sortedProductIds = [...inStock.map(p => p.id), ...outOfStock.map(p => p.id)];
        const reorderResult = await reorderCollectionProducts(admin, collectionId, sortedProductIds, sortType);
        
        if (!reorderResult.success) {
          console.error('❌ SUPERVISOR auto-sort failed:', reorderResult.error);
          return json({ 
            success: false, 
            error: `Settings saved but sort failed: ${reorderResult.error}`,
            operationTag 
          });
        }
        
        console.log('✅ SUPERVISOR auto-sort completed successfully:', collectionId);
      }
      
      return json({ 
        success: true, 
        operationTag,
        message: enabled ? 'Settings saved and collection sorted' : 'Settings saved'
      });
    } catch (error) {
      console.error('❌ SUPERVISOR Error saving collection setting:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      return json({ 
        success: false, 
        error: `Failed to save setting: ${error instanceof Error ? error.message : String(error)}`,
        operationTag 
      });
    }
  }
  
  return json({ success: false, error: 'Invalid action' });
};

export default function Collections() {
  console.log('🏗️ SUPERVISOR Collections component rendering - STEP 1');
  const { collections, productTags, error, existingSettings, existingTags } = useLoaderData<typeof loader>();
  console.log('🏗️ SUPERVISOR Collections component rendering - STEP 2', { collectionsLength: collections?.length });
  
  // SUPERVISOR PATTERN - replaces all complex state management
  const {
    uiState: collectionSettings,
    implementedState,
    operationStatus,
    updateCollectionState,
    retryOperation,
    runSupervisor
  } = useSupervisor(collections, existingSettings);
  
  // UI-only states (no business logic)
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const [sortValue, setSortValue] = useState('bestsellers');
  
  // SUPERVISOR handles all timeout and state cleanup automatically
  
  console.log('🏗️ SUPERVISOR Component state:', { 
    collectionsCount: collections?.length,
    uiStateKeys: Object.keys(collectionSettings),
    implementedStateKeys: Object.keys(implementedState),
    operationStatusKeys: Object.keys(operationStatus)
  });
  
  // SUPERVISOR handles all fetcher response processing automatically
  // Toast messages for user feedback
  React.useEffect(() => {
    Object.entries(operationStatus).forEach(([collectionId, status]) => {
      if (status.status === 'ready') {
        const isEnabled = collectionSettings[collectionId]?.enabled;
        if (isEnabled) {
          setToastMessage(`Collection ${collectionId} sorted and ready!`);
        } else {
          setToastMessage(`Collection ${collectionId} settings saved!`);
        }
      } else if (status.status === 'error') {
        setToastMessage(`Operation failed for collection ${collectionId}: ${status.lastError || 'Unknown error'}`);
      }
    });
  }, [operationStatus, collectionSettings]);
  
  // Early return for debugging (moved after state declarations)
  if (!collections || collections.length === 0) {
    return (
      <Page title="Collections" subtitle="Loading collections...">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Text variant="bodyMd">Loading collections or no collections found.</Text>
              <Text variant="bodyMd">Collections: {collections?.length || 0}</Text>
              <Text variant="bodyMd">Error: {error || 'None'}</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  // FILTERS STATE for IndexFilters
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  
  // IndexFilters mode
  const { mode, setMode } = useSetIndexFiltersMode();
  
  // Initialize available tags from loader data
  React.useEffect(() => {
    if (productTags && Array.isArray(productTags)) {
      console.log('📝 SUPERVISOR Setting available tags:', productTags.slice(0, 5), '...');
      setAvailableTags(productTags);
    }
  }, [productTags]);
  
  // SUPERVISOR handles all settings initialization automatically


  // FILTER AND SORT COLLECTIONS
  const enabledCollections = collections.filter((collection: any) => 
    collectionSettings[collection.id]?.enabled
  );

  // INDEXFILTERS CONFIGURATION (defined after enabledCollections for counts)
  const tabs = [
    {
      content: `All (${collections.length})`,
      index: 0,
      onAction: () => handleTabChange(0),
      id: 'all-collections-1',
    },
    {
      content: `Push down enabled (${enabledCollections.length})`,
      index: 1,
      onAction: () => handleTabChange(1),
      id: 'enabled-collections-2',
    },
  ];

  const filteredCollections = selectedTab === 0 ? collections : enabledCollections;

  // SEARCH AND TAG FILTER FUNCTIONALITY
  const searchedCollections = filteredCollections.filter((collection: any) => {
    const matchesSearch = collection.title.toLowerCase().includes(queryValue.toLowerCase());
    
    // Filter collections based on whether any of their products contain the selected tag
    const matchesTagFilter = tagFilter.length === 0 || 
      (collection.productTags || []).some((tag: string) => tagFilter.includes(tag));
    
    return matchesSearch && matchesTagFilter;
  });

  // SORT FUNCTIONALITY
  const sortedCollections = React.useMemo(() => {
    const sorted = [...searchedCollections].sort((a, b) => {
      switch (sortValue) {
        case 'name_asc':
          return a.title.localeCompare(b.title);
        case 'name_desc':
          return b.title.localeCompare(a.title);
        case 'products_asc':
          return (a.productsCount?.count || 0) - (b.productsCount?.count || 0);
        case 'products_desc':
          return (b.productsCount?.count || 0) - (a.productsCount?.count || 0);
        case 'status_enabled':
          const aEnabled = collectionSettings[a.id]?.enabled || false;
          const bEnabled = collectionSettings[b.id]?.enabled || false;
          return bEnabled === aEnabled ? 0 : bEnabled ? 1 : -1;
        case 'status_disabled':
          const aDisabled = !collectionSettings[a.id]?.enabled;
          const bDisabled = !collectionSettings[b.id]?.enabled;
          return bDisabled === aDisabled ? 0 : bDisabled ? 1 : -1;
        default:
          return 0;
      }
    });
    return sorted;
  }, [searchedCollections, sortValue, collectionSettings]);

  // INDEX TABLE SETUP
  const resourceIDResolver = (collection: any) => collection.id;

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(sortedCollections, { resourceIDResolver });


  // SUPERVISOR-BASED EVENT HANDLERS (Simple and Clean)
  const handleStatusToggle = useCallback((collectionId: string) => {
    const currentEnabled = collectionSettings[collectionId]?.enabled;
    const newEnabled = !currentEnabled;
    
    console.log('🔄 SUPERVISOR handleStatusToggle:', { collectionId, currentEnabled, newEnabled });
    
    // Update UI state - supervisor will handle the rest
    updateCollectionState(collectionId, { enabled: newEnabled });
  }, [collectionSettings, updateCollectionState]);

  const handleSortTypeChange = useCallback((collectionId: string, sortType: string) => {
    // Skip if collection is disabled
    if (!collectionSettings[collectionId]?.enabled) {
      console.log('❌ SUPERVISOR - collection disabled, ignoring sort change:', collectionId);
      return;
    }
    
    console.log('🔄 SUPERVISOR handleSortTypeChange:', { collectionId, sortType });
    
    // Update UI state - supervisor will handle the rest
    updateCollectionState(collectionId, { sortType });
  }, [collectionSettings, updateCollectionState]);

  const handleBulkEnable = useCallback(() => {
    console.log('🔄 SUPERVISOR handleBulkEnable:', selectedResources);
    selectedResources.forEach(id => {
      updateCollectionState(id, { enabled: true });
    });
  }, [selectedResources, updateCollectionState]);

  const handleBulkDisable = useCallback(() => {
    console.log('🔄 SUPERVISOR handleBulkDisable:', selectedResources);
    selectedResources.forEach(id => {
      updateCollectionState(id, { enabled: false });
    });
  }, [selectedResources, updateCollectionState]);

  // TAG MANAGEMENT (Supervisor-based)
  const handleTagAdd = useCallback((collectionId: string, tag: string) => {
    const currentTags = collectionSettings[collectionId]?.exclusionTags || [];
    const newTags = [...currentTags, tag];
    
    console.log('🔄 SUPERVISOR handleTagAdd:', { collectionId, tag, newTags });
    
    // Update UI state - supervisor will handle the rest
    updateCollectionState(collectionId, { exclusionTags: newTags });
  }, [collectionSettings, updateCollectionState]);

  const handleTagRemove = useCallback((collectionId: string, tag: string) => {
    const currentTags = collectionSettings[collectionId]?.exclusionTags || [];
    const newTags = currentTags.filter(t => t !== tag);
    
    console.log('🔄 SUPERVISOR handleTagRemove:', { collectionId, tag, newTags });
    
    // Update UI state - supervisor will handle the rest
    updateCollectionState(collectionId, { exclusionTags: newTags });
  }, [collectionSettings, updateCollectionState]);




  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
  }, []);

  const handleTabChange = useCallback((tabIndex: number) => {
    setSelectedTab(tabIndex);
  }, []);

  const sortOptions = [
    { label: 'Best Selling', value: 'bestsellers asc' },
    { label: 'Product Title A-Z', value: 'alpha_asc asc' },
    { label: 'Product Title Z-A', value: 'alpha_desc desc' },
    { label: 'Highest Price', value: 'price_desc desc' },
    { label: 'Lowest Price', value: 'price_asc asc' },
    { label: 'Newest', value: 'date_desc desc' },
    { label: 'Oldest', value: 'date_asc asc' },
    { label: 'Manually', value: 'manual asc' },
  ];

  const filters = [
    {
      key: 'tagFilter',
      label: 'Tagged with',
      filter: (
        <ChoiceList
          title="Tagged with"
          titleHidden
          choices={availableTags.map(tag => ({ label: tag, value: tag }))}
          selected={tagFilter}
          onChange={setTagFilter}
          allowMultiple
        />
      ),
      shortcut: true,
      pinned: true,
    },
  ];

  // FILTER HANDLERS
  const handleFiltersQueryChange = useCallback((value: string) => {
    setQueryValue(value);
  }, []);

  const handleQueryValueRemove = useCallback(() => {
    setQueryValue('');
  }, []);

  const handleFiltersClearAll = useCallback(() => {
    setQueryValue('');
    setSortValue('bestsellers');
    setSelectedTab(0);
    setTagFilter([]);
  }, []);

  const handleSortSelect = useCallback((sortValue: string) => {
    setSortValue(sortValue.split(' ')[0]);
  }, []);

  const handleSearchCancel = useCallback(() => {
    // Clear all search parameters and return to default view
    setQueryValue('');
    setSortValue('bestsellers');
    setSelectedTab(0);
    setTagFilter([]);
    if (setMode) {
      setMode('DEFAULT');
    }
  }, [setMode]);

  // Applied filters for native clear functionality
  const appliedFilters = tagFilter.map((tag) => ({
    key: `tagFilter-${tag}`,
    label: `Tagged with: ${tag}`,
    onRemove: () => {
      setTagFilter(prev => prev.filter(t => t !== tag));
    },
  }));

  // Handle clearing all filters (for native clear button)
  const handleClearAllFilters = useCallback(() => {
    setTagFilter([]);
  }, []);


  // BULK ACTIONS
  const promotedBulkActions = selectedResources.length > 0 ? [
    {
      content: 'Enable push down',
      onAction: handleBulkEnable,
    },
    {
      content: 'Disable push down',
      onAction: handleBulkDisable,
    },
  ] : [];

  // ROW MARKUP
  const rowMarkup = sortedCollections.map((collection: any, index: number) => {
    const { id, title, productsCount } = collection;
    const settings = collectionSettings[id];
    const isEnabled = settings?.enabled || false;
    const sortType = settings?.sortType || 'bestsellers';
    const exclusionTags = settings?.exclusionTags || [];

    return (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
        onClick={(e) => {
          console.log('📋 IndexTable.Row clicked for collection:', id, title);
          console.log('📋 Event target:', e?.target);
          console.log('📋 Event currentTarget:', e?.currentTarget);
          console.log('📋 Target tagName:', e?.target?.tagName);
          console.log('📋 Target textContent:', e?.target?.textContent);
          console.log('📋 Target className:', e?.target?.className);
        }}
      >
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight="semibold" as="span">
              <span style={{
                wordWrap: 'break-word',
                wordBreak: 'break-word',
                hyphens: 'auto',
                display: 'block',
                lineHeight: '1.3'
              }}>
                {title}
              </span>
            </Text>
            <Text variant="bodySm" tone="subdued" as="span">
              {productsCount?.count || 0} products
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Tooltip content={isEnabled ? 'Click to disable' : 'Click to enable'}>
            <button 
              type="button"
              onClick={(e) => {
                console.log('🖱️ Badge BUTTON clicked for collection:', id, title);
                e.stopPropagation();
                handleStatusToggle(id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                fontSize: 'inherit'
              }}
            >
              <Badge tone={isEnabled ? 'success' : 'critical'}>
                {isEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </button>
          </Tooltip>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              label="Sort type"
              labelHidden
              options={sortOptions}
              value={sortType}
              onChange={(value) => handleSortTypeChange(id, value)}
              disabled={!isEnabled}
            />
          </div>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <div onClick={(e) => e.stopPropagation()}>
            <TagAutocomplete
              availableTags={availableTags}
              selectedTags={settings?.exclusionTags || []}
              onAddTag={(tag: string) => handleTagAdd(id, tag)}
              onRemoveTag={(tag: string) => handleTagRemove(id, tag)}
              placeholder="Add exclusion tag"
              label="Exclusion tags"
              labelHidden={true}
              disabled={!isEnabled}
            />
          </div>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <div style={{ textAlign: 'center' }}>
            {operationStatus[id]?.status === 'processing' && (
              <Spinner size="small" />
            )}
            {operationStatus[id]?.status === 'ready' && (
              <Icon source={CheckIcon} tone="success" />
            )}
            {(operationStatus[id]?.status === 'error' || operationStatus[id]?.status === 'retry') && (
              <button 
                onClick={() => retryOperation(id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <Icon source={AlertTriangleIcon} tone="critical" />
              </button>
            )}
          </div>
        </IndexTable.Cell>

      </IndexTable.Row>
    );
  });

  const pageMarkup = (
    <Page
      title="Collections"
      subtitle="Manage push down out of stock sorting for your collections"
      backAction={{content: 'Settings', url: '/app/settings'}}
    >
      <TitleBar title="Collections" />
      <style>{`
        .Polaris-IndexTable__Table {
          table-layout: fixed !important;
          width: 100% !important;
        }
        .Polaris-IndexTable__Table th:nth-child(1),
        .Polaris-IndexTable__Table td:nth-child(1) {
          width: 50px !important;
          max-width: 50px !important;
          min-width: 50px !important;
        }
        .Polaris-IndexTable__Table th:nth-child(2),
        .Polaris-IndexTable__Table td:nth-child(2) {
          width: auto !important;
        }
        .Polaris-IndexTable__Table th:nth-child(3),
        .Polaris-IndexTable__Table td:nth-child(3) {
          width: 100px !important;
          max-width: 100px !important;
          min-width: 100px !important;
        }
        .Polaris-IndexTable__Table th:nth-child(4),
        .Polaris-IndexTable__Table td:nth-child(4) {
          width: 160px !important;
          max-width: 160px !important;
          min-width: 160px !important;
        }
        .Polaris-IndexTable__Table th:nth-child(5),
        .Polaris-IndexTable__Table td:nth-child(5) {
          width: 150px !important;
          max-width: 150px !important;
          min-width: 150px !important;
        }
        .Polaris-IndexTable__Table th:nth-child(6),
        .Polaris-IndexTable__Table td:nth-child(6) {
          width: 60px !important;
          max-width: 60px !important;
          min-width: 60px !important;
          text-align: center !important;
        }
      `}</style>
      
      <Layout>
        <Layout.Section>
          {error && (
            <Banner tone="critical" title="Error loading data">
              <p>{error}</p>
            </Banner>
          )}
          <Card padding="0">
            <IndexFilters
              tabs={tabs}
              selected={selectedTab}
              onSelect={handleTabChange}
              sortOptions={sortOptions}
              sortSelected={[`${sortValue} asc`]}
              onSort={handleSortSelect}
              filters={filters}
              appliedFilters={appliedFilters}
              onClearAllFilters={handleClearAllFilters}
              queryValue={queryValue}
              queryPlaceholder="Search collections"
              onQueryChange={handleFiltersQueryChange}
              onQueryClear={handleSearchCancel}
              onClearAll={handleFiltersClearAll}
              cancelAction={{
                onAction: handleSearchCancel,
                disabled: false,
                loading: false,
              }}
              canCreateNewView={false}
              mode={mode}
              setMode={setMode}
            />
            
            
            <IndexTable
              resourceName={{
                singular: 'collection',
                plural: 'collections',
              }}
              itemCount={sortedCollections.length}
              selectedItemsCount={
                allResourcesSelected ? 'All' : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              promotedBulkActions={promotedBulkActions}
              headings={[
                { title: 'Collection' },
                { 
                  title: (
                    <InlineStack gap="100" align="start">
                      <Text as="span" variant="headingSm">Status</Text>
                      <Tooltip content="Enable or disable automatic out-of-stock sorting for this collection">
                        <Icon source={InfoIcon} tone="base" />
                      </Tooltip>
                    </InlineStack>
                  ),
                  width: '100px'
                },
                { 
                  title: (
                    <InlineStack gap="100" align="start">
                      <Text as="span" variant="headingSm">Sort Type</Text>
                      <Tooltip content="Choose how products should be sorted within in-stock and out-of-stock groups">
                        <Icon source={InfoIcon} tone="base" />
                      </Tooltip>
                    </InlineStack>
                  ),
                  width: '160px'
                },
                { 
                  title: (
                    <InlineStack gap="100" align="start">
                      <Text as="span" variant="headingSm">Exclusion Tags</Text>
                      <Tooltip content="Products with these tags won't be moved to bottom even when out of stock">
                        <Icon source={InfoIcon} tone="base" />
                      </Tooltip>
                    </InlineStack>
                  ), 
                  width: '150px' 
                },
                { title: '', width: '60px' },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );

  return (
    <Frame>
      {pageMarkup}
      {toastMessage && (
        <Toast
          content={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </Frame>
  );
}