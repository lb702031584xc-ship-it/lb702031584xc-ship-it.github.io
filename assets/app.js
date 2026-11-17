// Progressive enhancement only. Every page works with JS disabled.
(() => {
  const RECENT_KEY = "gv:recent:v2";
  const MAX_RECENT = 6;

  /* -------------------------------------------------- click-to-load player */

  document.querySelectorAll(".player[data-embed]").forEach((player) => {
    const button = player.querySelector(".player-start");
    if (!button) return;

    button.addEventListener("click", () => {
      const embed = player.dataset.embed;
      const title = player.dataset.title || "Game";

      const frame = document.createElement("iframe");
      frame.src = embed;
      frame.title = title;
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("allow", "fullscreen; autoplay; gamepad; clipboard-write");
      frame.referrerPolicy = "no-referrer-when-downgrade";

      frame.addEventListener("error", () => {
        const note = document.createElement("p");
        note.className = "notice";
        note.innerHTML = `The game could not be embedded. <a href="${embed}">Open it directly</a>.`;
        player.after(note);
      });

      player.appendChild(frame);
      button.remove();
      player.querySelector(".player-hint")?.remove();
      addRecent(player);
    });
  });

  function addRecent(player) {
    const cover = player.querySelector(".player-cover");
    const entry = {
      title: player.dataset.title || document.title,
      url: location.pathname,
      cover: cover ? cover.getAttribute("src") : "",
      ts: Date.now(),
    };
    try {
      const list = readRecent().filter((item) => item.url !== entry.url);
      list.unshift(entry);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
    } catch {
      /* storage disabled — enhancement only */
    }
  }

  function readRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /* --------------------------------------------------------- recent strip */

  const strip = document.querySelector("[data-recent]");
  if (strip) {
    const items = readRecent();
    if (!items.length) {
      strip.innerHTML = '<p class="recent-empty">Games you open will show up here.</p>';
    } else {
      strip.innerHTML = items
        .map(
          (item) => `<a href="${escapeAttr(item.url)}">
            ${item.cover ? `<img src="${escapeAttr(item.cover)}" alt="" width="26" height="26" loading="lazy">` : ""}
            <span>${escapeText(item.title)}</span>
          </a>`
        )
        .join("");
    }
  }

  /* ------------------------------------------------------- data tool table */

  const toolRoot = document.querySelector("[data-tool]");
  if (toolRoot) {
    const table = toolRoot.querySelector("table[data-sortable]");
    const tbody = table?.querySelector("tbody");
    const rows = tbody ? [...tbody.rows] : [];
    const search = toolRoot.querySelector("[data-tool-search]");
    const counter = toolRoot.querySelector("[data-tool-count]");
    const emptyNote = toolRoot.querySelector("[data-tool-empty]");

    let sortKey = null;
    let direction = 1;

    table?.querySelectorAll("th[data-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        const numeric = th.dataset.numeric === "1";
        direction = sortKey === key ? -direction : 1;
        sortKey = key;

        table.querySelectorAll("th").forEach((cell) => cell.removeAttribute("aria-sort"));
        th.setAttribute("aria-sort", direction === 1 ? "ascending" : "descending");

        rows
          .sort((a, b) => {
            const x = a.dataset[key] ?? "";
            const y = b.dataset[key] ?? "";
            return (numeric ? Number(x) - Number(y) : x.localeCompare(y)) * direction;
          })
          .forEach((row) => tbody.appendChild(row));
      });
    });

    search?.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      let shown = 0;
      for (const row of rows) {
        const hit = !query || row.textContent.toLowerCase().includes(query);
        row.hidden = !hit;
        if (hit) shown += 1;
      }
      if (counter) counter.textContent = `${shown} / ${rows.length}`;
      if (emptyNote) emptyNote.hidden = shown !== 0;
    });
  }

  /* ----------------------------------------------------------- calculator */

  const calc = document.querySelector("[data-calc]");
  if (calc) {
    const give = calc.querySelector("[data-calc-give]");
    const get = calc.querySelector("[data-calc-get]");
    const result = calc.querySelector("[data-calc-result]");

    const update = () => {
      const giveValue = Number(give.value);
      const getValue = Number(get.value);
      if (!give.value || !get.value) {
        result.textContent = calc.dataset.pick;
        result.dataset.verdict = "";
        return;
      }
      const ratio = giveValue === 0 ? Infinity : getValue / giveValue;
      if (!Number.isFinite(ratio)) {
        result.textContent = `${calc.dataset.win} · ${giveValue.toLocaleString("en-US")} → ${getValue.toLocaleString("en-US")}`;
        result.dataset.verdict = "win";
        return;
      }
      const verdict = ratio >= 1.1 ? "win" : ratio <= 0.9 ? "loss" : "fair";
      const label = { win: calc.dataset.win, fair: calc.dataset.fair, loss: calc.dataset.loss }[verdict];
      result.textContent = `${label} · ${giveValue.toLocaleString("en-US")} → ${getValue.toLocaleString("en-US")} (${Math.round((ratio - 1) * 100)}%)`;
      result.dataset.verdict = verdict;
    };

    give?.addEventListener("change", update);
    get?.addEventListener("change", update);
  }

  /* -------------------------------------------------- income calculator */

  const calcPage = document.querySelector("[data-calc-page]");
  if (calcPage) {
    const boxes = [...calcPage.querySelectorAll('input[type="checkbox"][data-mps]')];
    const counter = calcPage.querySelector("[data-calc-count]");
    const perSec = calcPage.querySelector("[data-calc-per-sec]");
    const perDay = calcPage.querySelector("[data-calc-per-day]");
    const perMonth = calcPage.querySelector("[data-calc-per-month]");
    const search = calcPage.querySelector("[data-calc-search]");
    const clear = calcPage.querySelector("[data-calc-clear]");

    const compact = (n) => {
      if (!Number.isFinite(n) || n === 0) return "$0";
      const units = [[1e15, "Q"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
      for (const [size, suffix] of units) {
        if (Math.abs(n) >= size) {
          const v = n / size;
          return `$${Number.isInteger(v) ? v : v.toFixed(v < 10 ? 2 : 1)}${suffix}`;
        }
      }
      return `$${Math.round(n)}`;
    };

    const update = () => {
      let total = 0;
      let count = 0;
      for (const box of boxes) {
        if (box.checked) {
          total += Number(box.dataset.mps) || 0;
          count += 1;
        }
      }
      if (counter) counter.textContent = `${count} selected`;
      if (perSec) perSec.textContent = `${compact(total)}/s`;
      if (perDay) perDay.textContent = compact(total * 86400);
      if (perMonth) perMonth.textContent = compact(total * 2592000);
    };

    boxes.forEach((box) => box.addEventListener("change", update));

    search?.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      for (const box of boxes) {
        const label = box.closest("label");
        const hit = !q || label.textContent.toLowerCase().includes(q);
        label.parentElement.hidden = !hit;
      }
    });

    clear?.addEventListener("click", () => {
      boxes.forEach((box) => {
        box.checked = false;
      });
      update();
    });

    update();
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function escapeAttr(value) {
    return escapeText(value);
  }
})();
