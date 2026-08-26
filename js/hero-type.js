(function () {
  var typewriter = document.querySelector(".hero-typewriter");
  var caret = document.querySelector(".hero-caret");
  if (!typewriter) return;

  var parts = [
    { type: "text", value: "Hi there! I'm Thiago" },
    { type: "span", className: "avoid-name-break", value: "_" },
    { type: "text", value: "Zeitune." },
    { type: "br" },
    { type: "text", value: "I am a " },
    { type: "underline", value: "designer" },
    { type: "text", value: " passionate about " },
    { type: "underline", value: "bridging" },
    { type: "text", value: " gaps between great ideas and\u00a0" },
    { type: "underline", value: "people" },
    { type: "text", value: "." }
  ];

  function notifyComplete() {
    document.dispatchEvent(new CustomEvent("hero-typewriter-complete"));
  }

  function renderFull() {
    typewriter.innerHTML = "";
    parts.forEach(function (part) {
      if (part.type === "br") {
        typewriter.appendChild(document.createElement("br"));
        return;
      }
      if (part.type === "span") {
        var span = document.createElement("span");
        span.className = part.className;
        span.textContent = part.value;
        typewriter.appendChild(span);
        return;
      }
      if (part.type === "underline") {
        var underline = document.createElement("span");
        underline.className = "underline is-drawn";
        underline.textContent = part.value;
        typewriter.appendChild(underline);
        return;
      }
      typewriter.appendChild(document.createTextNode(part.value));
    });
    if (caret) caret.classList.add("is-done");
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    renderFull();
    notifyComplete();
    return;
  }

  var partIndex = 0;
  var charIndex = 0;
  var activeNode = null;
  var typingSpeed = 28;
  var pauseAfterBreak = 280;

  function appendChar(char) {
    if (!activeNode) {
      activeNode = document.createTextNode("");
      typewriter.appendChild(activeNode);
    }
    activeNode.textContent += char;
  }

  function startUnderline(word) {
    var underline = document.createElement("span");
    underline.className = "underline";
    underline.textContent = "";
    typewriter.appendChild(underline);
    activeNode = underline;
    return word;
  }

  function typeNext() {
    if (partIndex >= parts.length) {
      if (caret) caret.classList.add("is-done");
      drawUnderlines();
      return;
    }

    var part = parts[partIndex];

    if (part.type === "br") {
      typewriter.appendChild(document.createElement("br"));
      activeNode = null;
      partIndex += 1;
      charIndex = 0;
      setTimeout(typeNext, pauseAfterBreak);
      return;
    }

    if (part.type === "span" && charIndex === 0) {
      var named = document.createElement("span");
      named.className = part.className;
      named.textContent = "";
      typewriter.appendChild(named);
      activeNode = named;
    }

    if (part.type === "underline" && charIndex === 0) {
      startUnderline(part.value);
    }

    if (part.type === "text" && charIndex === 0) {
      activeNode = null;
    }

    var value = part.value || "";
    if (charIndex < value.length) {
      var nextChar = value.charAt(charIndex);
      if (part.type === "underline" || part.type === "span") {
        activeNode.textContent += nextChar;
      } else {
        appendChar(nextChar);
      }
      charIndex += 1;
      var delay = nextChar === " " ? typingSpeed * 1.4 : typingSpeed;
      if (nextChar === "." || nextChar === "!") delay = typingSpeed * 6;
      setTimeout(typeNext, delay);
      return;
    }

    partIndex += 1;
    charIndex = 0;
    activeNode = null;
    setTimeout(typeNext, typingSpeed);
  }

  function drawUnderlines() {
    var underlines = typewriter.querySelectorAll(".underline");
    var lastIndex = underlines.length - 1;

    if (lastIndex < 0) {
      notifyComplete();
      return;
    }

    underlines.forEach(function (el, index) {
      setTimeout(function () {
        el.classList.add("is-drawn");
        if (index === lastIndex) {
          setTimeout(notifyComplete, 260);
        }
      }, 180 + index * 220);
    });
  }

  setTimeout(typeNext, 350);
})();
