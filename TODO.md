# Swap.tsx Enhancement Plan

## Goals:

1. ✅ Fetch all created tokens dynamically from tokenFactoryContract
2. ✅ Show token logos in token selector and swap UI
3. ✅ Enable swapping between any tokens including Somnia testnet
4. ✅ Add search functionality in token selector
5. ✅ Replace mock pools with dynamic data or proper handling
6. ✅ Connect swap logic to routerContract for real swaps

## Implementation Steps:

### Phase 1: Token Management

- [x] Add function to fetch all tokens from tokenFactoryContract
- [x] Use fetchTokenInfoOnChain to get token metadata
- [x] Include Somnia testnet token in the token list
- [x] Replace MOCK_TOKENS with fetched tokens

### Phase 2: UI Enhancements

- [x] Update TokenRow component to show token logos
- [x] Add fallback for tokens without logos
- [x] Add search functionality in token selector
- [x] Improve token selector UI

### Phase 3: Swap Logic

- [x] Update swap calculations for dynamic tokens
- [x] Connect swap execution to routerContract
- [x] Handle token approvals and real transactions
- [x] Add proper error handling

### Phase 4: Testing & Refinement

- [x] Test token fetching and display
- [x] Test swap functionality
- [x] Test search functionality
- [x] Verify all features work correctly

## Files to Modify:

- src/pages/Swap.tsx (main changes)
- src/utils/tokenUtils.ts (already has fetchTokenInfoOnChain)

## Dependencies:

- tokenFactoryContract (provided as prop)
- routerContract (provided as prop)
- thirdweb/react hooks
