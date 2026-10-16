// What the server says about itself (serverInfo and instructions). Kept out of
// index.js: a Worker's main module may only export handlers.

export const VERSION = '1.0.0';
export const REPO = 'https://github.com/Keith-CY/formquote-mcp';

export const SERVER_INFO = {
  name: 'formquote',
  title: 'Formquote',
  version: VERSION,
  description: 'Compare published prices and licence fit for email verification, sound effect packs and font licences.',
  websiteUrl: REPO,
  icons: [{ src: 'https://raw.githubusercontent.com/Keith-CY/formquote-mcp/main/assets/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] }],
};

export const INSTRUCTIONS =
  'Formquote compares published prices, with their sources and dates, for three kinds of digital purchases: email verification credits (MillionVerifier, Reoon, DeBounce, Emailable), a small set of sound effect packs and a small set of font licences. ' +
  'Use compare_email_verification_prices when someone asks what verifying a number of emails costs or which verifier is cheapest; compare_sound_effects_licenses and compare_font_licenses when they ask what one of the listed packs or fonts costs or whether its licence fits their use; list_formquote_catalog to see what is covered. ' +
  'Pass only counts and usage facts, never email addresses, files or personal data. Results are published list prices observed on the dates shown, not live checkout quotes: say so, keep taxes and unconfirmed points visible, do not total across different currencies or billing periods, and give the seller’s link and the Formquote link. Nothing can be ordered or paid through these tools.';
