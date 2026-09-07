# Brand-Rename Audit — "Pass It Up" → **SwapRound** (read-only, 2026-09-07)

Rename targets:
- **App brand**: "Pass It Up" / "PassItUp" / "P2P Kids Marketplace" / "Kids (P2P) Marketplace" → **SwapRound**
- **Currency display name**: "Swap Points" / "SP" (user-facing only) → **Neighbor Points**
- **Transaction-fee display name**: "transaction/platform/buyer fee" → **Safety & Platform Fee**
- **Subscription tier**: "Kids Club" / "Kids Club+" (tier branding — verify desired new name)
- Internal `sp_*` identifiers, table/column/function/RPC names, admin_config **keys**, env vars, bundle IDs and deep-link schemes are **NOT** rename targets (flagged `internal-only = yes`).

Scope searched: `p2p-kids-marketplace/`, `p2p-kids-admin/`, `p2p-kids-web/`, `supabase/` (migrations, edge functions, seed data). Build artifacts (`node_modules`, `.next`, `dist`, `ios/build`, `android/build`, `*.log`, `detox-run*`, `.expo`) excluded. All line numbers verified against source.

Legend: Category 1 = app/brand name · 2 = Swap Points/"SP" display · 3 = Kids Club(+ · 4 = fee copy · 5 = notification/email copy source · 6 = onboarding/help/education/legal · 7 = App/Play Store metadata · 8 = marketing web (p2p-kids-web) content. `internal-only` = **yes** means "identifier/config/comment — do NOT rename as display copy" (still listed so you can see where brand-like strings exist).

---

## Consolidated findings table

| File Path | Line(s) | Current String / Context | Cat | Internal-only? |
|---|---|---|---|---|
| **p2p-kids-marketplace/** |||||
| `app.json` | 3 | `"name": "Pass It Up!"` (display name; feeds iOS home screen + store listing) | 1 | no |
| `app.json` | 19–22 | `NSCameraUsageDescription` / `NSPhotoLibrary…` / `NSLocationWhenInUse…` = "Pass It Up uses your camera/photo library/location…" | 1 | no |
| `app.json` | 5, 9, 17, 124, 149, 171 | `slug p2p-kids-marketplace`, `scheme p2pkidsmarketplace`, `bundleIdentifier/package com.sameralzubaidi.p2pmarketplace`, `merchantIdentifier merchant.com.p2pkidsmarketplace` | 1 | yes |
| `ios/PassItUp/Info.plist` | 12 | `CFBundleDisplayName = Pass It Up!` | 1 | no |
| `ios/PassItUp/Info.plist` | 59, 67, 71, 73 | Hardcoded "Pass It Up uses your camera/… location/… photo library…" permission copy | 1 | no |
| `ios/PassItUp/Info.plist` | 61, 63, 65, 69 | `Allow $(PRODUCT_NAME) to access your Face ID / location / microphone` → renders "Allow **PassItUp** to…" (no space) | 1 | no |
| `ios/PassItUp/Info.plist` | 32–36 | URL schemes `p2pkidsmarketplace`, `com.sameralzubaidi.p2pmarketplace`, `exp+p2p-kids-marketplace` | 1 | yes |
| `ios/PassItUp.xcodeproj/project.pbxproj` | 429–430, 460–461 | `PRODUCT_BUNDLE_IDENTIFIER = com.sameralzubaidi.p2pmarketplace;` `PRODUCT_NAME = PassItUp;` | 1 | yes |
| `ios/PassItUp.xcodeproj/xcshareddata/xcschemes/PassItUp.xcscheme` | 18–20, 58–60 | `BlueprintName/BuildableName = "PassItUp"`; target/scheme/worktree named `PassItUp` | 1 | yes |
| `android/app/src/main/res/values/strings.xml` | 2 | `<string name="app_name">Pass It Up!</string>` (Android launcher label) | 1 | no |
| `android/settings.gradle` | 34 | `rootProject.name = 'Pass It Up!'` | 1 | yes |
| `android/app/src/main/AndroidManifest.xml` | 40, 45 | `<data android:scheme="p2pkidsmarketplace"/>` | 1 | yes |
| `android/app/src/main/java/com/sameralzubaidi/p2pmarketplace/MainActivity.kt`, `MainApplication.kt` | 1 | `package com.sameralzubaidi.p2pmarketplace` | 1 | yes |
| `plugins/withModularHeaders.js` | 16, 20 | `/target 'PassItUp' do/`, `` `target 'PassItUp' do` `` | 1 | yes |
| `package.json` | 2, 92 | `"name": "p2p-kids-marketplace"`; build script `-scheme PassItUp` | 1 | yes |
| `src/screens/auth/LandingScreen.tsx` | 43 | `<Text style={styles.appName}>Pass It Up</Text>` (onboarding landing hero) | 1 | no |
| `src/screens/auth/SignupScreen.tsx` | 444 | `Join the Kids P2P Marketplace` (subtitle) | 1 | no |
| `src/screens/auth/SignupScreen.tsx` | 566 | `Get 5 bonus points when you complete your first trade!` | 2 | no |
| `src/data/onboarding-screens.ts` | 31–34 | `What are Pass It Up Points?` / body "Pass It Up Points are rewards…" / a11y | 1 | no |
| `src/data/onboarding-screens.ts` | 38–39 | `How You Earn PIPs (Pass It Up Points)` / "…cash and PIPs…" (legacy currency name "PIPs") | 1 | no |
| `src/data/onboarding-screens.ts` | 45–49 | `How You Spend SP` / "…in SP (varies by category). You'll always pay a small cash fee…" / a11y | 2 | no |
| `src/data/onboarding-screens.ts` | 24–25 | Slide 1 welcome copy (brand-neutral) | 6 | no |
| `src/screens/home/DiscoverScreen.tsx` | 1068 | `No problem — you can still browse everything on Pass It Up.` | 1 | no |
| `src/components/listing/PriceAdjustmentModal.tsx` | 37 | `To keep Pass It Up full of quality items buyers can trust…` | 1 | no |
| `src/screens/ItemCreateScreen.tsx` | 1678 | `To keep Pass It Up full of quality items buyers can trust…` | 1 | no |
| `src/components/RadiusSlider.tsx` | 127 | `` `Your saved preference — Pass It Up's default is ${…} mi` `` | 1 | no |
| `src/screens/seller/PayoutSettingsScreen.tsx` | 746–747, 1074 | "…**Pass It Up** charges no withdrawal fee." | 1 | no |
| `src/screens/subscription/JoinKidsClubScreen.tsx` | 77 | `Kids Club+ is a membership that rewards the way you buy and sell on Pass It Up.` | 1+3 | no |
| `src/screens/subscription/SubscriptionExpiredScreen.tsx` | 145 | `Renew now to continue enjoying the full Pass It Up experience.` | 1 | no |
| `src/screens/subscription/SubscriptionExpiredScreen.tsx` | 30–45 | Benefits copy references **PIPs** ("Trade with PIPs", "Your earned PIPs never expire") — old currency name | 2 | no |
| `src/screens/help/HelpScreen.tsx` | 145 | `Learn how to trade safely and earn Swap Points in the Kids P2P Marketplace!` | 1 | no |
| `src/services/faqService.ts` | 41–42 | FAQ fallback `What is the Kids P2P Marketplace?` / "A safe platform for kids and parents…" | 1 | no |
| `src/services/aws/sns.ts` | 46 | SMS: `` `Your Kids P2P Marketplace verification code is: ${code}…` `` | 1 | no |
| `src/hooks/usePaymentSheet.ts` | 114 | `merchantDisplayName: 'Kids P2P Marketplace',` (Stripe/Apple Pay sheet) | 1 | no |
| `src/hooks/usePaymentSheet.ts` | ~119 | `returnURL: 'p2pkidsmarketplace://stripe-redirect'` | 1 | yes |
| `src/utils/subscriptionWeb.ts` | 16 | `const DEFAULT_WEB_BASE = 'https://passitup.com';` | 1 | yes |
| `src/components/subscription/JoinKidsClubButton.tsx` | 57 | `Manage your membership at passitup.com` | 1 | no |
| `src/screens/subscription/JoinKidsClubScreen.tsx` | 116 | `…taken to passitup.com to complete your membership securely.` | 1 | no |
| `src/screens/subscription/ContinueKidsClubScreen.tsx` | 282–283 | `Membership is managed on passitup.com. …` / `…Your Kids Club+ membership starts with …` | 1 | no |
| `src/screens/subscription/SubscriptionPaymentScreen.tsx` | 221 | `Membership is completed securely on passitup.com. You can cancel anytime…` | 1 | no |
| `src/screens/auth/LandingScreen.tsx` | 152 | `appName:` style (no text) | 1 | yes |
| `src/screens/profile/ProfileScreen.tsx` | 518, 522 | a11y `${profileSpBalance} SP Balance`; stat label `SP Balance` | 2 | no |
| `src/screens/profile/ProfileScreen.tsx` | 564, 581 | `Unlock Swap Points & free listings`; `Get bonus SP for inviting friends` | 2 | no |
| `src/screens/profile/SpWalletScreen.tsx` (LEGACY, non-routed) | ~40–176 | Whole duplicate wallet screen: `Swap Points` header, `{n} SP`, `Wallet Frozen… access SP`, `SP Expiring Soon`, ledger `+{n} SP` | 2 | no |
| `src/screens/sp/SpWalletScreen.tsx` | 116, 134, 148, 188, 191, 236, 249, 279, 294–296 | `Unable to load your SP wallet.`; `title="Swap Points"`; hero `Swap Points`; `{wallet.reserved_sp} SP`; `SP used in pending offers…`; `How to Earn SP`; `Accept SP on listing`; `…earn points`; `Swap Points Expire` | 2 | no |
| `src/screens/sp/SpWalletScreen.tsx` | 158, 168, 171 | `Join Kids Club+ to start earning Swap Points`; `Kids Club+ members earn SP on every sale and referral.` | 2+3 | no |
| `src/screens/sp/SpWalletScreen.tsx` | 204–256 (a11y) | Screen-reader labels `Sp wallet shop/sell/history/earn-sell/earn-refer btn` | 2 | no |
| `src/screens/sp/SpWalletScreen.tsx` | 330, 333–334, 345, 354 | `{totalPending} SP Pending Release`; `Your pending SPs will be released individually…`; `⚠️ {…} SP will expire in 30 days`; `🔒 SP can only be used for item purchases` | 2 | no |
| `src/screens/sp/SpTransactionHistoryScreen.tsx` | 100, 180 | `title="SP History"`; `{tx.amount} SP` | 2 | no |
| `src/screens/dashboard/UserDashboardScreen.tsx` | 344, 361, 535 | `{wallet.available} SP`; `Unlock Swap Points`; `SP Wallet Unlocked` | 2 | no |
| `src/screens/dashboard/UserDashboardScreen.tsx` | 289, 291, 546–548 | Badges `Kids Club+ Trial` / `Kids Club+ Active`; `Upgrade to Kids Club+` | 3 | no |
| `src/screens/payouts/PayoutDashboardScreen.tsx` | 181, 184 | `SP Balance`; `{spCount} SP` | 2 | no |
| `src/screens/referrals/ReferralsScreen.tsx` | 133–136, 211, 250, 290–334 | Share text `` `${referee_sp} SP for trade` ``; `+{…} SP`; `Refer Friends, Earn SP`; rewards/badges `… SP` | 2 | no |
| `src/screens/referrals/ReferralsScreen.tsx` | 144–149 | Share message/title `Join Kids Club+${bonusText}! Use my referral code…` | 3 | no |
| `src/screens/cart/CartScreen.tsx` | 610–612, 630, 720 | `Accepts Points`; `· Up to ${…} SP`; `Points unavailable…`; `SP Discount` | 2 | no |
| `src/screens/cart/CartCheckoutScreen.tsx` | 709, 756, 788–804, 821, 837–838 | `Points remaining:`; `Not eligible for points`; a11y `Points for …` / `Enter swap points…`; unit `<Text style={styles.spUnit}>SP</Text>`; `You can use up to {…} SP`; `Points Applied`; fee label `` `${buyerFeeInfo?.label ?? 'Platform Fee'}` `` | 2 | no |
| `src/screens/trade/TradeInitiationScreen.tsx` | 461, 552–553, 592–595, 604, 610, 623–638, 661, 671–672, 691 | Open-offer `+{…} SP`; `SP Limit Exceeded`; `Swap Points Discount`; `What are Swap Points?`; `Balance: {…} SP`; "Swap Points are a Kids Club+ feature…"; frozen/suspended/grace/unavailable wallet copy; input unit `SP`; `Max discount: … SP (…% of price)`; `SP Discount` | 2 | no |
| `src/screens/trade/TradeOfferScreen.tsx` | 426, 566, 576, 592–595, 618–641, 789–790 | `+{…} SP`; `{spAmount} SP applied`; `ADD SP OFFER`; `Max: … SP`; `Save up to {…}% with Swap Points`; `Kids Club+ members can use Swap Points…`; `SP discount`; `-{spAmount} SP` | 2 | no |
| `src/screens/trade/TradeReviewScreen.tsx` | 230, 240 | `+{spAmount} SP`; `You'll receive {spAmount} swap points when trade completes` | 2 | no |
| `src/screens/trade/ReviewOfferScreen.tsx` | 466, 481, 512–514, 565, 585–586 | `+{sellerSpEarned} SP`; `{itemSp} from buyer + {platformBonus} platform bonus`; `Points Earned`; `+{totalSellerSp} SP`; `{…} SP releasing in …` | 2 | no |
| `src/screens/trade/ReviewOfferScreen.tsx` | 580 | `<Text style={styles.payoutLabel}>Platform Fee</Text>` | 4 | no |
| `src/screens/trade/TradeDetailScreen.tsx` | 251, 341, 397–398 | Cancel alert `Any Swap Points have been refunded…`; `…releases Swap Points or cash to the seller.`; `Swap Points Used` / `{trade.sp_amount} SP` | 2 | no |
| `src/screens/trade/TradeDetailScreen.tsx` | 401 | `<Text style={styles.label}>Platform Fee</Text>` | 4 | no |
| `src/screens/trade/TradeSuccessScreen.tsx` | 67, 80, 89–90, 104, 111, 118, 129, 280 | `Kids Club+ gives you a flat fee and bonus Swap Points…`; `You saved $… using SP! You have … SP available.`; `Consider using SP…`; `Subscribe to earn Swap Points…`; `` `${…} SP releasing in …` ``; `You'll earn {spEarned} SP when complete` | 2 | no |
| `src/screens/trade/TradeSuccessScreen.tsx` | 66, 70, 105 | `Kids Club+ would've saved you $…`; `ctaLabel: 'Join Kids Club+'` | 3 | no |
| `src/screens/trade/TradeTimelineScreen.tsx` | 697, 1005, 1058, 1771–1776, 1824–1825, 1888–1889 | Cancel/completion copy; `SP Released`/`Swap Points Pending`; `{…} SP released/releasing…`; `Swap Points Used:` | 2 | no |
| `src/screens/trade/TradeTimelineScreen.tsx` | 1114, 1828, 1892 | `Platform Fee:` (bundle total / buyer / seller views) | 4 | no |
| `src/screens/trade/TradeListScreen.tsx` | 1186, 1221, 1308, 1386, 1409, 1569 | `+{…} SP`; `Includes points redemption` | 2 | no |
| `src/screens/home/ItemDetailScreen.tsx` | 633, 710, 713, 718, 944, 1068, 1071–1072 | `Swap Points Accepted (Kids Club+ only)`; `💫 Swap Points Eligible`; `…use your Swap Points as partial payment…`; `Use SP 🔒`; `Unlock SP Discounts`; modal copy | 2 | no |
| `src/screens/home/ItemDetailScreen.tsx` | 744 | `{buyerFeeInfo?.label ?? 'Safety & Platform Fee'}` | 4 | no |
| `src/screens/home/ItemDetailScreen.tsx` | 771, 1074 | `Save $… on fees! Subscribe to Kids Club+…`; `Try Kids Club+ Free` / `Join Kids Club+` | 3 | no |
| `src/screens/home/DiscoverScreen.tsx` | 286, 1421, 1437, 1451, 1457 | `Accepts SP` chip/toggle; a11y `Accepts Swap Points filter…`; `Subscribe to Kids Club+ to accept Swap Points…`; a11y `Upgrade to Kids Club+` | 2+3 | no |
| `src/screens/home/MoreFromThisSellerScreen.tsx` | 274 | `SP ✓` badge | 2 | no |
| `src/screens/listing/MyListingsScreen.tsx` | 286 | `SP Eligible` | 2 | no |
| `src/screens/ItemCreateScreen.tsx` | 1443–1444, 1457, 1464 | `Accept Swap Points?`; `Allow buyers to pay with Swap Points`; `✓ SP Eligible`; `Subscribe to Kids Club+ to accept Swap Points…` | 2+3 | no |
| `src/screens/listing/EditListingScreen.tsx` | 512, 520–521, 532, 539 | `Swap Points Payment Preference`; `Accept Swap Points?`; `Allow buyers to pay with Swap Points`; `✓ SP Eligible`; `Subscribe to Kids Club+ to accept Swap Points` | 2+3 | no |
| `src/screens/subscription/JoinKidsClubScreen.tsx` | 26–32 | `Earn Swap Points on every sale`; `Spend SP on purchases (up to 50%)` | 2 | no |
| `src/screens/subscription/JoinKidsClubScreen.tsx` | 62 | `` `Members pay one flat ${…} safety & platform fee per checkout…` `` | 4 | no |
| `src/screens/subscription/JoinKidsClubScreen.tsx` | 68, 102, 68+ | `title="Kids Club+"`; `Complete your Kids Club+ membership…` | 3 | no |
| `src/screens/subscription/ContinueKidsClubScreen.tsx` | 98, 137, 152, 168–171, 199, 224, 255, 283 | `Kids Club+` screen copy + `Earn & spend Swap Points on purchases` | 3+2 | no |
| `src/screens/subscription/ContinueKidsClubScreen.tsx` | 155, 227 | `Flat ${…} Safety & Platform Fee on every trade` | 4 | no |
| `src/screens/subscription/ManageKidsClubScreen.tsx` | 271, 312–361, 415–419, 426–438, 457–484, 516–555 | `Manage Kids Club+` titles/CTA/confirm; `Your Swap Points are frozen…`; `…unfreeze any remaining Swap Points`; `Kids Club+ Benefits`; `Cancel Kids Club+` | 3+2 | no |
| `src/screens/subscription/ManageKidsClubScreen.tsx` | 461 | `✓ Flat ${…} Safety & Platform Fee on every trade` | 4 | no |
| `src/screens/subscription/MySubscriptionScreen.tsx` | 67, 210, 244 | `planName 'Kids Club+'`; `Kids Club+ Benefits`; `Upgrade to Kids Club+` | 3 | no |
| `src/screens/subscription/PlanComparisonScreen.tsx` | 84, 141, 170, 195, 246, 249 | `Transaction fee (per trade)`; `Kids Club+ members save…`; header `Kids Club+`; `Why Upgrade to Kids Club+?`; CTA | 3+4 | no |
| `src/screens/subscription/SubscriptionExpiredScreen.tsx` | 43, 61 | `Save significantly on every transaction fee.`; `planName = 'Kids Club+'` | 3+4 | no |
| `src/screens/subscription/SubscriptionPaymentScreen.tsx` | 113, 116, 129–131, 141, 143, 175 | `Join/Re-subscribe to Kids Club+`; `Unlock Swap Points and reduced fees`; `Earn & Spend Swap Points`; `Lower Transaction Fees`; `Pay a flat ${…} Safety & Platform Fee…` | 3+2+4 | no |
| `src/screens/subscription/SubscriptionStatusScreen.tsx` | 245, 266 | diagnostic `SP wallet is frozen…`; `Start / Upgrade Kids Club+` | 2+3 | no |
| `src/screens/subscription/CancelSubscriptionScreen.tsx` | 50, 121 | `…lose access to all Kids Club+ benefits.`; `Join 1,000+ parents saving… with Kids Club+.` | 3 | no |
| `src/screens/subscription/UpgradePlanScreen.tsx` | 102, 230 | plan card `name: 'Kids Club+'`; `Join Kids Club+` | 3 | no |
| `src/screens/subscription/SubscriptionSuccessScreen.tsx` | 47 | `const planName = 'Kids Club+'` (screen noted unreachable) | 3 | no |
| `src/screens/notifications/NotificationSettingsScreen.tsx` | 59 | `Swap Points Events` (settings category label for `sp_events`) | 2 | no |
| `src/screens/notifications/NotificationCenterScreen.tsx` | 179, 589 | comment `Swap Points`; empty-state `You'll see trade updates, SP events, badge awards…` | 2 | no |
| `src/screens/profile/NotificationPreferencesScreen.tsx` | 38 | `Swap Points Events` (key `sp_events` is internal) | 2 | no |
| `src/screens/profile/TransactionHistoryScreen.tsx` | 82 | `{item.description \|\| 'Kids Club+ Subscription'}` | 3 | no |
| `src/screens/auth/LoginScreen.tsx` | 194 | `Log in to continue trading and earning Swap Points` | 2 | no |
| `src/screens/settings/DeleteAccountScreen.tsx` | 34–35 | `Your Swap Points balance will be forfeited.`; `Your Kids Club+ subscription will be cancelled…` | 2+3 | no |
| `src/screens/support/HelpSupportMenuScreen.tsx` | 24–25 | `How to Earn SP`; `Learn about Swap Points, the SP calculator, and bonus categories` | 2 | no |
| `src/screens/help/HelpScreen.tsx` | 180 | `Try the SP Calculator` | 2 | no |
| `src/screens/seller/PayoutSettingsScreen.tsx` | 447, 555, 965, 1069 | `After fees, you will receive $…`; `…before payout provider fees…`; `…fee: $…`; `Payout processing fee (…):` | 4 | no |
| `src/screens/seller/SellerEarningsScreen.tsx` | 211, 216 | `Payout Fee`; `Platform Fee` labels | 4 | no |
| `src/components/shared/SPBadge.tsx` | 38–39 | renders `{prefix}{points} SP` (currently no importer → unused) | 2 | no |
| `src/components/atoms/AcceptsSpBadge.tsx` | 26 | `Accepts SP` | 2 | no |
| `src/components/molecules/SearchFilterModal.tsx` | 369–377 | `💰 Accepts Swap Points`; `Show items sellers will trade for SP + cash`; a11y | 2 | no |
| `src/components/molecules/WalletWarningBanner.tsx` | 67–86 | `Swap Points Frozen`; `Your SP wallet has been suspended…`; `…keep spending existing Swap Points…` | 2 | no |
| `src/components/modals/SPInfoTooltip.tsx` | 58–100 | `What are Swap Points (SP)?`; bullets `You earn SP…` / `Buyers can use SP…` / `Only Kids Club+ members…`; `you'll earn ~36 SP.`; `Learn More About SP →` | 2 | no |
| `src/components/listing/SPEarningsPreview.tsx` | 106–251 | `Loading SP rates…`; `SP rates unavailable`; `Swap Points Estimate`; `You'll earn:`; `Buyers can pay up to ~{…} SP… with Swap Points`; `Actual SP may vary.`; a11y | 2 | no |
| `src/components/listing/PriceSuggestionCard.tsx` | 119–131 | `You'll earn:` `{…} SP`; `Buyer can use up to:` `{…} SP`; `Calculating SP...` | 2 | no |
| `src/components/bulk/BulkItemCard.tsx` | 305, 331–332, 344, 350 | `Accept Swap Points?`; `Buyers can pay with SP`; `SP Eligible`; `Subscribe to Kids Club+ to enable Accept SP.` | 2+3 | no |
| `src/components/bulk/BulkSPSummaryCard.tsx` | 100–311 | `SP estimate`; `Bulk Listing SP Summary`; `SP-enabled items:`; `Enable "Accept Swap Points"…`; `Total estimated SP:`; `formatSP(…) ~N SP`; `Upgrade to Kids Club+…`; a11y | 2 | no |
| `src/components/education/SPCalculator.tsx` | 180, 239–289 | `Calculate Your Swap Points`; `You'll earn:` `{…} SP`; `Bonus category! Earns {…}× SP`; `Max SP you can use:`; `Cash you'll pay after SP:`; `Platform fee:`; `Select a category to see your SP` | 2+4 | no |
| `src/components/education/BonusCategoriesList.tsx` | 72, 83, 96 | `These categories earn extra Swap Points…`; `Earn {…}× SP` | 2 | no |
| `src/components/organisms/RecommendationsCarousel/index.tsx` | 170 | `✓ SP Eligible` | 2 | no |
| `src/components/subscription/SubscriptionBanner.tsx` | 38–80 | `free trial of Kids Club+…keep your Swap Points.`; `Kids Club+ expired…`; `Unlock Swap Points and lower fees with Kids Club+.`; CTAs `Join/Continue Kids Club+`; label `Kids Club+` | 2+3 | no |
| `src/components/subscription/SubscriptionStatusCard.tsx` | 40, 58, 66–71 | `Upgrade to Kids Club+ to unlock Swap Points, reduced fees…`; `'Kids Club+'`; `Grace period (SP frozen)` | 2+3 | no |
| `src/components/GracePeriodBanner.tsx` | 32–36 | `…keep your Swap Points.` / `Only ${…} days left!…` / `…before your Swap Points are deleted.` | 2 | no |
| `src/components/NotificationSetup.tsx` | 129 | `Swap Points updates` (benefit row) | 2 | no |
| `src/hooks/usePaymentFailure.ts` | 83 | `Your Kids Club+ access has been paused. Re-subscribe to restore Swap Points.` | 2+3 | no |
| `src/hooks/useGracePeriodStatus.ts` | 58 | `…Re-subscribe now to keep your Swap Points.` | 2 | no |
| `src/constants/subscriptionPlans.ts` | 31, 43, 51 | `name: 'Transaction fee'`; `'Reduced transaction fee'`; `'Reduced transaction fees — save on every purchase'` | 4 | no |
| `src/constants/email.ts` | 6–8 | `FROM_EMAIL noreply@p2pkidsmarketplace.com`; `REPLY_TO/SUPPORT support@p2pkidsmarketplace.com` (email addresses/from-name domain) | 1 | yes |
| `src/services/adminConfig.ts` | 292, 478 | `buyer_fee_label: 'Safety & Platform Fee'` (code default → already target label) | 4 | no |
| `src/services/adminConfig.ts` | 80–404 (various) | Tiered buyer-fee engine — comments/internal only | 4 | yes |
| `src/services/subscription.ts` | 62, 205–225, 227 | `transaction_fee_cents`; `tier_name: 'Kids Club+'` (data value) | 3+4 | yes (key)/no (value) |
| `src/services/listing.ts` | 248, 687 | `Only Kids Club+ subscribers can accept Swap Points. Please subscribe…` (thrown → surfaced to user) | 2+3 | no |
| `src/services/sp/wallet.ts` | 116, 122, 126 | `Kids Club+ subscription required to use Swap Points`; `SP wallet not found`; `SP wallet is frozen…` (no production UI consumer found) | 2 | yes |
| `src/services/sp/earning.ts` | 18+ | comments (`Kids Club+`) — logic only | 3 | yes |
| `src/services/paymentRetry.ts` | 254 | `Your Kids Club+ access has been paused. Re-subscribe to restore your Swap Points.` (push body) | 2+3 | no |
| `src/services/faqService.ts` | 25, 46–54 | fallback category `Swap Points`; `How do I earn Swap Points?`; `Can I use Swap Points…?` … `The platform fee must always be paid in cash.` | 2+4 | no |
| `src/services/email.ts` | 236 (and 60–255) | `tier: data.tier \|\| 'Kids Club+'`; SendGrid template IDs + `swapPointsUsed` dynamic field (copy lives in SendGrid) | 5 | no |
| `src/services/educationContentService.ts` | 17–63 | Queries `education_sections` (DB-driven content) | 6 | yes |
| `src/services/tos.ts`, `src/services/privacyPolicy.ts` | — | RPC `get_current_policy` fetch → render screens (content from `platform_policies` DB) | 6 | yes |
| `src/utils/spCalculations.ts` | 126–129 | `formatSP` returns `'0 SP'` / `` `~${rounded} SP` `` — central "SP" unit token for most numeric displays | 2 | no |
| `src/services/trade.ts` | 436 | `Failed to verify Swap Points balance` (error string; reachability to UI unverified) | 2 | yes |
| `src/components/subscription/JoinKidsClubButton.tsx` | 6 | comment `…opens the "Join Kids Club" web page…` | 3 | yes |
| `src/components/QaForceTradeSuccessDeepLinkHandler.tsx` | 21 | comment `…remainingSP ("You have N SP available")` (QA dev tool) | 2 | yes |
| `src/utils/testNotifications.ts` | 14 | `P2P Kids Marketplace` (dev/test helper) | 1 | no (dev-only) |
| `src/services/pushDelivery.ts` | 698–700 | `Test Notification` / `…from the Kids P2P Marketplace app.` (dev test-push) | 1 | no (dev-only) |
| `src/screens/auth/SignupScreen.old.tsx` | 259, 438 | Orphaned `.old` file with brand + `earn Swap Points!` copy (not imported) | 1/2 | no (dead) |
| `src/assets/onboarding/README.md` | 8, 34 | `swap-points-intro.png` = "Swap Points" definition illustration rendered with big **"SP"** text (binary asset — must be re-rendered) | 2 | no |
| **p2p-kids-admin/** |||||
| `package.json` | 2 | `"name": "p2p-kids-admin"` | 1 | yes |
| `src/app/layout.tsx` | 6–7 | metadata `title: 'Kids Marketplace Admin'`; `description: 'Admin panel for Kids P2P Marketplace'` | 1 | no |
| `src/app/auth/login/page.tsx` | 67 | `P2P Kids Admin` (login heading) | 1 | no |
| `src/components/layout/Sidebar.tsx` | 103, 300–301 | nav item `SP Economy`; brand logo `<span>Kids </span><span>Admin</span>` | 2+1 | no |
| `src/components/layout/TopNavbar.tsx` | 79 | brand `Kids<span…>Admin</span>` | 1 | no |
| `src/app/components/ProtectedLayout.tsx` | 97, 185 | `P2P Kids Admin` brand link; `© 2024 P2P Kids Marketplace. All rights reserved.` (dead layout — not imported) | 1 | no |
| `src/app/settings/policies/new/page.tsx` | 143, 200 | placeholders `e.g., Kids P2P Marketplace Terms of Service`; `# Introduction…Welcome to Kids P2P Marketplace…` | 1 | no |
| `src/app/sp-economy/page.tsx` | 75, 77 | `💎 SP Economy`; `One hub for Swap Points health, flow, wallets, and rules…` | 2 | no |
| `src/app/sp-wallet/page.tsx` | 184, 242–253, 276–282, 328–347, 396 | `💎 SP Wallet Operations`; `Inspect any user's Swap Points wallet…`; metrics `…SP`; `SP adjusted. New balance: … SP`; `Manual SP Adjustment` | 2 | no |
| `src/app/sp-analytics/page.tsx` | 113–115 | `SP Analytics Dashboard`; `Track Swap Points velocity…` | 2 | no |
| `src/components/spconfig/SPAnalyticsDashboard.tsx` | 42 | `Category SP Metrics` | 2 | no |
| `src/components/spconfig/SPHealthPanel.tsx` | 163–277 | `SP in circulation`; `% trades using SP`; `Avg SP per SP-trade`; `SP adoption…`; `…wallets have pending SP older than 3 days` | 2 | no |
| `src/components/spconfig/SPRulesPanel.tsx` | 152–252 | `Loading SP rules…`; `SP earning multiplier`; `SP spending cap %`; `Earn SP per trade`; `Max spend SP per trade`; `The 50% global SP cap…` | 2 | no |
| `src/components/spconfig/SPEconomySummary.tsx` | 51–68 | `SP Circulation`; `Total Spent`; `…SP` | 2 | no |
| `src/app/users/page.tsx` | 362, 572, 661, 777–790 | `- SP wallet frozen`; sort `SP Balance`; `SP: {user.sp_balance}`; `SP Wallet` panel; `Available SP:`/`Pending SP:`…; `No SP wallet found` | 2 | no |
| `src/app/audit/page.tsx` | 50–57, 72–73, 93, 179, 268 | label map `SP Reserved / Restored / Released / Issued / Deducted / Frozen / Unfrozen / Expired` + `Buyer Fee` / `Seller Fee`; filter chips `Swap Points`, `Fees`; `${amt} SP`; subtitle copy | 2+4 | labels no / keys yes |
| `src/app/trades/[id]/page.tsx` | 192–200, 258, 387–393 | `Swap Points Applied` / `-{…} SP`; `Platform Fee`; `Swap Points`; `SP Debit Ledger` / `SP Credit Ledger (Refund)` | 2+4 | no |
| `src/app/trades/[id]/TradeActions.tsx` | 219, 266, 293, 384 | `…re-credit any Swap Points…`; `Refund one or more components (item price, platform fee, sales tax)…`; `Platform Fee` | 2+4 | no |
| `src/app/trades/bundles/[bundleId]/page.tsx` | 174–179, 224 | `Total Swap Points Applied`; `Total Platform Fees`; `({trade.sp_amount} SP)` | 2+4 | no |
| `src/app/trades/bundles/[bundleId]/BundleTradeActions.tsx` | 97 | `…SP will be re-credited to the buyer,` | 2 | no |
| `src/app/trades/page.tsx` | 316, 491 | `{group.total_sp} SP`; `({trade.sp_amount} SP)` | 2 | no |
| `src/app/trades/TradeFilters.tsx` | 187–188 | `Most SP Used` / `Least SP Used` | 2 | no |
| `src/app/trades/disputes/[tradeId]/page.tsx` | 166–167 | `SP Amount` … `{trade.sp_amount} SP` | 2 | no |
| `src/app/trades/disputes/DisputeViewer.tsx` | 236 | `+{d.sp_amount} SP` | 2 | no |
| `src/app/disputes/[tradeId]/page.tsx` | 151 | `SP Used` | 2 | no |
| `src/components/trades/TradePipelineBoard.tsx` | 172 | `+ {trade.sp_amount} SP` | 2 | no |
| `src/app/cancellation-insights/CancellationInsightsClient.tsx` | 306 | `(+{c.sp_amount} SP)` | 2 | no |
| `src/app/categories/page.tsx` | 149, 256 | `Manage product categories, SP rates…`; `Set SP Earn above 1.10x…` | 2 | no |
| `src/app/categories/components/CategoryTable.tsx` | 216, 219 | headers `SP Earn` / `SP Spend` | 2 | no |
| `src/app/categories/components/CategoryRow.tsx` | 134, 146 | `Click to edit SP rates` | 2 | no |
| `src/app/categories/components/CategoryForm.tsx` | 299–566 | `SP Config`; `SP Earning Multiplier`; `SP Spending Cap (%)`; `SP Redemption Cap (SP per item…)`; `Seller earns: {…} SP`; `Buyer can use up to: {…} SP`; `Buyer always pays {…}% cash minimum + platform fee` | 2+4 | no |
| `src/app/referrals/analytics-tab.tsx` | 35–37, 75, 90 | `SP Distributed`; header `SP Earned`; `{…} SP` | 2 | no |
| `src/app/referrals/configuration-tab.tsx` | 100–299 | `Configure SP bonus rewards…`; `Referrer SP Bonus`; `Referee SP Bonus`; `Starter Pack Bonus (All Users)`; `Award SP when referee completes…` | 2 | no |
| `src/app/components/ListingSearch.tsx` | 879, 964, 1239 | `SP-Eligible Only`; `SP` column; `SP Eligible` | 2 | no |
| `src/app/components/ListingAnalytics.tsx` | 127, 213, 243 | `SP-Eligible Listings`; `SP-Eligible Rate`; `SP-Eligible Active` | 2 | no |
| `src/app/components/TradeAnalytics.tsx` | 54 | `Avg SP Usage` | 2 | no |
| `src/app/payments/page.tsx` | 198, 200, 227 | headers `Fee` / `SP`; `{r.sp_amount} SP` | 2 | no |
| `src/app/nodes/page.tsx` | 251, 278 | `…Swap Points per node.`; `SP Earned`, `SP Spent` | 2 | no |
| `src/app/monitoring/cron/page.tsx` | 32, 56 | `Releases pending SP…`; `Expires SP batches…` | 2 | no |
| `src/app/badges/sandbox/page.tsx` | 261–277 | `Simulate SP Event`; `SP Earning` / `SP Spending`; `SP Amount` | 2 | no |
| `src/app/analytics/notifications/page.tsx` | 263 | `<option value="sp_events">SP Events</option>` | 5+2 | label no / value yes |
| `src/app/settings/trade-timing/page.tsx` | 45, 126, 137, 484–784 | `buyer_fee_label: 'Safety & Platform Fee'` (default config); `Transaction Fees`; `Seller & Buyer Platform Fees`; `Seller Fee % — Free Tier`; `Buyer Platform Fee — Fixed/%`; `Tiered Buyer Fee — R1…`; `Flat Fee — Active Members`; `Maximum Total Fee (cap)`; `Fee Display Label`; config key `…kids_club_plus` | 4 | labels no / keys yes |
| `src/app/settings/trade-timing/page.tsx` | 660–687, 779 | `'Kids Club+ Member Fee'`; `'Platform fee for Kids Club+ subscribers in cents…'`; `'Seller Fee % — Kids Club+'`; `Legacy…` | 3+4 | no |
| `src/lib/tradeTimingValidation.ts` | 33, 97–100 | config key + `Must be between 0 and 100` (internal key) | 4 | yes |
| `src/types/config.ts` | 69, 72 | `platform_fee_seller_discount_percentage_kids_club_plus` (type) | 4 | yes |
| `src/app/subscriptions/manage/page.tsx` | 585, 933 | `Reasons recorded when members cancelled Kids Club+…`; renders `sub.tier?.display_name` (DB) | 3 | no / data |
| `src/app/tax/settings/page.tsx` | 244 | `Tax Kids Club+ subscription fees` | 3 | no |
| `src/app/payouts/earnings/page.tsx` | 340 | `Platform Fee` | 4 | no |
| `src/app/payouts/page.tsx` | 298 | `Platform transaction fee is $0 (seller pays payout provider fees only)` | 4 | no |
| `src/app/analytics/page.tsx` | 218–333 | `💳 Transaction Fee Revenue`; `Total Transaction Fees`; `Subscription + Transaction Fees`; `Transaction Fees` | 4 | no |
| `src/components/analytics/FeeTierDistributionCard.tsx` | 59 | `🛡️ Buyer Fee-Tier Distribution` | 4 | no |
| `src/app/api/admin/trades/dispute-action/route.ts` | 277, 283, 454, 558 | user-notification titles fired by admin: `Trade Complete` / `Sale Complete` / `Refund Requires Attention` / `Sale Cancelled` | 5 | no |
| `src/app/api/reviews/[reviewId]/hide/route.ts` | 65 | `p_title: 'Review removed'` | 5 | no |
| `src/app/api/reviews/[reviewId]/keep/route.ts` | 79 | `p_title: 'Report reviewed'` | 5 | no |
| `src/app/id-badges/messages/page.tsx` | 137, 140 | `Message Templates` editor UI (message text is DB data) | 5/6 | UI no / data |
| `src/app/settings/policies/page.tsx` | 23–25 | `POLICY_LABELS` `Terms of Service` / `Privacy Policy` (content in DB) | 6 | no |
| `src/app/education/components/SectionForm.tsx` | 24–26 | type options `SP Definition` / `SP Earning` / `SP Spending` (labels no; values `sp_definition`… yes) | 6+2 | no/yes |
| `src/components/education/HelpMetricsCard.tsx` | 139–141 | `sp_definition: 'SP Definition'`, `sp_earning: 'How to Earn SP'`, `sp_spending: 'How to Use SP'` | 6+2 | label no / key yes |
| `src/app/education/components/ExampleTable.tsx` | 166, 169, 210, 215 | headers `Earn SP`/`Max Use SP`; `{…} SP` | 6+2 | no |
| `src/app/education/components/ExampleForm.tsx` | 250–266 | `SP Preview`, `Seller Earns`, `{earnSP} SP`, `{maxUseSP} SP max` | 6+2 | no |
| `src/app/education/faq/components/FAQForm.tsx` | 123 | placeholder `e.g. How do I earn Swap Points?` | 2 | no |
| **p2p-kids-web/** (marketing site) |||||
| `package.json` | 5 | `description: "Pass It Up — consumer web app (web-first subscription purchase, R7)"` | 1/8 | no |
| `app/layout.tsx` | 5, 7 | metadata `title: "Pass It Up — Kids Club+ Membership"`; `description: "Manage your Pass It Up membership. Join Kids Club+ to earn Swap Points, pay a flat safety & platform fee, and spend SP on purchases."` | 1/8 | no |
| `app/page.tsx` | 19–35 | Home: `<h1>Pass It Up</h1>`; `The kid-to-kid marketplace for your neighborhood. Manage your Kids Club+ membership here.`; `Join Kids Club+ to earn Swap Points on every sale and pay a flat {flatFee} safety &amp; platform fee…`; CTA `Join Kids Club+`; `…Manage your subscription in the Pass It Up app…` | 8+1+2+3+4 | no |
| `app/join/page.tsx` | 12–14 | `<h1>Kids Club+ Membership</h1>`; intro copy | 8+3 | no |
| `app/join/JoinForm.tsx` | 61–95 | `<h2>Kids Club+</h2>`; `Earn Swap Points on every sale` / `Active members earn SP when their items sell.`; `Pay a flat {flatFee} fee`; `Spend SP on purchases (up to 50%)` / `Use earned Swap Points to cover…` | 8+2+3+4 | no |
| `app/account/subscription/page.tsx` | 12 | `<h1>Kids Club+ Membership</h1>` | 8+3 | no |
| `app/account/subscription/SubscriptionConfirmation.tsx` | 24–29, 38, 50 | `Your Kids Club+ membership…`; `Tap below to go back to Pass It Up — your membership unlocks automatically and you&apos;ll be able to earn Swap Points…`; `Return to Pass It Up`; `…Open Pass It Up from your home screen…` | 8+1+2+3 | no |
| `app/account/subscription/SubscriptionConfirmation.tsx` | 37 | deep-link `p2pkidsmarketplace://my-subscription` (scheme internal) | 8 | yes |
| (no about/footer files; site = home + join + account pages only) | | | | |
| **supabase/** |||||
| `config.toml` | 63 | comment `# (passitup.com) with the x-web-secret…` | 1 | yes |
| `functions/create-checkout-session/index.ts` | 4, 30 | comment `(passitup.com/join)`; `const webBaseUrl = … ?? 'https://passitup.com'` (default web domain) | 1 | yes (comment) / no (domain default) |
| `functions/import-cpsc-recalls/index.ts` | 95, 113 | `'User-Agent': 'Kids P2P Marketplace Safety Scanner/1.0'` | 1 | yes |
| `functions/payout-settings-redirect/index.ts` | 84 | HTML `<a … id="appBtn">Open Kids Marketplace App</a>` (shown in browser post-payout) | 1 | no |
| `functions/process-paypal-payout/index.ts` | 91–102 | PayPal email `subject: 'You have received a payout from Kids Marketplace'` / message `Thanks for using Kids Marketplace.`; `note: 'Payout from Kids Marketplace'` | 1 | no |
| `functions/send-email/index.ts` | 534, 719 | email signatures `Best regards,<br/>P2P Kids Marketplace Team</p>` / `Kids P2P Marketplace Support Team</p>` | 1 | no |
| `functions/send-email/index.ts` | 369, 880, 391 | `swapPointsUsed` dynamic field; `tier: … \|\| 'Kids Club+'` (SendGrid data; copy in templates) | 2/3/5 | no |
| `functions/send-message-email/index.ts` | 38, 57, 60–61 | `APP_URL … 'https://p2pkidsmarketplace.com'`; `appName: 'Kids P2P Marketplace',`; `noreply@`/`support@p2pkidsmarketplace.com` | 1 | no (brand domain) |
| `functions/trade-extension/index.ts` | 525 | Stripe charge `description: 'Kids P2P · extension re-auth · …'` (statement text) | 1 | no |
| `functions/trade-extension/index.ts` | 143, 152+ | `EVENT_TITLES` + `buildBody()` — extension accept/deny/timeout push copy | 5 | no |
| `migrations/20251217000001_seed_initial_nodes.sql` | 29, 60 | node descriptions `'Norwalk, Connecticut - Kids marketplace for trading items…'` | 1 | no (DB seed) |
| `migrations/20260811000002_n4_min_age_18_registration_gate.sql` | 128 | `RAISE EXCEPTION 'AGE_MINIMUM_REQUIRED: You must be at least % years old to use Pass It Up'` | 1 | no (user error) |
| `migrations/310_faq_tables.sql` | 126–133 | FAQ seeds: `What is the Kids P2P Marketplace?`; `How do I earn Swap Points?`; `…platform fee must always be paid in cash.` | 1+2+4 | no (DB seed) |
| `storage/stripe-redirect.html`, `stripe-redirect-refresh.html` | 51, 54 | `Open Kids Marketplace App` button; `p2pkidsmarketplace://payout-settings?success=true` | 1 | copy no / scheme yes |
| `functions/cancel-subscription/index.ts` | 316, 357 | `…retain Kids Club+ benefits until your billing period ends.`; `Your trial has been cancelled. Your Swap Points are frozen for ${…} days.` | 3+2 | no |
| `functions/create-trade-offer/index.ts` | 382 | checkout label fallback `?? 'Safety & Platform Fee'` | 4 | no |
| `functions/create-trade-offer/index.ts` | 411–440, 1870 | `Unable to verify Swap Points access…`; `Your Swap Points balance is frozen…`; `This item accepts up to ${cap} Swap Points…`; `You don't have enough Swap Points… ${…} SP available.` | 2 | no |
| `functions/grace-period-cron/index.ts` | 355–359 | push bodies `…your Swap Points will be frozen…` / `…Re-subscribe to restore your Swap Points access.`; `Your Kids Club+ grace period ends in ${…} days.` | 2+3 | no |
| `functions/renew-subscription/index.ts` | 131–600 | `Kids Club+ billing is temporarily unavailable / not configured / price missing`; `Subscription renewed successfully. Your Swap Points are now available.`; Stripe desc `Kids Club+ subscription renewal` | 3+2 | no |
| `functions/create-subscription-from-payment-method/index.ts` | 186–659 | `display_name … : 'Kids Club+'` fallbacks; Stripe desc `Kids Club+ Subscription - Renewal/Initial Payment` | 3 | no |
| `functions/create-subscription-payment/index.ts` | 96, 107 | `display_name … : 'Kids Club+'` | 3 | no |
| `functions/retry-failed-payment/index.ts` | 276 | Stripe desc `Kids Club+ subscription - retried payment` | 3 | no |
| `functions/update-auto-renew/index.ts` | 150 | `…Please use Re-subscribe to restore Kids Club+.` | 3 | no |
| `functions/setup-subscription-payment/index.ts` | 125 | comment `when they start Kids Club+ from profile.` | 3 | yes |
| `functions/stripe-webhook-subscriptions/index.ts` | 1140–1409 | subscription push copy hub: renewed/welcome/cancelled/paused bodies + titles `Welcome to Kids Club+ 🎉` / `You're a Kids Club+ member 🎉`; `…Earn Swap Points…flat fee…` (fee from config) | 5+2+3+4 | no |
| `functions/trial-reminders/index.ts` | 466–476 | push bodies `…keep your Swap Points active.` / `…keep earning and spending Swap Points…` / `…Kids Club+ benefits.` | 2+3+5 | no |
| `functions/trade-payment/index.ts` | 555–655 | `Swap Points debit failed…` / `Error verifying Swap Points debit…` | 2 | no |
| `functions/send-trade-notifications/index.ts` | ~20–58 | `EVENT_COPY` — central trade/payout/dispute push copy table (titles+bodies); relayed by send-offer/pickup/auto-complete-reminders, process-expired-offers, process-extension-timeouts | 5 | no |
| `functions/initiate-payout/index.ts` | 232–233, 349–350 | payout push copy (`payout_requires_action` etc.) | 5 | no |
| `functions/process-paypal-payout/index.ts` | 88–102 | PayPal payout email copy (Cat 1 rows) | 5 | no |
| `functions/id-badge-notifications/index.ts`, `id-badge-submission-notification/index.ts` | — | copy from DB `id_badge_verification_messages` via `getMsg(…, 'fallback')` | 5 | data |
| `functions/send-phone-otp/index.ts`, `functions/sms-send/index.ts`, `functions/auth-email-change/index.ts` | — | OTP / security email bodies | 5 | no |
| `migrations/142_sp_notifications.sql` | 188–189 | trigger push/in-app copy `SP Wallet Frozen ❄️` / `Your Swap Points wallet has been frozen…` | 2+5 | no |
| `migrations/20260805000001_fix_sp_refund_notification_copy.sql` | 51–76 | `send_sp_transaction_notification` trigger copy: `✨ {n} SP Returned`, `🎉 +{n} SP Earned!`, `✨ {n} SP Reserved` | 2+5 | no |
| `migrations/20260830000001_dev_task_41_trade_row_sp_accounting_and_copy.sql` | 495–499 | `sp_ledger` reasons `SP refunded because…` (renders in points history/notifications) | 2 | no |
| `migrations/20260810000010_r11_r6_sp_caps_and_entitlement.sql` | 401 | `'SP transferred to seller — trade #' …` | 2 | no |
| `migrations/20260323000001_enforce_wallet_state_on_spend_earn.sql` | 39, 83, 164 | `RAISE EXCEPTION 'Cannot spend SP: wallet is frozen…'`; ledger desc `Swap Points used/earned from trade…` | 2 | no |
| `migrations/061_sp_ledger_and_trade_rpcs.sql` | 164, 233, 304 | ledger desc `Swap Points used for trade / refunded / earned…` | 2 | no |
| `migrations/20260528000003_sp_reserve_release_triggers.sql` | 352 | ledger desc `Swap Points Pending Release` | 2 | no |
| `migrations/20260528000005_auto_complete_cron.sql` | 112 | ledger desc `Swap Points Released` | 2 | no |
| `migrations/20260606000001_fix_sp_ledger_missing_on_trade_complete.sql` | 93, 262 | ledger desc `Swap Points committed/spent on trade #` | 2 | no |
| `migrations/20260607000001_fix_sp_multiplier_formula.sql` | 136, 208; `20260607000002…` 188; `20260715000001…` 409, 465; `20260828000001…` 188; `20260828000002…` 136, 283; `20260829000001…` 139; `20260830000015…` 175; `20260203000000…` 104; `20260810000006…` 245, 332; `090…`, `067…` 87, `098…` 21, `20260821000003…` 56 | ledger-description copy `Swap Points spent/committed/pending/refunded…` baked into SQL function bodies (write-time data, not admin-editable) | 2 | no |
| `migrations/094_sp_earning_rpcs.sql` | 59, 398; `101…` 55; `20260821000004…` 50; `20260830220000…` 121 | RPC errors `Kids Club+ subscription required to earn Swap Points` (surfaced to app) | 2+3 | no |
| `migrations/20260212000000_subscription_tiers.sql` | 155–156, 195–198 | tier seed `Kids Club+` + `Join Kids Club+ to unlock Swap Points, reduced fees…`; features `('can_earn_sp','Earn Swap Points',…)`, `('reduced_fee','Reduced Fees','Only $0.99 transaction fee (vs $2.99…)',…)` | 3+2+4 | no (DB seed — admin-editable) |
| `migrations/20260902120000_subscription_authority_consolidation.sql` | 30–56 | feature marketing copy `Pay one flat $1.49 safety & platform fee per checkout instead of the free-user percentage fee.`; admin_config desc updates | 4 | no (data)/yes (desc) |
| `migrations/20260810000009_tiered_buyer_fee_engine.sql` | 105–110, 149, 180 | admin_config seed `('buyer_fee_label','Safety & Platform Fee',…)` — live checkout label (admin-editable); fn fallback `'Safety & Platform Fee'` | 4 | no |
| `migrations/20260110000000_badges_v2.sql` | 60 | badge seed `('Trial Member','Joined Kids Club+ Trial',…)` | 3 | no (DB seed) |
| `migrations/20260420000020_create_education_analytics_and_seed.sql` | 151, 163 | education seeds `Only Kids Club+ members can earn and use SP`; `The platform fee is always paid in cash`; `What are Swap Points?` | 3+2+4+6 | no (DB seed) |
| `migrations/20250113_create_admin_config.sql` | 80–89 | admin_config descriptions `Only Kids Club+ subscribers can earn/spend SP`, `Seller fee discount for Kids Club+ (%)`, fee descriptions | 3+4 | yes (admin desc) |
| `migrations/20251216100002_admin_config_trial_settings.sql` | 65–72 | admin_config desc `30-day no-card trial for new Kids Club+ subscribers`, `SP (Swap Points) configuration` | 3+2 | yes (admin desc) |
| `migrations/20260214000001_dynamic_transaction_fees_from_admin_config.sql` | 15 | admin_config desc `Transaction fee for Kids Club+ subscribers in cents ($0.99)` | 3+4 | yes (admin desc) |
| `migrations/20260528000001_admin_config_trade_timing.sql` | 93–94 | admin_config desc `Buyer transaction fee for members/non-members in cents` | 4 | yes (admin desc) |
| `migrations/20260723000001_tax_category_rules.sql` | 104 | config desc `…the mandatory buyer marketplace/transaction fee is included…` | 4 | yes (admin desc) |
| `migrations/316_charge_one_fee_per_bundle_config.sql` | 14 | admin_config desc `bundles charge the platform fee once…` | 4 | yes (admin desc) |
| `functions/trade-refund/index.ts` | 175; `317_payments_reconciliation_and_partial_refunds.sql` 227 | error `Refund fee exceeds remaining platform fee` | 4 | no |
| `migrations/304_platform_policies_tos.sql` | — | creates `platform_policies` + `policy_acceptances` + RPCs `get_current_policy`/`has_accepted_current_policy`/`record_policy_acceptance`/`publish_policy`. **No legal text seeded** — content admin-inserted | 6 | data |
| `migrations/307_liability_disclaimer_tracking.sql`, `20260830000005_dev_task_48_restore_disclaimer_tracking.sql` | — | disclaimer linkage `trades.disclaimer_policy_id` (no text) | 6 | yes |
| `migrations/20260208000000_id_badge_verification_system.sql`, `204`/`205` | — | seeds `id_badge_verification_messages` (subject/body copy, admin-editable) | 5/6 | data |

---

## Internal-only (do NOT rename) — summary

- **`sp_*` schema/DB**: `sp_wallets`, `sp_ledger`, `sp_config`, `sp_expiration_warnings`, all `sp_*` columns, ledger-reason keys, RPC names (`get_user_sp_wallet_summary`, `rpc_get_buyer_sp_balance`, `get_sp_config`, `award_referral_sp`, `award_challenge_sp`, `fn_get_buyer_fee_for_checkout`, …), notification type keys (`sp_events`, `sp_balance_low`). ~200+ identifiers in marketplace `src/`, hundreds more across migrations.
- **Config keys**: `admin_config` key *names* (`buyer_fee_label`, `trial_enabled`, `charge_one_fee_per_bundle`, `platform_fee_seller_discount_percentage_kids_club_plus`, fee/SP keys) — only their **descriptions/values** may carry display copy.
- **App identifiers**: bundle/package `com.sameralzubaidi.p2pmarketplace`, scheme `p2pkidsmarketplace`, slug `p2p-kids-marketplace`, merchant id, EAS project id, package.json names, iOS `PRODUCT_NAME=PassItUp`, native target/folder `PassItUp`, `android` `rootProject.name`, deep-link schemes in Info.plist/Manifest/storage HTML.
- **Code identifiers**: `SPWallet`, `SpWalletScreen`, `SPBadge`, `SPEarningsPreview`, `SPInfoTooltip`, `formatSP`, `spCalculations`, `ds.sp` design tokens, etc. — internal component/variable names (optional cosmetic rename, not required).
- **Domain/email**: `passitup.com` (web + `SUBSCRIPTION_WEB_URL` default), `p2pkidsmarketplace.com` email addresses — decide with the rename; currently functional.

## Where admin-editable (DB) content lives (no code change needed, but data must be updated)

- **Legal policies** (`platform_policies`: terms_of_service / privacy_policy / liability_disclaimer) — admin-edited at `p2p-kids-admin/src/app/settings/policies/*` + `api/admin/policies/*`; mobile renders via `tos.ts`/`privacyPolicy.ts` screens; disclaimer via `DisclaimerModal` + `LiabilityDisclaimerScreen`.
- **Education/onboarding**: `education_sections` + examples (admin editor `p2p-kids-admin/src/app/education/*`); onboarding slides 2–3 in `src/data/onboarding-screens.ts` are **code static (no DB override)** — must change in code.
- **FAQ**: `faq_items`/`faq_categories` (DB-primary); `faqService.ts` static fallback mirrors seed → update both.
- **Subscription tiers/features/badges**: `subscription_tiers`, `subscription_features`, `badges` seeds (`Kids Club+`, `Earn Swap Points`, `Reduced Fees`, `Trial Member`) — DB data; `display_name`/`description` admin-editable.
- **`admin_config.buyer_fee_label` = `Safety & Platform Fee`** — already the target label (live checkout label).
- **`id_badge_verification_messages`** — notification/email copy for ID-badge flow (admin-editable).
- **`nodes.description`** seed rows contain "Kids marketplace…" copy.
- **`sp_ledger.description`** strings built by SQL function bodies (not admin-editable → edit the listed migrations).

## Notifications & email — source-file map (Cat 5)

| Event / copy | Source file | Where copy lives |
|---|---|---|
| Trade / payout / dispute / auto-complete push | `supabase/functions/send-trade-notifications/index.ts` (`EVENT_COPY`) | function code |
| Extension accept/deny/timeout push | `supabase/functions/trade-extension/index.ts` (`EVENT_TITLES`/`buildBody`) | function code |
| Subscription lifecycle push (renewed/welcome/cancelled/paused/failed) | `supabase/functions/stripe-webhook-subscriptions/index.ts` | function code |
| Trial / grace push | `supabase/functions/trial-reminders/index.ts`, `grace-period-cron/index.ts` | function code |
| SP wallet push/in-app (frozen, +N SP earned/returned/reserved) | `supabase/migrations/142_sp_notifications.sql`, `20260805000001_fix_sp_refund_notification_copy.sql` | SQL trigger bodies |
| Trade push **titles** (client) | `p2p-kids-marketplace/src/services/tradeNotifications.ts`; bodies from call sites (`TradeReviewScreen.tsx:121`) | app code |
| Badge push | `p2p-kids-marketplace/src/services/badgeNotifications.ts` | app code |
| Subscription push/in-app | `p2p-kids-marketplace/src/services/subscriptionNotifications.ts`, `paymentRetry.ts`, `subscriptions/trialReminders.ts` | app code |
| Payment-failure emails | `p2p-kids-marketplace/src/services/emailNotifications.ts` (+ SendGrid templates) | type keys client-side; copy in SendGrid / `send-email` fn |
| Transactional emails (welcome/reset/trade/transaction/subscription) | SendGrid templates; invoked by `p2p-kids-marketplace/src/services/email.ts` | copy in SendGrid (not repo) |
| ID-badge push+email | `supabase/functions/id-badge-notifications/*` + DB `id_badge_verification_messages` | DB copy |
| PayPal payout email | `supabase/functions/process-paypal-payout/index.ts` | function code |
| Email signatures/brand + message emails | `supabase/functions/send-email/index.ts`, `send-message-email/index.ts` | function code |
| Admin-triggered user notifications | `p2p-kids-admin/src/app/api/admin/trades/dispute-action/route.ts`, `api/reviews/[reviewId]/hide|keep/route.ts` | admin code |
| In-app notification rows for trades/SP/badges/referrals/listings/chat | DB triggers (migrations listed above) → `NotificationCenterScreen.tsx` renders DB title/body | SQL copy |

## Notes & caveats

1. **No store metadata / fastlane** — Category 7 is effectively "not present" anywhere. Store-facing app name/subtitle would come from `app.json` name, `ios/…/Info.plist` `CFBundleDisplayName`, and `android/…/strings.xml` `app_name`, plus App Store Connect / Play Console listings (external). No `fastlane/`, `metadata/`, or store description files exist in the repo.
2. **Marketing web (Cat 8)** = only home (`app/page.tsx`), join (`app/join/*`), account/subscription (`app/account/subscription/*`). There is **no separate about page and no footer component**; `layout.tsx` holds global metadata.
3. **Inconsistent old brand**: "Kids P2P Marketplace" / "P2P Kids" strings remain in Signup subtitle, HelpScreen, faqService, SMS OTP, Stripe merchant name, admin login/sidebar/metadata/footer, `send-email` signatures, `send-message-email`, PayPal email, node seeds, age-gate error, FAQ seed — must be swept **in addition to** "Pass It Up".
4. **Currency-name collision in onboarding**: slides 2–3 use old "Pass It Up Points"/"PIPs" (not "Swap Points") — they still represent the same currency and need the coordinated "Neighbor Points" decision (they are code-static; no DB override).
5. **`$(PRODUCT_NAME)` permission strings** render "Allow PassItUp…" — update both the hardcoded "Pass It Up …" and `PRODUCT_NAME`-based strings in lockstep.
6. **Partial stale duplicate tree** `p2p-kids-marketplace/p2p-kids-marketplace/src/` (contains `screens/referrals/ReferralsScreen.tsx`, onboarding assets, `.maestro`) still has old copy — recommend deleting rather than renaming; it is not part of the app build.
7. **Dead/legacy files still in `src/`**: `src/screens/profile/SpWalletScreen.tsx` (old wallet screen), `src/screens/LoginScreen.tsx`, `src/screens/auth/SignupScreen.old.tsx`, `src/components/shared/SPBadge.tsx` (unused) — decide purge vs. rename. `ios.disabled/` and `android.disabled/` hold an older native tree with the same `PassItUp` branding (not built).
8. **Binary assets**: `src/assets/onboarding/swap-points-intro.png` embeds the text "SP" (generated per `README.md:34`) — must be re-rendered for "Neighbor Points". Splash/icon PNGs may carry the wordmark (not text-verifiable).
9. **Tests will break**: `__tests__`/e2e/`.maestro` flows assert many of the above strings ("Kids Club+", "Swap Points", "Refer Friends, Earn SP", "SP Balance", etc.). Update test fixtures/assertions in the same rename pass (not listed exhaustively — they mirror the prod strings above).
10. **Config-driven copy**: many labels (fee label, subscription features, tier display_name, education/FAQ/ID-badge messages, policy text) come from Supabase tables — a full rename needs a **data migration/update**, not just code changes. `admin_config.buyer_fee_label` is already `Safety & Platform Fee`.

*Audit performed read-only. No files were modified. Generated 2026-09-07.*
