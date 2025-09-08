# Push Down Out of Stock App - Complete Architecture Guide

This document explains exactly how our Shopify app works, what each file does, and how everything connects together. Perfect for understanding the entire system at a glance.

## 📁 Project Structure Overview

```
push-down-out-of-stock/
├── 🔧 Configuration Files (Tell Shopify & tools how to work)
├── 💾 Database Files (Store app settings & user data)
├── 🎨 App Code (The actual functionality)
└── 📦 Dependencies (External code we use)
```

---

## 🔧 Configuration Files - "The Setup Instructions"

### `shopify.app.toml` - Main App Configuration
**What it does:** Tells Shopify who our app is and what it can do
**Key settings:**
- `client_id`: Our app's unique ID in Shopify
- `name`: "Push Down Out of Stock" 
- `scopes`: Permissions we need (read/write products & collections)
- `webhooks`: When Shopify should notify us about changes

**Think of it as:** Your app's ID card and permission slip

### `shopify.web.toml` - Development Configuration  
**What it does:** Tells the development server how to run our app
**Key settings:**
- `dev`: Command to start the app (`npm exec remix vite:dev`)

**Think of it as:** Instructions for your development environment

### `package.json` - Project Dependencies & Scripts
**What it does:** Lists all the external code we use and useful commands
**Key dependencies:**
- `@shopify/shopify-app-remix`: Connects our app to Shopify
- `@shopify/polaris`: UI components (buttons, forms, etc.)
- `@prisma/client`: Database operations
- `remix`: Web framework for building our app

**Think of it as:** A recipe listing all ingredients and cooking instructions

---

## 💾 Database Files - "The Memory System"

### `prisma/schema.prisma` - Database Structure
**What it does:** Defines what data we store and how it's organized

**Our 3 data tables:**
1. **Session** - Stores user login information (built by Shopify)
2. **CollectionSetting** - Stores which collections have sorting enabled
   ```
   - collectionId: Which collection (e.g., "Summer Sale")  
   - sortType: How to sort (e.g., "bestsellers", "price_asc")
   - enabled: Is sorting turned on for this collection?
   ```
3. **ExclusionTag** - Stores tags that skip sorting
   ```
   - tag: Tag name (e.g., "preorder", "coming-soon")
   - shop: Which store this belongs to
   ```

**Think of it as:** The blueprint for our filing cabinet

### `dev.sqlite` - Actual Database File
**What it does:** The actual file where all data is stored
**Auto-generated:** Created when we run database migrations

**Think of it as:** The actual filing cabinet with all the folders

---

## 🎨 App Code - "The Actual Functionality"

### Core Framework Files

#### `app/root.tsx` - The Foundation
**What it does:** The base HTML structure for every page
**Contains:** Basic HTML setup, imports Polaris styles
**Think of it as:** The house foundation that everything else builds on

#### `app/db.server.ts` - Database Connection
**What it does:** Creates a connection to our database
**Contains:** Single line that connects to our SQLite database
**Think of it as:** The key that opens our filing cabinet

#### `app/shopify.server.ts` - Shopify Connection  
**What it does:** Handles all communication with Shopify
**Key features:**
- Authentication (making sure users are who they say they are)
- API calls to Shopify (getting collections, products, etc.)
- Session management (remembering users between visits)

**Think of it as:** The translator that speaks to Shopify for us

### Navigation & Layout

#### `app/routes/app.tsx` - App Layout & Navigation
**What it does:** Creates the main app shell with navigation menu
**Contains:**
- Navigation menu with "Home", "Collection Sorting", "Additional page"
- Polaris design system setup
- Container for all app pages

**Think of it as:** The hallway and doorways of your house

### Main Functionality

#### `app/routes/app.collections.tsx` - Collection Sorting Page (THE MAIN FEATURE)
**What it does:** The heart of our app - where users configure collection sorting

**The Complete User Journey:**
1. **Data Loading (loader function):**
   ```javascript
   // When page loads, fetch all collections from Shopify
   GET /admin/api/collections → Returns list of all collections
   ```

2. **UI Components:**
   - **Collection List:** Shows all store collections with checkboxes
   - **Sort Dropdowns:** When collection is selected, shows sort options
   - **Exclusion Tags:** Input field + tag management for excluded products

3. **User Interactions:**
   - ✅ Check a collection → Sort dropdown appears
   - 🔽 Choose sort type → Saved in state
   - 🏷️ Add exclusion tag → Shows as removable tag

**Think of it as:** The control panel for your entire sorting system

### Supporting Pages

#### `app/routes/app._index.tsx` - Home Page
**What it does:** Default landing page with sample product creation demo
**Contains:** Example of GraphQL mutations and Shopify API usage
**Think of it as:** The welcome mat and demo area

#### `app/routes/app.additional.tsx` - Additional Page
**What it does:** Template page for future features
**Think of it as:** An empty room ready for future use

### Webhook Handlers

#### `app/routes/webhooks.app.uninstalled.tsx` - Cleanup Handler
**What it does:** Runs when someone uninstalls the app
**Purpose:** Clean up user data (good practice)

#### `app/routes/webhooks.app.scopes_update.tsx` - Permission Handler  
**What it does:** Handles when app permissions change
**Purpose:** Ensures app works after permission updates

**Think of webhooks as:** Automatic notifications from Shopify

---

## 🔄 How Everything Connects - "The Flow"

### 1. App Installation Flow
```
User clicks "Install App" 
→ Shopify reads `shopify.app.toml` (permissions & setup)
→ Creates session in database (via `app/shopify.server.ts`)
→ Redirects to app homepage (`app/routes/app._index.tsx`)
```

### 2. User Visits Collection Sorting Page
```
User clicks "Collection Sorting" in nav
→ Loads `app/routes/app.collections.tsx`
→ `loader` function runs on server:
   - Authenticates user (shopify.server.ts)
   - Fetches collections from Shopify API
   - Returns data to frontend
→ React renders UI with collections
```

### 3. User Selects Collection & Sort Type (CURRENT STATE)
```
User checks collection checkbox
→ React updates component state
→ Sort dropdown appears
→ User selects sort type
→ Currently: Just stored in memory (not saved yet)

NEXT: We'll add save functionality to store in database
```

### 4. Future: Sorting Will Work Like This
```
User saves settings
→ Data stored in CollectionSetting table
→ Background process monitors product inventory
→ When inventory changes, automatically reorders collection
→ Customers see updated collection with out-of-stock items pushed down
```

---

## 🎯 Current Status: What Works Now

✅ **Working Features:**
- App installs and authenticates with Shopify
- Fetches and displays all store collections  
- Interactive UI with checkboxes and dropdowns
- Exclusion tag management
- Clean Polaris design matching Shopify admin

🚧 **Next Steps:**
- Save collection settings to database
- Implement actual product sorting logic
- Add webhook handlers for real-time updates

---

## 🛠️ Key Technologies Explained

### Remix Framework
**Purpose:** Builds web applications with server-side rendering
**Why we use it:** Fast, SEO-friendly, works great with Shopify
**Key concept:** Each route file handles both server logic (data fetching) and frontend UI

### Prisma Database Toolkit
**Purpose:** Makes database operations easy and type-safe  
**Why we use it:** No need to write SQL, automatic type checking
**Key concept:** Define schema once, get type-safe database client

### Shopify Polaris Design System
**Purpose:** Pre-built UI components that look like Shopify admin
**Why we use it:** Consistent design, familiar to merchants
**Key concept:** Use components like `<Card>`, `<Button>`, `<Select>` instead of basic HTML

### TypeScript
**Purpose:** Adds type checking to JavaScript
**Why we use it:** Catches errors before they happen, better development experience
**Key concept:** Variables have types (string, number, etc.) that are checked automatically

---

## 📚 File Dependency Map

```
shopify.app.toml
    ↓ (configures)
app/shopify.server.ts
    ↓ (authenticates)
app/routes/app.collections.tsx
    ↓ (uses)
prisma/schema.prisma
    ↓ (defines structure for)
dev.sqlite (database)
```

This architecture creates a robust, scalable Shopify app that follows industry best practices while remaining simple to understand and maintain.