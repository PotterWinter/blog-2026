// A tap of the phone's vibration motor as a dot lands on a new row or card. Android
// only: iOS Safari gives web pages no way to vibrate (a hidden <input switch> was
// tried, 30 Sep 69 — nothing on the owner's iPhone).
export function buzz() {
  if ("vibrate" in navigator) navigator.vibrate(8);
}
