// Image-credit helpers.
//
// Creative Commons "Attribution" licences (CC-BY, CC-BY-SA) legally require
// crediting the author. Public-domain and CC0 images by other creators don't,
// but we credit them anyway, with thanks. Picxle's own images aren't anyone
// else's work, so they get no credit line at all.
//
// The DB still stores license + attribution for every image (the audit
// trail); these helpers only decide what the player gets to see.

export function needsCredit(license) {
  return license === "CC-BY" || license === "CC-BY-SA";
}

// Picxle's own images are stored with an attribution beginning
// "Picxle original". They never appear on the credits page.
export function isPicxleOriginal(attribution) {
  return /^picxle original/i.test(attribution || "");
}
