// Copying a link to the clipboard, however the page was opened.
//
// navigator.clipboard is only there on a secure page - https, or localhost -
// and only while the page has focus, so a coordinator on the office network
// address (http://192.168.x.x) had none. The fallback was window.prompt, which
// some browsers refuse outright: there it threw, nothing caught it, and the
// button did nothing at all with no word why.

/** Copies text if any way of doing it works; says whether one did. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // No permission, or the page lost focus: try the older way.
  }

  // The older way, which works over plain http: select a hidden box and copy.
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const copied = document.execCommand("copy");
    box.remove();
    if (copied) return true;
  } catch {
    // Refused as well.
  }

  // Last, show it to copy by hand - where the browser allows a prompt at all.
  try {
    window.prompt("Copy this tracking link:", text);
  } catch {
    // Not even that; the caller says it could not be copied.
  }
  return false;
}
