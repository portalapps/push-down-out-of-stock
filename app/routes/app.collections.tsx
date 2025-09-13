// COLLECTIONS CONFIGURATION PAGE
// Modern Polaris-based interface for managing collection sorting

// REMIX FRAMEWORK IMPORTS
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { useLoaderData } from "@remix-run/react";

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
          first: 50,
          productsFirst: 10
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
    const productTags = new Set<string>();
    collection.products?.edges?.forEach((productEdge: any) => {
      (productEdge.node.tags || []).forEach((tag: string) => productTags.add(tag));
    });
    
    return {
      ...collection,
      productTags: Array.from(productTags)
    };
  }) || [];
  
  const productTags = tagsData.data?.productTags?.edges?.map((edge: any) => edge.node) || [];

    const existingSettings = await db.collectionSetting.findMany({
      where: { shop: session.shop },
    });

    return json({
      collections,
      productTags,
      shop: session.shop,
      existingSettings,
    });
  } catch (error) {
    console.error('Error loading collections data:', error);
    return json({
      collections: [],
      productTags: [],
      shop: '',
      existingSettings: [],
      error: 'Failed to load collections data. Please try again.',
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get('action')?.toString();
  
  if (action === 'updateSetting') {
    let operationTag = null;
    try {
      const collectionId = formData.get('collectionId')?.toString();
      const enabled = formData.get('enabled')?.toString() === 'true';
      const sortType = formData.get('sortType')?.toString();
      const exclusionTagsStr = formData.get('exclusionTags')?.toString();
      const exclusionTags = exclusionTagsStr ? JSON.parse(exclusionTagsStr) : [];
      const operationTagStr = formData.get('operationTag')?.toString();
      operationTag = operationTagStr ? JSON.parse(operationTagStr) : null;
      
      await db.collectionSetting.upsert({
        where: { shop_collectionId: { shop: session.shop, collectionId: collectionId! } },
        update: { enabled, sortType, updatedAt: new Date() },
        create: { shop: session.shop, collectionId: collectionId!, enabled, sortType },
      });
      
      await db.exclusionTag.deleteMany({ where: { shop: session.shop, collectionId: collectionId } });
      if (exclusionTags.length > 0) {
        await db.exclusionTag.createMany({
          data: exclusionTags.map((tag: string) => ({ shop: session.shop, collectionId: collectionId!, tag })),
          skipDuplicates: true,
        });
      }
      
      let sortStats = null;
      if (enabled) {
        const { fetchCollectionProducts, sortProductsWithInventory, reorderCollectionProducts, SORT_TYPE_MAPPING } = await import('../services/collection-sorting.server');
        const collectionData = await fetchCollectionProducts(admin, collectionId!, sortType as keyof typeof SORT_TYPE_MAPPING);
        const exclusionTagList = exclusionTags.map((tag: string) => tag.toLowerCase());
        const { inStock, outOfStock } = sortProductsWithInventory(collectionData.products, exclusionTagList);
        const sortedProductIds = [...inStock.map(p => p.id), ...outOfStock.map(p => p.id)];
        const reorderResult = await reorderCollectionProducts(admin, collectionId!, sortedProductIds, sortType as keyof typeof SORT_TYPE_MAPPING);
        
        if (!reorderResult.success) {
          return json({ success: false, error: `Settings saved but sort failed: ${reorderResult.error}`, operationTag });
        }
        sortStats = { inStockCount: inStock.length, outOfStockCount: outOfStock.length, totalProducts: sortedProductIds.length };
      }
      
      return json({ success: true, operationTag, stats: sortStats });
    } catch (error) {
      console.error('❌ SUPERVISOR Error saving collection setting:', error);
      return json({ success: false, error: `Failed to save setting: ${error instanceof Error ? error.message : String(error)}`, operationTag });
    }
  }
  
  return json({ success: false, error: 'Invalid action' });
};

export default function Collections() {
  const { collections, productTags, error, existingSettings } = useLoaderData<typeof loader>();
  
  const {
    uiState: collectionSettings,
    operationStatus,
    updateCollectionState: updateCollection,
    retryOperation,
  } = useSupervisor(collections || [], existingSettings || []);
  
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const [sortValue, setSortValue] = useState('bestsellers');
  
  React.useEffect(() => {
    Object.entries(operationStatus).forEach(([collectionId, status]) => {
      if (status.status === 'ready') {
        const collection = collections.find(c => c.id === collectionId);
        const collectionName = collection?.title || collectionId;
        const isEnabled = collectionSettings[collectionId]?.enabled;
        if (isEnabled && status.serverResponseData?.inStockCount !== undefined) {
          const { inStockCount, outOfStockCount } = status.serverResponseData;
          setToastMessage(`${collectionName} sorted! ${inStockCount} in-stock, ${outOfStockCount} moved to bottom`);
        } else {
          setToastMessage(`${collectionName} settings saved!`);
        }
      } else if (status.status === 'error') {
        const collection = collections.find(c => c.id === collectionId);
        const collectionName = collection?.title || collectionId;
        setToastMessage(`Operation failed for ${collectionName}: ${status.lastError || 'Unknown error'}`);
      }
    });
  }, [operationStatus, collectionSettings, collections]);
  
  if (!collections || collections.length === 0) {
    return (
      <Page title="Collections">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Text variant="bodyMd">Loading collections or no collections found.</Text>
              {error && <Banner tone="critical"><p>{error}</p></Banner>}
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const { mode, setMode } = useSetIndexFiltersMode();
  
  React.useEffect(() => {
    if (productTags && Array.isArray(productTags)) {
      setAvailableTags(productTags);
    }
  }, [productTags]);

  const enabledCollections = collections.filter((collection: any) => collectionSettings[collection.id]?.enabled);

  const tabs = [
    { content: `All (${collections.length})`, index: 0, onAction: () => handleTabChange(0), id: 'all-collections-1' },
    { content: `Push down enabled (${enabledCollections.length})`, index: 1, onAction: () => handleTabChange(1), id: 'enabled-collections-2' },
  ];

  const filteredCollections = selectedTab === 0 ? collections : enabledCollections;

  const searchedCollections = filteredCollections.filter((collection: any) => {
    const matchesSearch = collection.title.toLowerCase().includes(queryValue.toLowerCase());
    const matchesTagFilter = tagFilter.length === 0 || (collection.productTags || []).some((tag: string) => tagFilter.includes(tag));
    return matchesSearch && matchesTagFilter;
  });

  const sortedCollections = React.useMemo(() => {
    return [...searchedCollections].sort((a, b) => {
      if (sortValue === 'name_asc') return a.title.localeCompare(b.title);
      if (sortValue === 'name_desc') return b.title.localeCompare(a.title);
      if (sortValue === 'products_asc') return (a.productsCount?.count || 0) - (b.productsCount?.count || 0);
      if (sortValue === 'products_desc') return (b.productsCount?.count || 0) - (a.productsCount?.count || 0);
      return 0;
    });
  }, [searchedCollections, sortValue]);

  const resourceIDResolver = (collection: any) => collection.id;

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(sortedCollections, { resourceIDResolver });

  const handleStatusToggle = useCallback((collectionId: string) => {
    updateCollection(collectionId, { enabled: !collectionSettings[collectionId]?.enabled });
  }, [collectionSettings, updateCollection]);

  const handleSortTypeChange = useCallback((collectionId: string, sortType: string) => {
    if (!collectionSettings[collectionId]?.enabled) return;
    updateCollection(collectionId, { sortType });
  }, [collectionSettings, updateCollection]);

  const handleBulkEnable = useCallback(() => selectedResources.forEach(id => updateCollection(id, { enabled: true })), [selectedResources, updateCollection]);
  const handleBulkDisable = useCallback(() => selectedResources.forEach(id => updateCollection(id, { enabled: false })), [selectedResources, updateCollection]);

  const handleTagAdd = useCallback((collectionId: string, tag: string) => {
    updateCollection(collectionId, { exclusionTags: [...(collectionSettings[collectionId]?.exclusionTags || []), tag] });
  }, [collectionSettings, updateCollection]);

  const handleTagRemove = useCallback((collectionId: string, tag: string) => {
    updateCollection(collectionId, { exclusionTags: (collectionSettings[collectionId]?.exclusionTags || []).filter(t => t !== tag) });
  }, [collectionSettings, updateCollection]);

  const handleTabChange = useCallback((tabIndex: number) => setSelectedTab(tabIndex), []);

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
    { key: 'tagFilter', label: 'Tagged with', filter: <ChoiceList title="Tagged with" titleHidden choices={availableTags.map(tag => ({ label: tag, value: tag }))} selected={tagFilter} onChange={setTagFilter} allowMultiple />, shortcut: true, pinned: true },
  ];

  const handleFiltersQueryChange = useCallback((value: string) => setQueryValue(value), []);
  const handleFiltersClearAll = useCallback(() => {
    setQueryValue('');
    setSortValue('bestsellers');
    setSelectedTab(0);
    setTagFilter([]);
  }, []);

  const handleSearchCancel = useCallback(() => {
    handleFiltersClearAll();
    if (setMode) setMode('DEFAULT');
  }, [handleFiltersClearAll, setMode]);

  const appliedFilters = tagFilter.map((tag) => ({ key: `tagFilter-${tag}`, label: `Tagged with: ${tag}`, onRemove: () => setTagFilter(prev => prev.filter(t => t !== tag)) }));

  const promotedBulkActions = selectedResources.length > 0 ? [{ content: 'Enable push down', onAction: handleBulkEnable }, { content: 'Disable push down', onAction: handleBulkDisable }] : [];

  const rowMarkup = sortedCollections.map((collection: any, index: number) => {
    const { id, title, productsCount } = collection;
    const settings = collectionSettings[id];
    const isEnabled = settings?.enabled || false;
    const sortType = settings?.sortType || 'bestsellers asc';

    return (
      <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight="semibold" as="span">{title}</Text>
            <Text variant="bodySm" tone="subdued" as="span">{productsCount?.count || 0} products</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Tooltip content={isEnabled ? 'Click to disable' : 'Click to enable'}>
            <button type="button" onClick={() => handleStatusToggle(id)} style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer' }}>
              <Badge tone={isEnabled ? 'success' : 'critical'}>{isEnabled ? 'Enabled' : 'Disabled'}</Badge>
            </button>
          </Tooltip>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Select label="Sort type" labelHidden options={sortOptions} value={sortType} onChange={(value) => handleSortTypeChange(id, value)} disabled={!isEnabled} />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <TagAutocomplete availableTags={availableTags} selectedTags={settings?.exclusionTags || []} onAddTag={(tag: string) => handleTagAdd(id, tag)} onRemoveTag={(tag: string) => handleTagRemove(id, tag)} placeholder="Add exclusion tag" label="Exclusion tags" labelHidden={true} disabled={!isEnabled} />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ textAlign: 'center' }}>
            {operationStatus[id]?.status === 'processing' && <Spinner size="small" />}
            {operationStatus[id]?.status === 'ready' && <Icon source={CheckIcon} tone="success" />}
            {operationStatus[id]?.status === 'error' && (
              <Tooltip content={operationStatus[id]?.lastError}>
                <button onClick={() => retryOperation(id)} style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer' }}>
                  <Icon source={AlertTriangleIcon} tone="critical" />
                </button>
              </Tooltip>
            )}
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Frame>
      <Page title="Collections" subtitle="Manage push down out of stock sorting for your collections" backAction={{content: 'Settings', url: '/app/settings'}}>
        <TitleBar title="Collections" />
        <Layout>
          <Layout.Section>
            {error && <Banner tone="critical" title="Error loading data"><p>{error}</p></Banner>}
            <Card padding="0">
              <IndexFilters tabs={tabs} selected={selectedTab} onSelect={handleTabChange} sortOptions={[]} sortSelected={[]} onSort={() => {}} filters={filters} appliedFilters={appliedFilters} onClearAll={handleFiltersClearAll} queryValue={queryValue} queryPlaceholder="Search collections" onQueryChange={handleFiltersQueryChange} onQueryClear={handleSearchCancel} cancelAction={{ onAction: handleSearchCancel, disabled: false, loading: false }} canCreateNewView={false} mode={mode} setMode={setMode} />
              <IndexTable resourceName={{ singular: 'collection', plural: 'collections' }} itemCount={sortedCollections.length} selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length} onSelectionChange={handleSelectionChange} promotedBulkActions={promotedBulkActions} headings={[{ title: 'Collection' }, { title: <Text as="span" variant="headingSm">Status</Text> }, { title: <Text as="span" variant="headingSm">Sort Type</Text> }, { title: <Text as="span" variant="headingSm">Exclusion Tags</Text> }, { title: '' }]}>
                {rowMarkup}
              </IndexTable>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      {toastMessage && <Toast content={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </Frame>
  );
}
