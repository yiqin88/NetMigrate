// Coordinates UpdateDialog and AboutUpdates to prevent double-UI
let suppress = false

export function setSuppressUpdateOverlay(val) { suppress = val }
export function shouldSuppressUpdateOverlay() { return suppress }
