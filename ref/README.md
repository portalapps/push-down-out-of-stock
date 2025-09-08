# Reference Documentation Index

**CRITICAL: Always read relevant reference files before implementing anything Shopify-related**

## Quick Reference Guide

### UI/Component Questions
- **File**: `POLARIS_UI_REFERENCE.md`
- **Use for**: IndexTable, Button, Badge, Form components, layout patterns
- **Key sections**: IndexTable (line 83), Common Patterns (line 407)

### API/GraphQL Questions  
- **File**: `SHOPIFY_API_REFERENCE.md`
- **Use for**: Queries, mutations, webhooks, authentication, rate limits
- **Key sections**: GraphQL patterns (line 180), Common Operations (line 280)

### Architecture/Workflow Questions
- **File**: `SHOPIFY_DEV_REFERENCE.md` 
- **Use for**: App structure, deployment, best practices, troubleshooting
- **Key sections**: Development Workflow (line 320), Common Use Cases (line 380)

## Required Workflow
1. **ALWAYS read relevant reference first**
2. **Quote the section you're using**
3. **Follow documented patterns exactly**
4. **Never guess or improvise Shopify APIs**

## Current Project Context
- **App**: Push-down-out-of-stock sorting
- **Tech Stack**: Remix + GraphQL + Polaris + Prisma
- **Key APIs**: Admin API (products, collections, inventory)
- **Key UI**: IndexTable for collections management