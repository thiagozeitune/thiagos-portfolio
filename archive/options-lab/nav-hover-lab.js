(function () {
  var lab = document.querySelector(".nav-hover-lab");
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-menu .nav-link"));
  if (!lab || !links.length) return;

  var options = Array.prototype.slice.call(lab.querySelectorAll("[data-nav-hover]"));
  var storageKey = "nav-hover-style";
  var modes = ["stagger", "wave", "scatter", "flip", "scramble"];
  var current = "stagger";
  var effectCleanups = [];
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function unwrapChars(link) {
    if (!link.dataset.navWrapped) return;
    link.textContent = link.dataset.navLabel || link.textContent;
    delete link.dataset.navWrapped;
    link.classList.remove("is-hot");
  }

  function wrapChars(link, mode) {
    var label = link.dataset.navLabel || link.textContent;
    var frag = document.createDocumentFragment();
    var i;
    var char;
    var outer;
    var inner;

    link.dataset.navLabel = label;
    link.textContent = "";

    for (i = 0; i < label.length; i += 1) {
      char = label.charAt(i);
      outer = document.createElement("span");
      outer.className = "nav-char";
      outer.style.setProperty("--i", String(i));
      if (mode === "wave") {
        outer.style.setProperty("--wy", (Math.sin(i * 0.9) * -8).toFixed(1) + "px");
      }
      outer.setAttribute("aria-hidden", "true");

      if (mode === "flip") {
        inner = document.createElement("span");
        inner.className = "nav-char-inner";

        var faceA = document.createElement("span");
        faceA.className = "nav-char-face is-soft";
        faceA.textContent = char === " " ? "\u00a0" : char;

        var gap = document.createElement("span");
        gap.className = "nav-char-gap";
        gap.setAttribute("aria-hidden", "true");

        var faceB = document.createElement("span");
        faceB.className = "nav-char-face is-dark";
        faceB.textContent = char === " " ? "\u00a0" : char;

        inner.appendChild(faceA);
        inner.appendChild(gap);
        inner.appendChild(faceB);
        outer.appendChild(inner);
      } else {
        outer.textContent = char === " " ? "\u00a0" : char;
      }

      frag.appendChild(outer);
    }

    link.appendChild(frag);
    link.setAttribute("aria-label", label);
    link.dataset.navWrapped = mode;
  }

  function clearEffects() {
    effectCleanups.forEach(function (cleanup) {
      cleanup();
    });
    effectCleanups = [];
  }

  function resetCharVars(chars) {
    chars.forEach(function (char) {
      char.style.removeProperty("--sx");
      char.style.removeProperty("--sy");
      char.style.removeProperty("--sr");
      char.style.removeProperty("--ss");
      char.style.removeProperty("--so");
    });
  }

  function bindScatter(link) {
    var chars = Array.prototype.slice.call(link.querySelectorAll(".nav-char"));

    function onEnter() {
      chars.forEach(function (char) {
        char.style.setProperty("--sx", rand(-7, 7).toFixed(1) + "px");
        char.style.setProperty("--sy", rand(-10, 4).toFixed(1) + "px");
        char.style.setProperty("--sr", rand(-18, 18).toFixed(1) + "deg");
        char.style.setProperty("--ss", rand(0.92, 1.18).toFixed(2));
      });
      link.classList.add("is-hot");
    }

    function onLeave() {
      link.classList.remove("is-hot");
      window.setTimeout(function () {
        if (!link.classList.contains("is-hot")) resetCharVars(chars);
      }, 420);
    }

    link.addEventListener("pointerenter", onEnter);
    link.addEventListener("pointerleave", onLeave);
    effectCleanups.push(function () {
      link.removeEventListener("pointerenter", onEnter);
      link.removeEventListener("pointerleave", onLeave);
      link.classList.remove("is-hot");
      resetCharVars(chars);
    });
  }

  function bindScramble(link) {
    var chars = Array.prototype.slice.call(link.querySelectorAll(".nav-char"));
    var timers = [];

    function clearTimers() {
      timers.forEach(function (id) {
        window.clearTimeout(id);
      });
      timers = [];
    }

    function onEnter() {
      clearTimers();
      chars.forEach(function (char, index) {
        char.style.setProperty("--sx", rand(-10, 10).toFixed(1) + "px");
        char.style.setProperty("--sy", rand(-12, 8).toFixed(1) + "px");
        char.style.setProperty("--sr", rand(-24, 24).toFixed(1) + "deg");
        char.style.setProperty("--so", "0.35");
        timers.push(
          window.setTimeout(function () {
            char.style.setProperty("--sx", "0px");
            char.style.setProperty("--sy", "0px");
            char.style.setProperty("--sr", "0deg");
            char.style.setProperty("--so", "1");
          }, 90 + index * 38)
        );
      });
      link.classList.add("is-hot");
    }

    function onLeave() {
      clearTimers();
      link.classList.remove("is-hot");
      resetCharVars(chars);
    }

    link.addEventListener("pointerenter", onEnter);
    link.addEventListener("pointerleave", onLeave);
    effectCleanups.push(function () {
      clearTimers();
      link.removeEventListener("pointerenter", onEnter);
      link.removeEventListener("pointerleave", onLeave);
      link.classList.remove("is-hot");
      resetCharVars(chars);
    });
  }

  function prepareMode(mode) {
    clearEffects();

    links.forEach(function (link) {
      unwrapChars(link);
      wrapChars(link, mode);

      if (mode === "scatter") bindScatter(link);
      if (mode === "scramble") bindScramble(link);
    });
  }

  function setMode(mode) {
    if (modes.indexOf(mode) === -1) mode = "stagger";
    if (reducedMotion) mode = "stagger";
    current = mode;
    document.documentElement.setAttribute("data-nav-hover", mode);
    prepareMode(mode);

    options.forEach(function (btn) {
      var active = btn.getAttribute("data-nav-hover") === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    });

    try {
      window.localStorage.setItem(storageKey, mode);
    } catch (err) {
      /* ignore */
    }
  }

  options.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setMode(btn.getAttribute("data-nav-hover"));
    });
  });

  try {
    current = window.localStorage.getItem(storageKey) || "stagger";
  } catch (err) {
    current = "stagger";
  }

  if (modes.indexOf(current) === -1) current = "stagger";
  setMode(current);
})();
