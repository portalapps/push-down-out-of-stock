# Claude AI Instructions for This Project

## MANDATORY REFERENCE CHECK
**Before any Shopify-related response, ALWAYS:**
1. Read relevant file from `/ref/` folder using Read tool
2. If local reference is insufficient, use WebFetch to check https://polaris-react.shopify.com/components and navigate through its subfolders
3. Quote specific sections being referenced
4. Follow documented patterns exactly
5. Never hallucinate or guess Shopify APIs

## Reference Files (Check in Order)
1. **Local References** (Check first):
   - `ref/POLARIS_UI_REFERENCE.md` - UI components and patterns
   - `ref/SHOPIFY_API_REFERENCE.md` - GraphQL APIs and mutations  
   - `ref/SHOPIFY_DEV_REFERENCE.md` - Architecture and best practices
   - `ref/README.md` - Quick reference index

2. **Online Polaris Documentation** (If local insufficient):
   - Base URL: https://polaris-react.shopify.com/components
   - Component-specific URLs: https://polaris-react.shopify.com/components/[component-name]
   - Examples: 
     - IndexTable: https://polaris-react.shopify.com/components/index-table
     - Button: https://polaris-react.shopify.com/components/button
     - TextField: https://polaris-react.shopify.com/components/text-field

## Project Context
- **Goal**: Push-down-out-of-stock sorting for Shopify collections
- **Stack**: Remix + GraphQL Admin API + Polaris + Prisma
- **Current Phase**: UI implementation with native search/sort

## Key Patterns to Follow
- Use IndexTable for resource management (not DataTable)
- Follow Polaris component patterns exactly
- Use proper GraphQL query/mutation structure
- Implement proper error handling and loading states

## Reference Usage Workflow
1. **Always start with local `/ref/` files**
2. **If local reference lacks specific details, use WebFetch on Polaris documentation**
3. **Quote exact sections from either source**
4. **Implement based on documented patterns only**

**REMEMBER: Read references first, implement second. No exceptions.**

## WebFetch Usage for Polaris
When local reference is insufficient:
```
WebFetch: https://polaris-react.shopify.com/components/[component-name]
Prompt: "Extract component props, examples, and usage patterns for [specific question]"
```

Common component URLs:
- IndexTable: /components/index-table
- Button: /components/button  
- TextField: /components/text-field
- Select: /components/select
- Badge: /components/badge
- Card: /components/card
- Layout: /components/layout