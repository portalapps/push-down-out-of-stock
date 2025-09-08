# Shopify Polaris UI Components Reference

*Last Updated: September 2025*

## 1. Layout Components

### Page
**Purpose**: Main page container for Shopify admin interfaces
**Key Props**:
- `title` - Page heading
- `subtitle` - Additional context
- `primaryAction` - Main action button
- `secondaryActions` - Additional action buttons
- `backAction` - Navigation back button
- `pagination` - Previous/next navigation

**Best Practices**:
- Use for all top-level pages
- Provide clear page hierarchy with breadcrumbs
- Keep actions focused and relevant

**Example**:
```tsx
<Page
  title="Collections"
  subtitle="Manage your product collections"
  primaryAction={{content: 'Add collection', onAction: () => {}}}
  backAction={{content: 'Products', url: '/products'}}
>
```

### Layout
**Purpose**: Creates responsive page structure with consistent spacing
**Configurations**:
- One-column: Single content area
- Two-column: Equal or primary-secondary split
- Annotated: Settings pages with labels and content

**Best Practices**:
- Use annotated layout for settings/configuration pages
- Stack columns on mobile automatically

**Example**:
```tsx
<Layout>
  <Layout.Section>
    <Card>Main content</Card>
  </Layout.Section>
  <Layout.Section variant="oneThird">
    <Card>Sidebar</Card>
  </Layout.Section>
</Layout>
```

### Card
**Purpose**: Groups related content and actions together
**Key Props**:
- `sectioned` - Adds padding to content
- `title` - Card header
- `actions` - Header actions
- `primaryFooterAction` - Main footer button
- `secondaryFooterActions` - Additional footer buttons

**Best Practices**:
- Use to organize related functionality
- Limit to 2-3 sections per card for scannability
- Use consistent spacing with sectioned prop

### BlockStack / InlineStack
**Purpose**: Flexbox-based layout components for spacing
**Key Props**:
- `gap` - Spacing between items
- `align` - Alignment (start, center, end, space-between)
- `wrap` - Allow wrapping (InlineStack only)

**Best Practices**:
- Use BlockStack for vertical layouts
- Use InlineStack for horizontal layouts
- Consistent gap values (100, 200, 300, 400, 500)

## 2. Data Display Components

### IndexTable
**Purpose**: Display and manage collections of resources (products, orders, collections)
**Key Features**:
- Built-in selection with checkboxes
- Bulk actions
- Filtering and search
- Sorting capabilities

**Key Props**:
- `resourceName` - Singular/plural names
- `itemCount` - Total number of items
- `selectedItemsCount` - Number of selected items
- `onSelectionChange` - Selection handler
- `promotedBulkActions` - Primary bulk actions
- `headings` - Column headers
- `filters` - Filter configuration
- `onQueryChange` - Search handler

**Best Practices**:
- Use for resource management interfaces
- Provide clear column headers
- Support keyboard navigation
- Include meaningful bulk actions

**Example**:
```tsx
<IndexTable
  resourceName={{singular: 'collection', plural: 'collections'}}
  itemCount={collections.length}
  selectedItemsCount={selectedResources.length}
  onSelectionChange={handleSelectionChange}
  promotedBulkActions={bulkActions}
  headings={[
    {title: 'Collection'},
    {title: 'Status'},
    {title: 'Products'},
  ]}
  filters={filters}
  onQueryChange={handleSearch}
  queryValue={searchQuery}
>
  {rowMarkup}
</IndexTable>
```

### DataTable
**Purpose**: Display tabular data without resource management features
**When to Use**: Simple data display, reports, read-only tables
**Key Props**:
- `columnContentTypes` - Data types for styling
- `headings` - Column headers
- `rows` - Table data
- `totals` - Footer totals
- `truncate` - Handle long content

**Best Practices**:
- Use IndexTable for interactive resource lists
- Use DataTable for simple data display
- Provide clear column types for proper alignment

### ResourceList
**Purpose**: Display collections with rich item representations
**When to Use**: When items need more context than table rows
**Key Features**:
- Item previews with media
- Contextual information
- Navigation to detail views

## 3. Form & Input Components

### TextField
**Purpose**: Text input with validation and help text
**Input Types**:
- `text` - Standard text input
- `number` - Numeric input with controls
- `email` - Email validation
- `password` - Hidden text
- `search` - Search styling
- `url` - URL validation

**Key Props**:
- `label` - Field label
- `value` - Current value
- `onChange` - Change handler
- `error` - Error message
- `helpText` - Additional guidance
- `placeholder` - Placeholder text
- `disabled` - Disable input
- `multiline` - Textarea mode

**Best Practices**:
- Always provide labels for accessibility
- Use appropriate input types
- Provide helpful error messages
- Use placeholder text sparingly

### Select
**Purpose**: Choose from predefined options
**Key Props**:
- `options` - Array of {label, value} objects
- `value` - Selected value
- `onChange` - Selection handler
- `placeholder` - Default option text
- `disabled` - Disable selection

**Best Practices**:
- Provide clear option labels
- Use placeholder for context
- Consider Autocomplete for long lists

### Button
**Purpose**: Trigger actions and navigation
**Variants**:
- `primary` - Main actions (use sparingly)
- `secondary` - Secondary actions
- `plain` - Minimal styling
- `tertiary` - Subtle actions

**Tones**:
- `critical` - Destructive actions
- `success` - Positive actions

**Key Props**:
- `variant` - Visual style
- `tone` - Color theme
- `size` - Button size
- `fullWidth` - Expand to container
- `loading` - Show spinner
- `disabled` - Disable interaction
- `icon` - Add icon

**Best Practices**:
- One primary button per page section
- Use clear, action-oriented labels
- Provide loading states for async actions

### ButtonGroup
**Purpose**: Group related buttons together
**Best Practices**:
- Group logically related actions
- Use consistent button variants within group
- Don't exceed 3-4 buttons per group

## 4. Navigation Components

### Tabs
**Purpose**: Switch between related views
**Key Props**:
- `tabs` - Array of tab objects
- `selected` - Active tab index
- `onSelect` - Tab selection handler

**Tab Object**:
- `id` - Unique identifier
- `content` - Tab label
- `onAction` - Optional click handler

**Best Practices**:
- Use for related content views
- Keep tab labels concise
- Show active states clearly

**Example**:
```tsx
<Tabs
  tabs={[
    {id: 'all', content: 'All (24)'},
    {id: 'enabled', content: 'Enabled (12)'},
  ]}
  selected={selectedTab}
  onSelect={setSelectedTab}
/>
```

### Pagination
**Purpose**: Navigate through large datasets
**Key Props**:
- `hasNext` - Enable next button
- `hasPrevious` - Enable previous button
- `onNext` - Next page handler
- `onPrevious` - Previous page handler

## 5. Feedback Components

### Badge
**Purpose**: Indicate status or categorize content
**Tones**:
- `success` - Positive states (enabled, active)
- `info` - Neutral information
- `attention` - Needs attention
- `warning` - Caution required
- `critical` - Errors or urgent issues
- `new` - New items or features

**Sizes**:
- `small` - Compact display
- `medium` - Default size

**Best Practices**:
- Use consistent color meanings
- Keep text brief and clear
- Use appropriate tones for context

**Example**:
```tsx
<Badge tone="success">Active</Badge>
<Badge tone="critical">Disabled</Badge>
```

### Banner
**Purpose**: Communicate important page-level information
**Tones**: Same as Badge
**Key Props**:
- `title` - Banner heading
- `tone` - Visual style
- `onDismiss` - Dismissal handler
- `action` - Primary action
- `secondaryAction` - Additional action

**Best Practices**:
- Use for page-level messages
- Provide clear actions when possible
- Allow dismissal for non-critical messages

### Toast
**Purpose**: Temporary feedback for user actions
**Tones**: `success`, `error`
**Best Practices**:
- Use for action confirmations
- Keep messages brief
- Auto-dismiss after appropriate time

## 6. Overlay Components

### Popover
**Purpose**: Contextual overlays triggered by user actions
**Key Props**:
- `active` - Show/hide popover
- `activator` - Trigger element
- `onClose` - Close handler
- `preferredAlignment` - Positioning

**Best Practices**:
- Use for contextual menus and options
- Provide clear close mechanisms
- Position appropriately for screen space

### Modal
**Purpose**: Focused tasks that require user attention
**Variants**:
- `small` - Simple confirmations
- `medium` - Forms and content
- `large` - Complex workflows

**Key Props**:
- `open` - Visibility state
- `onClose` - Close handler
- `title` - Modal heading
- `primaryAction` - Main action
- `secondaryActions` - Additional actions

**Best Practices**:
- Use sparingly for important tasks
- Provide clear actions and exit paths
- Keep content focused and concise

### Tooltip
**Purpose**: Provide additional context on hover/focus
**Key Props**:
- `content` - Tooltip text
- `preferredPosition` - Positioning

**Best Practices**:
- Use for supplementary information
- Keep text brief and helpful
- Don't rely on tooltips for critical information

## 7. Utility Components

### Text
**Purpose**: Consistent typography throughout the app
**Variants**:
- `displayXl`, `displayLg`, `displayMd`, `displaySm` - Large headings
- `headingXl`, `headingLg`, `headingMd`, `headingSm` - Section headings
- `bodyLg`, `bodyMd`, `bodySm`, `bodyXs` - Body text

**Tones**:
- `subdued` - Secondary text
- `success`, `critical`, `warning` - Status colors

**Key Props**:
- `as` - HTML element type
- `variant` - Text size/style
- `tone` - Text color
- `fontWeight` - Weight override
- `truncate` - Truncate long text

## 8. Best Practices Summary

### Accessibility
- Always provide labels for form elements
- Use semantic HTML elements
- Support keyboard navigation
- Provide sufficient color contrast
- Include appropriate ARIA attributes

### Performance
- Use useCallback for event handlers
- Implement proper loading states
- Optimize for large datasets
- Minimize re-renders with proper state management

### Consistency
- Use consistent spacing (gap values: 100, 200, 300, 400, 500)
- Follow established color meanings (success=green, critical=red)
- Maintain consistent interaction patterns
- Use established component combinations

### Mobile Responsiveness
- Layout components handle responsive breakpoints automatically
- Test on multiple screen sizes
- Consider touch target sizes
- Provide appropriate mobile interactions

## 9. Common Patterns

### Resource Management Page
```tsx
<Page title="Collections" primaryAction={{content: 'Add collection'}}>
  <Layout>
    <Layout.Section>
      <Card padding="0">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
        <IndexTable
          resourceName={{singular: 'collection', plural: 'collections'}}
          itemCount={items.length}
          selectedItemsCount={selected.length}
          onSelectionChange={handleSelection}
          promotedBulkActions={bulkActions}
          headings={headings}
          filters={filters}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Layout.Section>
  </Layout>
</Page>
```

### Settings Page
```tsx
<Page title="Settings">
  <Layout>
    <Layout.AnnotatedSection
      title="General settings"
      description="Basic configuration options"
    >
      <Card sectioned>
        <FormLayout>
          <TextField label="Store name" value={name} onChange={setName} />
          <Select label="Currency" options={currencies} value={currency} />
        </FormLayout>
      </Card>
    </Layout.AnnotatedSection>
  </Layout>
</Page>
```

### Form with Validation
```tsx
<Card sectioned>
  <FormLayout>
    <TextField
      label="Collection name"
      value={name}
      onChange={setName}
      error={nameError}
      helpText="Must be unique within your store"
    />
    <Select
      label="Collection type"
      options={typeOptions}
      value={type}
      onChange={setType}
    />
    <ButtonGroup>
      <Button onClick={handleCancel}>Cancel</Button>
      <Button variant="primary" onClick={handleSave} loading={saving}>
        Save collection
      </Button>
    </ButtonGroup>
  </FormLayout>
</Card>
```

This reference covers the most important Polaris components for building Shopify admin interfaces. Use it as a quick reference for proper usage patterns and best practices.