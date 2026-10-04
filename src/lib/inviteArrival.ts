// Did this page load come from an invite email?
//
// The link in a Staff Management invite brings the person to the site with a
// token in the address ("#access_token=…&type=invite"). The auth client reads
// that token, signs them in, and then wipes it from the address. Being signed
// in is not enough: they have no password yet, so they must be taken to the
// set-password screen or they can never sign in again.
//
// This is read once, as the app loads, before the auth client has had the
// chance to wipe the address.

/** True for an invite link's address fragment. */
export const isInviteHash = (hash: string) => /(^#|&)type=invite(&|$)/.test(hash);

export const ARRIVED_BY_INVITE = typeof window !== "undefined" && isInviteHash(window.location.hash);
