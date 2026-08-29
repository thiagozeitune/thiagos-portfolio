(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-menu .nav-link"));
  if (!links.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function wrapFlip(link) {
    var label = link.textContent;
    var frag = document.createDocumentFragment();
    var i;
    var char;
    var outer;
    var inner;
    var faceA;
    var gap;
    var faceB;

    link.textContent = "";

    for (i = 0; i < label.length; i += 1) {
      char = label.charAt(i);
      outer = document.createElement("span");
      outer.className = "nav-char";
      outer.style.setProperty("--i", String(i));
      outer.setAttribute("aria-hidden", "true");

      inner = document.createElement("span");
      inner.className = "nav-char-inner";

      faceA = document.createElement("span");
      faceA.className = "nav-char-face is-soft";
      faceA.textContent = char === " " ? "\u00a0" : char;

      gap = document.createElement("span");
      gap.className = "nav-char-gap";
      gap.setAttribute("aria-hidden", "true");

      faceB = document.createElement("span");
      faceB.className = "nav-char-face is-dark";
      faceB.textContent = char === " " ? "\u00a0" : char;

      inner.appendChild(faceA);
      inner.appendChild(gap);
      inner.appendChild(faceB);
      outer.appendChild(inner);
      frag.appendChild(outer);
    }

    link.appendChild(frag);
    link.setAttribute("aria-label", label.trim());
  }

  links.forEach(wrapFlip);
})();
