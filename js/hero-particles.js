(function () {
  var hero = document.getElementById("HomeHero");
  var canvas = hero && hero.querySelector(".hero-particles");
  var particlesLayer = hero && hero.querySelector(".hero-particles-layer");
  var ring = document.querySelector(".hero-cursor-ring");
  if (!hero || !canvas || !ring) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var particles = [];
  var width = 0;
  var height = 0;
  var dpr = 1;
  var mouse = { clientX: 0, clientY: 0, inHero: false, visible: false };
  var cursor = { x: 0, y: 0 };
  var cursorClient = { x: 0, y: 0 };
  var cursorMove = { x: 0, y: 0, speed: 0, moving: false };
  var connectRadius = 200;
  var disconnectRadius = 228;
  var driftOrbit = 190;
  var cursorExclusionRadius = 22;
  var cursorVisualRadius = 8;
  var particleCount = 28;
  var shootingStarCount = 1;
  var elasticStrength = 0.068;
  var minRestLengthFloor = 88;
  var moveThreshold = 0.35;
  var restoreStrength = 0.004;
  var maxPullSpeed = 0.95;
  var maxDriftSpeed = 0.11;
  var pullDamping = 0.992;
  var driftDamping = 0.996;
  var linkAnimSpeed = 0.05;
  var rafId = 0;
  var time = 0;
  var particlesReady = false;
  var heroRingColor = "#9fcc19";
  var activeBlendSection = null;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function heroCoords(clientX, clientY) {
    var rect = hero.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function isPointInHero(clientX, clientY) {
    var rect = hero.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function getTextZone() {
    var zoneWidth = Math.min(width * 0.68, 820);
    var zoneHeight = Math.min(height * 0.42, 280);
    return {
      left: (width - zoneWidth) / 2,
      top: (height - zoneHeight) / 2,
      width: zoneWidth,
      height: zoneHeight
    };
  }

  function isInTextZone(x, y) {
    var zone = getTextZone();
    return (
      x >= zone.left &&
      x <= zone.left + zone.width &&
      y >= zone.top &&
      y <= zone.top + zone.height
    );
  }

  function createRandomPositions(count) {
    var positions = [];
    var minDist = Math.min(width, height) / (Math.sqrt(count) * 2.4);
    var minDistSq = minDist * minDist;
    var i;
    var j;
    var x;
    var y;
    var attempts;
    var ok;
    var dx;
    var dy;

    for (i = 0; i < count; i += 1) {
      attempts = 0;

      do {
        ok = true;
        x = rand(0, width);
        y = rand(0, height);

        if (isInTextZone(x, y)) {
          ok = false;
        } else {
          for (j = 0; j < positions.length; j += 1) {
            dx = x - positions[j].x;
            dy = y - positions[j].y;
            if (dx * dx + dy * dy < minDistSq) {
              ok = false;
              break;
            }
          }
        }

        attempts += 1;
      } while (!ok && attempts < 70);

      positions.push({ x: x, y: y });
    }

    return positions;
  }

  function deactivateShootingStar(p) {
    p.active = false;
    p.connected = false;
    p.linkAnim = 0;
    p.cooldown = rand(3200, 9800);
  }

  function shootingStarExited(p) {
    return (
      p.x < -80 ||
      p.x > width + 80 ||
      p.y < -80 ||
      p.y > height + 80
    );
  }

  function launchShootingStar(p, initialDelay) {
    var speed = rand(1.35, 2.05);
    var angle;
    var x;
    var y;

    if (Math.random() > 0.5) {
      x = -24;
      y = rand(height * 0.06, height * 0.72);
      angle = rand(0.08, 0.62);
    } else {
      x = rand(width * 0.04, width * 0.82);
      y = -24;
      angle = rand(0.72, 1.28);
    }

    p.isStar = true;
    p.x = x;
    p.y = y;
    p.homeX = x;
    p.homeY = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.r = rand(1.55, 2.5);
    p.phase = rand(0, Math.PI * 2);
    p.driftRate = 1;
    p.driftAmp = 0;
    p.active = !initialDelay;
    p.cooldown = initialDelay || 0;
    p.connected = false;
    p.restLength = 0;
    p.linkAnim = 0;
  }

  function createShootingStars() {
    var i;
    for (i = 0; i < shootingStarCount; i += 1) {
      var star = {
        x: 0,
        y: 0,
        homeX: 0,
        homeY: 0,
        vx: 0,
        vy: 0,
        r: 1.2,
        phase: 0,
        driftRate: 1,
        driftAmp: 0,
        connected: false,
        restLength: 0,
        linkAnim: 0
      };
      launchShootingStar(star, rand(800, 6200) + i * 1400);
      particles.push(star);
    }
  }

  function createParticles() {
    particles = [];
    var count = Math.round(particleCount * Math.min(1, width / 900));
    count = Math.max(20, count);
    var positions = createRandomPositions(count);

    for (var i = 0; i < count; i += 1) {
      var pos = positions[i];
      var driftRate = rand(0.62, 1.38);
      particles.push({
        x: pos.x,
        y: pos.y,
        homeX: pos.x,
        homeY: pos.y,
        vx: rand(-0.04, 0.04) * driftRate,
        vy: rand(-0.04, 0.04) * driftRate,
        r: rand(1.6, 2.7),
        phase: rand(0, Math.PI * 2),
        driftRate: driftRate,
        driftAmp: rand(0.0045, 0.01) * (0.85 + driftRate * 0.12),
        isSquare: Math.random() < 0.32,
        connected: false,
        restLength: 0,
        linkAnim: 0
      });
    }

    createShootingStars();
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createParticles();
  }

  function setRingPosition(x, y) {
    ring.style.left = x + "px";
    ring.style.top = y + "px";
  }

  function parseRgb(color) {
    var match = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!match) return null;
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3])
    };
  }

  function getBackgroundRgb(el) {
    var node = el;
    var bg;
    var rgb;

    while (node && node !== document.documentElement) {
      bg = window.getComputedStyle(node).backgroundColor;
      rgb = parseRgb(bg);
      if (rgb && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return rgb;
      node = node.parentElement;
    }

    return { r: 255, g: 255, b: 255 };
  }

  function isHeroSection(section) {
    return section && section.id === "HomeHero";
  }

  function rgbToCss(rgb) {
    return "rgb(" + Math.round(rgb.r) + ", " + Math.round(rgb.g) + ", " + Math.round(rgb.b) + ")";
  }

  function getSectionAt(clientX, clientY) {
    var elements = document.elementsFromPoint(clientX, clientY);
    var i;
    var el;

    for (i = 0; i < elements.length; i += 1) {
      el = elements[i];
      if (
        el.classList &&
        (el.classList.contains("hero-section") || el.classList.contains("home-section"))
      ) {
        return el;
      }
    }

    return null;
  }

  function updateRingBlendColor(clientX, clientY) {
    var section = getSectionAt(clientX, clientY);
    var bg;

    if (!section) section = hero;
    if (section === activeBlendSection) return;

    activeBlendSection = section;
    bg = getBackgroundRgb(section);

    if (isHeroSection(section)) {
      ring.style.backgroundColor = heroRingColor;
      ring.style.filter = "none";
      ring.style.mixBlendMode = "difference";
      return;
    }

    ring.style.backgroundColor = rgbToCss(bg);
    ring.style.filter = "invert(1)";
    ring.style.mixBlendMode = "normal";
  }

  function clampSpeed(particle, limit) {
    var speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
    if (speed > limit) {
      particle.vx = (particle.vx / speed) * limit;
      particle.vy = (particle.vy / speed) * limit;
    }
  }

  function updateCursorMotion() {
    var coords;
    var prevHeroX;
    var prevHeroY;

    if (!mouse.visible) {
      cursorMove.x = 0;
      cursorMove.y = 0;
      cursorMove.speed = 0;
      cursorMove.moving = false;
      return;
    }

    prevHeroX = cursor.x;
    prevHeroY = cursor.y;

    cursorClient.x += (mouse.clientX - cursorClient.x) * 0.04;
    cursorClient.y += (mouse.clientY - cursorClient.y) * 0.04;
    setRingPosition(cursorClient.x, cursorClient.y);
    updateRingBlendColor(mouse.clientX, mouse.clientY);

    mouse.inHero = isPointInHero(mouse.clientX, mouse.clientY);

    if (mouse.inHero) {
      coords = heroCoords(cursorClient.x, cursorClient.y);
      cursor.x = coords.x;
      cursor.y = coords.y;
      cursorMove.x = cursor.x - prevHeroX;
      cursorMove.y = cursor.y - prevHeroY;
      cursorMove.speed = Math.sqrt(cursorMove.x * cursorMove.x + cursorMove.y * cursorMove.y);
      cursorMove.moving = cursorMove.speed > moveThreshold;
      return;
    }

    cursorMove.x = 0;
    cursorMove.y = 0;
    cursorMove.speed = 0;
    cursorMove.moving = false;
  }

  function keepOutsideCursor(p, dx, dy, dist) {
    var minDist = cursorExclusionRadius + p.r;
    if (dist >= minDist || dist === 0) return;

    var nx = dx / dist;
    var ny = dy / dist;
    p.x = cursor.x - nx * minDist;
    p.y = cursor.y - ny * minDist;
  }

  function bindParticle(p, dist) {
    p.connected = true;
    p.restLength = Math.max(minRestLengthFloor, dist);
    p.linkAnim = 0;
  }

  function enforceSingleSquareConnection() {
    var best = null;
    var bestDist = Infinity;
    var i;
    var p;
    var dx;
    var dy;
    var dist;

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (!p.isSquare || !p.connected) continue;

      dx = cursor.x - p.x;
      dy = cursor.y - p.y;
      dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }

    if (!best) return;

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (p.isSquare && p.connected && p !== best) {
        p.connected = false;
        p.linkAnim = 0;
      }
    }
  }

  function dampInwardVelocity(p, dx, dy, dist) {
    var nx;
    var ny;
    var toward;

    if (dist === 0 || dist >= p.restLength) return;

    nx = dx / dist;
    ny = dy / dist;
    toward = p.vx * nx + p.vy * ny;
    if (toward <= 0) return;

    p.vx -= nx * toward * 0.22;
    p.vy -= ny * toward * 0.22;
  }

  function applyElasticForce(p, dx, dy, dist) {
    var nx;
    var ny;
    var stretch;
    var tension;
    var awayBoost;

    if (dist === 0) return;

    nx = dx / dist;
    ny = dy / dist;
    stretch = dist - p.restLength;

    if (stretch <= 0) {
      dampInwardVelocity(p, dx, dy, dist);
      return;
    }

    tension = Math.min(stretch * elasticStrength, 0.018);

    if (cursorMove.moving && cursorMove.speed > moveThreshold) {
      awayBoost = (cursorMove.x * nx + cursorMove.y * ny) / cursorMove.speed;
      if (awayBoost > 0) {
        tension *= 1 + awayBoost * 0.65;
      }
    }

    p.vx += nx * tension;
    p.vy += ny * tension;
  }

  function applyTextZoneRepulsion(p) {
    var zone;
    var cx;
    var cy;
    var dx;
    var dy;
    var dist;

    if (p.connected || !isInTextZone(p.x, p.y)) return;

    zone = getTextZone();
    cx = zone.left + zone.width / 2;
    cy = zone.top + zone.height / 2;
    dx = p.x - cx;
    dy = p.y - cy;
    dist = Math.sqrt(dx * dx + dy * dy) || 1;
    p.vx += (dx / dist) * 0.028;
    p.vy += (dy / dist) * 0.028;
  }

  function applyNaturalDrift(p) {
    var t;
    var speed;
    var minSpeed = 0.015 * p.driftRate;

    if (p.connected) return;

    t = (time + p.phase) * p.driftRate;
    p.vx += Math.cos(t * 0.34) * p.driftAmp;
    p.vy += Math.sin(t * 0.37) * p.driftAmp;
    p.vx += Math.cos(t * 0.22 + p.phase) * p.driftAmp * 0.55;
    p.vy += Math.sin(t * 0.25 + p.phase) * p.driftAmp * 0.55;

    speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed < minSpeed) {
      p.vx += Math.cos(t * 0.72) * minSpeed * 0.075;
      p.vy += Math.sin(t * 0.72) * minSpeed * 0.075;
    }
  }

  function applyHomeForces(p) {
    var hdx = p.homeX - p.x;
    var hdy = p.homeY - p.y;
    var hdist = Math.sqrt(hdx * hdx + hdy * hdy);
    var force;

    if (hdist > driftOrbit) {
      force = Math.min((hdist - driftOrbit) * restoreStrength, 0.009);
      p.vx += (hdx / hdist) * force;
      p.vy += (hdy / hdist) * force;
    } else if (hdist > 12) {
      force = hdist * restoreStrength * 0.04;
      p.vx += (hdx / hdist) * force;
      p.vy += (hdy / hdist) * force;
    }

    applyNaturalDrift(p);
  }

  function applyForces() {
    var i;
    var p;
    var dx;
    var dy;
    var dist;

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];

      if (p.isStar && !p.active) continue;

      if (!mouse.inHero) {
        p.connected = false;
      } else {
        dx = cursor.x - p.x;
        dy = cursor.y - p.y;
        dist = Math.sqrt(dx * dx + dy * dy);

        if (p.connected) {
          if (dist > disconnectRadius) {
            p.connected = false;
          }
        } else if (dist > 0 && dist <= connectRadius) {
          bindParticle(p, dist);
        }

        if (p.connected) {
          p.linkAnim = Math.min(1, p.linkAnim + linkAnimSpeed);
          applyElasticForce(p, dx, dy, dist);
        } else {
          p.linkAnim = 0;
        }
      }

      if (!p.connected && !(p.isStar && p.active)) {
        applyHomeForces(p);
        applyTextZoneRepulsion(p);
      }
    }

    if (mouse.inHero) enforceSingleSquareConnection();
  }

  function updateParticles() {
    var i;
    var p;
    var dx;
    var dy;
    var dist;

    applyForces();

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];

      if (p.isStar && !p.active) {
        p.cooldown -= 16;
        if (p.cooldown <= 0) launchShootingStar(p, 0);
        continue;
      }

      if (p.isStar && p.active && !p.connected) {
        p.x += p.vx;
        p.y += p.vy;

        if (mouse.inHero) {
          dx = cursor.x - p.x;
          dy = cursor.y - p.y;
          dist = Math.sqrt(dx * dx + dy * dy);
          keepOutsideCursor(p, dx, dy, dist);
        }

        if (shootingStarExited(p)) deactivateShootingStar(p);
        continue;
      }

      p.vx *= p.connected ? pullDamping : driftDamping;
      p.vy *= p.connected ? pullDamping : driftDamping;
      clampSpeed(
        p,
        p.connected
          ? maxPullSpeed
          : maxDriftSpeed * (p.driftRate || 1)
      );

      p.x += p.vx;
      p.y += p.vy;

      if (mouse.inHero) {
        dx = cursor.x - p.x;
        dy = cursor.y - p.y;
        dist = Math.sqrt(dx * dx + dy * dy);
        keepOutsideCursor(p, dx, dy, dist);
      }

      if (p.isStar && p.active && shootingStarExited(p)) {
        deactivateShootingStar(p);
        continue;
      }

      if (p.isStar) continue;

      if (p.x < 0) {
        p.x = 0;
        p.vx *= -0.55;
      } else if (p.x > width) {
        p.x = width;
        p.vx *= -0.55;
      }

      if (p.y < 0) {
        p.y = 0;
        p.vy *= -0.55;
      } else if (p.y > height) {
        p.y = height;
        p.vy *= -0.55;
      }
    }
  }

  function drawSquareParticle(p) {
    var size = p.r * 1.4;
    var half = size / 2;
    var blink;
    var glow;
    var gradient;
    var pulse;

    if (p.linkAnim > 0) {
      blink = 0.5 + 0.5 * Math.sin(time * 3.2 + p.phase);
      pulse = p.linkAnim * (0.28 + 0.52 * blink);
      glow = size * (1.8 + 0.35 * blink);
      gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
      gradient.addColorStop(0, "rgba(96, 51, 230, " + pulse + ")");
      gradient.addColorStop(0.45, "rgba(96, 51, 230, " + pulse * 0.35 + ")");
      gradient.addColorStop(1, "rgba(96, 51, 230, 0)");
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(96, 51, 230, 0.32)";
    ctx.fillRect(p.x - half, p.y - half, size, size);

    if (p.linkAnim > 0) {
      ctx.globalAlpha = p.linkAnim;
      ctx.fillStyle = "rgb(96, 51, 230)";
      ctx.fillRect(p.x - half, p.y - half, size, size);
      ctx.globalAlpha = 1;
    }
  }

  function drawGreyGlow(p, core, mid, edge, scale) {
    var glow = p.r * scale;
    var gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
    gradient.addColorStop(0, "rgba(29, 29, 29, " + core + ")");
    gradient.addColorStop(0.55, "rgba(29, 29, 29, " + mid + ")");
    gradient.addColorStop(0.88, "rgba(29, 29, 29, " + edge + ")");
    gradient.addColorStop(1, "rgba(29, 29, 29, 0)");
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSoftParticle(p) {
    if (p.isSquare) {
      drawSquareParticle(p);
      return;
    }

    drawGreyGlow(p, 0.52, 0.18, 0.04, 0.92);

    if (p.linkAnim > 0) {
      ctx.globalAlpha = p.linkAnim;
      drawGreyGlow(p, 1, 0.55, 0.18, 0.92);
      ctx.globalAlpha = 1;
    }
  }

  function drawShootingStar(p) {
    if (!p.active) return;

    drawGreyGlow(p, 0.68, 0.24, 0.06, 1.02);

    if (p.linkAnim > 0) {
      ctx.globalAlpha = p.linkAnim;
      drawGreyGlow(p, 1, 0.55, 0.18, 1.02);
      ctx.globalAlpha = 1;
    }
  }

  function drawConnectionLine(p, anchorX, anchorY, strength) {
    var endX = anchorX + (p.x - anchorX) * p.linkAnim;
    var endY = anchorY + (p.y - anchorY) * p.linkAnim;
    var alpha = 0.12 + 0.18 * strength;
    var isSquare = !!p.isSquare;
    var lineR = isSquare ? 96 : 29;
    var lineG = isSquare ? 51 : 29;
    var lineB = isSquare ? 230 : 29;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(" + lineR + ", " + lineG + ", " + lineB + ", " + alpha + ")";
    ctx.lineWidth = 1;
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  function draw() {
    var i;
    var k;
    var p;
    var dx;
    var dy;
    var dist;
    var strength;
    var nx;
    var ny;
    var anchorX;
    var anchorY;

    ctx.clearRect(0, 0, width, height);

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (p.isStar) {
        drawShootingStar(p);
      } else {
        drawSoftParticle(p);
      }
    }

    if (mouse.inHero) {
      for (k = 0; k < particles.length; k += 1) {
        p = particles[k];
        if (!p.connected || (p.isStar && !p.active)) continue;

        dx = cursor.x - p.x;
        dy = cursor.y - p.y;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        nx = dx / dist;
        ny = dy / dist;
        anchorX = cursor.x - nx * cursorVisualRadius;
        anchorY = cursor.y - ny * cursorVisualRadius;
        strength = Math.min((dist - p.restLength) / connectRadius, 1);
        if (strength < 0) strength = 0;

        drawConnectionLine(p, anchorX, anchorY, strength);
      }
    }
  }

  function revealParticles() {
    if (particlesReady) return;
    particlesReady = true;
    if (particlesLayer) particlesLayer.classList.add("is-revealed");
  }

  function loop() {
    time += 0.008;
    updateCursorMotion();

    if (particlesReady) {
      updateParticles();
      draw();
    }

    rafId = window.requestAnimationFrame(loop);
  }

  document.addEventListener("pointermove", function (event) {
    mouse.clientX = event.clientX;
    mouse.clientY = event.clientY;
    updateRingBlendColor(event.clientX, event.clientY);

    if (!mouse.visible) {
      mouse.visible = true;
      cursorClient.x = event.clientX;
      cursorClient.y = event.clientY;
      ring.classList.add("is-visible");
    }
  });

  document.documentElement.addEventListener("pointerleave", function () {
    mouse.visible = false;
    mouse.inHero = false;
    ring.classList.remove("is-visible");
  });

  window.addEventListener("resize", resize);
  resize();
  ring.classList.add("is-ready");
  loop();

  document.addEventListener("hero-typewriter-complete", revealParticles);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      window.cancelAnimationFrame(rafId);
      return;
    }
    loop();
  });
})();
