Step 1 – Create a UX folder in your repo

In your project root:

cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
mkdir -p docx/UX


You’ll store one Markdown file per important screen/flow, for example:

docx/UX/UX-04-ListingCreate.md

docx/UX/UX-05-DiscoveryFeed.md

docx/UX/UX-06-CheckoutWithSP.md

docx/UX/UX-07-MessagingThread.md

etc.

Try to align the numbers with your modules when it makes sense (e.g. UX-04 with Module 04 – Listing).

Step 2 – Prepare each screen in Figma

For each key screen in Figma:

Make sure it’s a named frame (e.g. Mobile / Listing – Create v3).

Group related elements logically (header, content, footer).

Turn on Dev Mode so you can inspect:

Layout (constraints, padding, spacing).

Typography (font, size, weight).

Colors.

Component names (if you have a design system).

You don’t need to export code from Figma; we just want clean, human-readable specs.

Step 3 – Create a UX spec markdown for each screen

For each screen, create a file like:

docx/UX/UX-04-ListingCreate.md

Example structure you can reuse:

# UX-04-ListingCreate – Create Listing Screen (Final)

Figma frame: <paste Figma URL here>

## 1. Purpose

Screen for sellers to create a new listing. Must support:
- Title, description, category, condition
- Price input
- Toggle(s) for Swap Points / Donate (subscribers only)
- Publish + Save as draft

## 2. Layout (top to bottom)

1. **Header**
   - Left: back arrow icon
   - Center: title "Create listing"
   - No right icon

2. **Photo uploader**
   - Big square area with "+" icon and text "Add photos"
   - Below, grid of up to 6 thumbnails when photos are added

3. **Item details section**
   - Text input label: "Title"
   - Text input placeholder: "What are you selling?"
   - Multiline text input label: "Description"
   - Category dropdown: Clothes / Toys / Gear / Books / Other
   - Condition dropdown: New / Like New / Good / Fair

4. **Pricing & options**
   - Numeric input label: "Price ($)"
   - Toggle A (subscribers only): "Allow Swap Points"
   - Toggle B: "Donate this item"
   - Business rule: toggles are **mutually exclusive**

5. **Location**
   - Read-only text: "Listing location: {City}, {Node name}"

6. **Actions**
   - Primary button: "Publish listing"
   - Secondary text button: "Save as draft"

## 3. States

- Loading state for Publish button (spinner + disabled)
- Error messages inline under fields
- Validation:
  - Title required, min 3 chars
  - Price required and > 0

## 4. Notes

- Use shared `PrimaryButton`, `TextInputField`, etc. if available.
- Avoid scrolling issues: use `KeyboardAvoidingView` and `ScrollView`.


This is what the agent will read and use to “match” your Figma.

Step 4 – Update your prompts to reference UX specs

When you’re ready for the agent to implement or refactor a screen based on your final design, your prompt should explicitly mention the UX doc.

Example for Create Listing:

Goal: Update the Create Listing screen to match the final UX design.

UX spec: docx/UX/UX-04-ListingCreate.md
Modules:

docx/MODULE-04-ITEM-LISTING-V2.md

docx/MODULE-04-VERIFICATION-V2.md

Please:

Refactor p2p-kids-marketplace/src/screens/ListingCreateScreen.tsx to match the UX spec exactly (sections, inputs, labels, buttons).

Keep existing business rules from Module 04 (subscriber-only SP/Donate toggles, mutual exclusivity, validations).

Reuse shared components where possible.

Show code changes with paths.

Map to the verification checklist and list any // TODO(UX) where the UX spec is unclear.

Do the same for any other screen (Checkout, Discovery, Messaging, etc.) just by changing the UX file name and module.

Step 5 – (Optional) Add a tiny note in the agent file about UX folder

If you want the agent to “expect” those UX files, you can add this short line to the UX section:

- When I later add Markdown UX specs under `docx/UX/` (e.g. `UX-04-ListingCreate.md`),
  treat them as the source of truth for layout and copy for that screen.


That’s it — the rest is just you telling the agent which UX file to follow in each prompt.