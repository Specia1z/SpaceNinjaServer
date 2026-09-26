# Refactoring progress

The server must keep its existing game-client routes and response shapes during the refactor. Preserve the current config format and supported build versions. Move one domain at a time, run `npm run verify`, `npm run lint`, `npm run build`, and targeted tests before continuing.

## Completed first slice

- Account rates: validation remains in `accountRateService.ts`, persistence and account lookup live in `accountRateAdminService.ts`, and HTTP handling remains in `accountRatesController.ts`.
- Mission platinum and credit settlement live in separate services, with focused tests for the existing reward behavior.
- Account Rates and Anti-Cheat WebUI pages have their own API and page scripts. Both use the existing session, localization, routing, and config APIs; the main WebUI script no longer owns their page state.
- Calendar progress and conservation rewards now have dedicated services while the old service exports remain available to callers.
- Mission reward rotation, fixed rewards, Conquest reward tables, drop aliases, and account drop scaling now live in `missionRewardService.ts`; the old mission service re-exports `addFixedLevelRewards` for existing callers.
- Inventory currency, Endo/Dirac, daily standing limits, and syndicate standing now live in `inventoryFinanceService.ts`; equipment acquisition and weapon/crew-ship skin insertion now live in `inventoryEquipmentService.ts`; mission completion and Booster updates now live in `inventoryProgressService.ts`. The old inventory service keeps the public exports for compatibility.
- Challenge state synchronization, Nightwave standing rewards, Kahl challenge stock, and Kahl weekly mission resets now live in `inventoryChallengeService.ts`; `inventoryService.ts` retains compatibility exports and injects item acquisition and change-merging callbacks without coupling the new module to the whole inventory service. Focus XP and Lore fragment progress scanning live in `inventoryProgressService.ts`.
- The metadata patch API, editor state, DOM rendering, route loading, validation, saving, importing, and preview copying now live in `static/webui/admin/metadata-api.js` and `metadata-page.js`.
- The `admin-data` and `redeem-codes` WebUI routes now have dedicated API/page modules. Their old route handlers and page implementations were removed from `script.js`; legacy inline handlers are kept through explicit window compatibility functions.
- The clan page now has dedicated guild API/page modules for its route lifecycle, cache and subscription, localized bulk buttons, cheat controls, membership and alliance actions, vault/research forms, and all overview and list rendering. The shared inventory/clan currency form and endpoint live in `static/webui/currency/`. The main WebUI script retains only shared session notifications, cache invalidation, and item metadata/datalist building.

## Remaining work

1. Split the remaining `missionInventoryUpdateService.ts` paths by inbound inventory updates and the large random-drop resolver. Add characterization tests for solo and multiplayer fissures, credit boosters, failed missions, and old client builds before moving those paths.
2. Split `inventoryService.ts` by inventory loading, equipment acquisition, challenges, and inventory migrations. Migrate callers per domain and remove transitional re-exports after the build is clean.
3. Move the remaining admin pages and inventory workflows out of `static/webui/script.js`, with route-local state, API requests, and event handlers. Separate their markup from `static/webui/index.html` only after the existing single-page routing and localization behavior is covered by browser tests.
4. Group the game-client routes by domain while retaining method, path, and registration order. Verify old and new build labels against the same endpoint behavior.
5. Add authenticated browser smoke tests for admin pages and integration coverage for reward settlement. Complete the UI migration and remove obsolete globals and inline event handlers.

This is an incremental migration. The large inventory acquisition/update functions and most WebUI routes still need decomposition before the backend and WebUI can be considered fully decomposed.
