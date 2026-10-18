// Product metadata is separate from immutable authored cases and saved routes.
export const REVIEW_STATEMENT = 'Clinician review completed, as confirmed by the creator.';
export const PRODUCT_RELEASE = Object.freeze({
  version: '1.0.0', status: 'release',
  clinician_review: Object.freeze({ status: 'completed', attestation: 'creator_confirmed',
    confirmation_date: '2026-10-18' }),
  // Confirmation date records the owner's statement, not the date of the review.
  clinical_use: false,
});

// Render historical release notices using the current product statement, while
// leaving authored diagnostic limitations and stored source bytes untouched.
export function releaseLimitation(text) {
  return /pending human (?:medical )?review|separate clinician review|unverified scope and version|AI-audited.*(?:clinical|review)/i.test(text) ? REVIEW_STATEMENT : text;
}
