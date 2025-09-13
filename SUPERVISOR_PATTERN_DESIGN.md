# Supervisor Pattern Design for Collections State Management

## Architecture Overview
Replace complex request/response tracking with declarative state reconciliation.

### Core Principle
> "Ensure UI intentions become reality" - Don't track operations, track outcomes.

## Components

## CLIENT SIDE

### 1. Client Supervisor (Core Logic)
- **Purpose**: Compare uiState vs clientImplementedState, trigger operations for differences
- **Triggers**: After every uiState change, successful operations, component mount
- **Scope**: Only comparison and decision making

## SERVER SIDE  

### 1. Server Supervisor (Background Healing)
- **Purpose**: Compare Database settings vs serverImplementedState
- **Triggers**: Every 30 minutes routine check
- **Scope**: Handle everything needed to make collections work (save + sort operations)
- **Retry Logic**: Try once after failure, then wait for next 30min cycle

### 2. Operation Manager 
- **Purpose**: Handle actual server requests with tagging system
- **Features**: Separate fetcher per collection, retry logic, timeout handling
- **Timeout**: 10 seconds, retry twice, show error/retry icon on failure

## CLIENT SIDE STATE

### 3. Client State Manager
- **uiState**: Raw collectionSettings (user's desires)
- **clientImplementedState**: Local copy of what client thinks server has implemented
- **Update Policy**: clientImplementedState updated only on successful operations
- **Persistence**: Rebuild clientImplementedState from server on mount (no browser persistence)

## SERVER SIDE STATE

### 4. Server State Manager  
- **Database Collection Settings**: What's saved in database
- **serverImplementedState**: What's actually been processed/implemented on server
- **Update Policy**: serverImplementedState updated only after successful Shopify operations
- **Storage**: Persist serverImplementedState in database for routine checks

### 4. UI Status Manager
- **Source of Truth**: Supervisor controls ALL spinner/checkmark states
- **Per Collection**: Individual status icons (processing/ready/error)
- **User Philosophy**: All operations are supervisor-triggered (user records desires, supervisor fulfills)

## Operation Flow

### Normal Flow
```
User Change → Update uiState → Supervisor detects difference → 
Operation Manager creates tagged request → Server responds with tag → 
Compare tag with latest uiState → If match: update implementedState → Clear UI status
```

### Mid-flight Changes
```
1. uiState: {sortType: "bestsellers"}
2. Supervisor triggers operation with tag: {sortType: "bestsellers"}
3. User changes: uiState: {sortType: "price_desc"} 
4. Supervisor triggers NEW operation with tag: {sortType: "price_desc"}
5. Old response arrives: tag doesn't match latest uiState → ignore
6. New response arrives: tag matches → update implementedState
```

## Key Design Decisions

### 1. Operation Tagging
- Tag sent with request, returned with response
- Tag contains expected final state for that collection
- Only update implementedState if response tag matches current uiState

### 2. Error Handling
- Retry twice with 10s timeout
- Show error/retry icon instead of checkmark
- Click error icon = immediate supervisor trigger
- Page refresh = natural supervisor trigger (detects mismatches)

### 3. Parallel Operations
- Separate fetcher per collection
- Independent failure handling
- No operation queuing or coordination needed

### 4. Server State Sync
- Update server-side implementedState after every successful operation
- Prevents redundant operations
- Rebuilds from server on component mount

## Benefits Over Current System
- Eliminates race condition tracking
- Self-healing (catches any mismatch regardless of cause)  
- Simpler mental model
- Easy to test and debug
- Handles ALL edge cases automatically

## Implementation Notes
- Supervisor should be lightweight comparison function
- Operation Manager handles complexity of requests/retries
- Clean separation of concerns prevents god object anti-pattern