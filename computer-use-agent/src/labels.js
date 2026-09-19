/** Number interactive elements so a 3B vision model can click by index. */

export async function labelPage(page) {
  return page.evaluate(() => {
    document.querySelectorAll("[data-cua-badge]").forEach((n) => n.remove());
    const nodes = [
      ...document.querySelectorAll(
        'a, button, input, textarea, select, [role="button"], [role="link"], [role="textbox"], [role="searchbox"]'
      ),
    ];
    const items = [];
    let i = 1;
    for (const el of nodes) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;

      const label =
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        el.getAttribute("name") ||
        el.innerText?.trim().slice(0, 60) ||
        el.getAttribute("href") ||
        el.tagName.toLowerCase();

      el.setAttribute("data-cua-id", String(i));
      const badge = document.createElement("div");
      badge.setAttribute("data-cua-badge", "1");
      badge.textContent = String(i);
      Object.assign(badge.style, {
        position: "fixed",
        left: `${Math.max(0, rect.left)}px`,
        top: `${Math.max(0, rect.top)}px`,
        zIndex: "2147483647",
        background: "#c1121f",
        color: "#fff",
        font: "bold 11px/1 sans-serif",
        padding: "2px 4px",
        borderRadius: "3px",
        pointerEvents: "none",
      });
      document.body.appendChild(badge);
      items.push({
        id: i,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        label: String(label).replace(/\s+/g, " ").trim(),
      });
      i += 1;
      if (i > 40) break;
    }
    return items;
  });
}

export async function clearLabels(page) {
  await page.evaluate(() => {
    document.querySelectorAll("[data-cua-badge]").forEach((n) => n.remove());
  }).catch(() => {});
}
