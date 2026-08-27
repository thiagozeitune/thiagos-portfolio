(function () {
  var hint = document.querySelector(".hero-scroll-hint");
  var hero = document.getElementById("HomeHero");
  if (!hint || !hero) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hidden = false;

  function hideHint() {
    if (hidden) return;
    hidden = true;
    hint.classList.remove("is-visible");
    hint.classList.add("is-hidden");
  }

  function showHint() {
    if (hidden) return;
    hint.classList.add("is-visible");
  }

  function onScroll() {
    if (window.scrollY > hero.offsetHeight * 0.12) hideHint();
  }

  hint.addEventListener("click", function (event) {
    var target = document.getElementById("First-Work");
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    hideHint();
  });

  document.addEventListener("hero-typewriter-complete", function () {
    setTimeout(showHint, reducedMotion ? 0 : 1200);
  });

  window.addEventListener("scroll", onScroll, { passive: true });

  if (reducedMotion || document.querySelector(".hero-caret.is-done")) {
    showHint();
  }
})();
