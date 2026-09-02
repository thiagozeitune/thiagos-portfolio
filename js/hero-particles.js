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
  var particleCount = 18;
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
  var sectionBoundsPad = 10;
  var rafId = 0;
  var time = 0;
  var particlesReady = false;
  var heroRect = { left: 0, top: 0, right: 0, bottom: 0 };
  var textZone = { left: 0, top: 0, width: 0, height: 0 };
  var navRect = { left: 0, top: 0, right: 0, bottom: 0 };
  var navEl = hero.querySelector(".nav");
  var heroInView = true;
  var loopActive = false;
  var cursorLoopActive = false;
  var cursorRafId = 0;
  var liteMode = false;
  var batteryLite = false;
  var slowFrameStreak = 0;
  var goodFrameStreak = 0;
  var lastFrameTime = 0;
  var lastStepTime = 0;
  var targetFps = 60;
  var liteTargetFps = 30;
  var fullParticleCount = particleCount;
  var liteParticleCount = 10;
  var ripples = [];

  function syncLayoutCache() {
    var rect = hero.getBoundingClientRect();
    var navBounds;
    heroRect.left = rect.left;
    heroRect.top = rect.top;
    heroRect.right = rect.right;
    heroRect.bottom = rect.bottom;
    textZone = getTextZone();

    if (navEl) {
      navBounds = navEl.getBoundingClientRect();
      navRect.left = navBounds.left;
      navRect.top = navBounds.top;
      navRect.right = navBounds.right;
      navRect.bottom = navBounds.bottom;
    }
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function heroCoords(clientX, clientY) {
    return {
      x: clientX - heroRect.left,
      y: clientY - heroRect.top
    };
  }

  function isPointInHero(clientX, clientY) {
    return (
      clientX >= heroRect.left &&
      clientX <= heroRect.right &&
      clientY >= heroRect.top &&
      clientY <= heroRect.bottom
    );
  }

  function getTextZone() {
    var heading = hero.querySelector(".heading-1");
    var pad = 40;
    var rect;

    if (heading) {
      rect = heading.getBoundingClientRect();
      return {
        left: rect.left - heroRect.left - pad,
        top: rect.top - heroRect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2
      };
    }

    var zoneWidth = Math.min(width * 0.68, 820);
    var zoneHeight = Math.min(height * 0.42, 280);
    return {
      left: (width - zoneWidth) / 2,
      top: (height - zoneHeight) / 2,
      width: zoneWidth,
      height: zoneHeight
    };
  }

  function isInsideSection(x, y, pad) {
    var inset = pad == null ? sectionBoundsPad : pad;
    return x >= inset && x <= width - inset && y >= inset && y <= height - inset;
  }

  function clampInsideSection(p, pad) {
    var inset = pad == null ? sectionBoundsPad : pad;

    if (p.x < inset) {
      p.x = inset;
      p.vx *= -0.55;
    } else if (p.x > width - inset) {
      p.x = width - inset;
      p.vx *= -0.55;
    }

    if (p.y < inset) {
      p.y = inset;
      p.vy *= -0.55;
    } else if (p.y > height - inset) {
      p.y = height - inset;
      p.vy *= -0.55;
    }
  }

  function isInTextZone(x, y) {
    return (
      x >= textZone.left &&
      x <= textZone.left + textZone.width &&
      y >= textZone.top &&
      y <= textZone.top + textZone.height
    );
  }

  function isInCenterZone(x, y) {
    var cx = width * 0.5;
    var cy = height * 0.5;
    var rw = Math.min(width * 0.46, 620);
    var rh = Math.min(height * 0.42, 320);
    var dx = (x - cx) / rw;
    var dy = (y - cy) / rh;
    return dx * dx + dy * dy <= 1;
  }

  function isBlockedSpawnZone(x, y) {
    return isInTextZone(x, y) || isInCenterZone(x, y);
  }

  function randomSpawnPoint() {
    var pad = sectionBoundsPad + 10;
    var roll = Math.random();

    if (roll < 0.16) {
      return {
        x: rand(width * 0.56, width - pad),
        y: rand(pad, height * 0.44)
      };
    }

    if (roll < 0.32) {
      return {
        x: rand(pad, width * 0.44),
        y: rand(height * 0.56, height - pad)
      };
    }

    return {
      x: rand(pad, width - pad),
      y: rand(pad, height - pad)
    };
  }

  function isCursorInTextZone() {
    return mouse.inHero && isInTextZone(cursor.x, cursor.y);
  }

  function isCursorInNavZone() {
    var pad = 12;
    if (!navEl) return false;
    return (
      mouse.clientX >= navRect.left - pad &&
      mouse.clientX <= navRect.right + pad &&
      mouse.clientY >= navRect.top - pad &&
      mouse.clientY <= navRect.bottom + pad
    );
  }

  function shouldReleaseConnections() {
    return !mouse.inHero || isCursorInNavZone();
  }

  function keepOutOfTextZone(p) {
    var pad = p.r * 2.2;
    var left = textZone.left - pad;
    var right = textZone.left + textZone.width + pad;
    var top = textZone.top - pad;
    var bottom = textZone.top + textZone.height + pad;
    var cx;
    var cy;

    if (p.x <= left || p.x >= right || p.y <= top || p.y >= bottom) return;

    cx = textZone.left + textZone.width / 2;
    cy = textZone.top + textZone.height / 2;

    if (Math.abs(p.x - cx) / (textZone.width / 2 + pad) > Math.abs(p.y - cy) / (textZone.height / 2 + pad)) {
      p.x = p.x < cx ? left : right;
      p.vx = p.x < cx ? -Math.abs(p.vx) * 0.35 : Math.abs(p.vx) * 0.35;
    } else {
      p.y = p.y < cy ? top : bottom;
      p.vy = p.y < cy ? -Math.abs(p.vy) * 0.35 : Math.abs(p.vy) * 0.35;
    }
  }

  function createRandomPositions(count) {
    var positions = [];
    var minDist = Math.min(width, height) / (Math.sqrt(count) * 4.5);
    var minDistSq = minDist * minDist;
    var i;
    var j;
    var point;
    var x;
    var y;
    var attempts;
    var ok;
    var dx;
    var dy;

    for (i = 0; i < count; i += 1) {
      attempts = 0;
      ok = false;

      while (attempts < 55) {
        point = randomSpawnPoint();
        x = point.x;
        y = point.y;
        attempts += 1;

        if (isBlockedSpawnZone(x, y)) continue;

        ok = true;
        for (j = 0; j < positions.length; j += 1) {
          dx = x - positions[j].x;
          dy = y - positions[j].y;
          if (dx * dx + dy * dy < minDistSq) {
            ok = false;
            break;
          }
        }

        if (ok) break;
      }

      if (!ok) {
        attempts = 0;
        while (attempts < 80) {
          point = randomSpawnPoint();
          x = point.x;
          y = point.y;
          attempts += 1;
          if (!isBlockedSpawnZone(x, y)) {
            ok = true;
            break;
          }
        }
      }

      if (!ok) {
        x = rand(20, width - 20);
        y = rand(20, height * 0.16);
      }

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
    return !isInsideSection(p.x, p.y, sectionBoundsPad);
  }

  function launchShootingStar(p, initialDelay) {
    var speed = rand(1.35, 2.05);
    var angle;
    var pad = sectionBoundsPad + 12;

    p.isStar = true;
    p.x = rand(pad, width - pad);
    p.y = rand(pad, height - pad);
    angle = rand(0, Math.PI * 2);
    p.homeX = p.x;
    p.homeY = p.y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.r = rand(1.2, 1.95);
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
    ripples = [];
    var target = liteMode ? liteParticleCount : fullParticleCount;
    var count = Math.round(target * Math.min(1, width / 900));
    count = Math.max(liteMode ? 8 : 14, count);
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
        r: rand(1.25, 2.05),
        phase: rand(0, Math.PI * 2),
        driftRate: driftRate,
        driftAmp: rand(0.0045, 0.01) * (0.85 + driftRate * 0.12),
        connected: false,
        restLength: 0,
        linkAnim: 0,
        nextBlink: rand(10, 28),
        blinkUntil: 0,
        blinkPeak: 0
      });
    }

    if (!liteMode) createShootingStars();
  }

  function applyCanvasScale() {
    dpr = liteMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    applyCanvasScale();
    syncLayoutCache();
    createParticles();
  }

  function releaseAllConnections() {
    var i;
    var p;
    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      p.connected = false;
      p.linkAnim = 0;
      if (p.isStar && p.active) deactivateShootingStar(p);
    }
  }

  function setLiteMode(on) {
    if (liteMode === !!on) return;
    liteMode = !!on;
    releaseAllConnections();
    applyCanvasScale();
    createParticles();
  }

  function updateQuality(dt) {
    var slowThreshold = liteMode ? 45 : 36;
    var goodThreshold = liteMode ? 34 : 20;

    if (dt > slowThreshold) {
      slowFrameStreak += 1;
      goodFrameStreak = 0;
    } else if (dt < goodThreshold) {
      goodFrameStreak += 1;
      slowFrameStreak = Math.max(0, slowFrameStreak - 1);
    } else {
      slowFrameStreak = Math.max(0, slowFrameStreak - 1);
      goodFrameStreak = Math.max(0, goodFrameStreak - 1);
    }

    if (!liteMode && (batteryLite || slowFrameStreak >= 10)) {
      setLiteMode(true);
      return;
    }

    if (liteMode && !batteryLite && goodFrameStreak >= 90) {
      setLiteMode(false);
    }
  }

  function watchBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(function (battery) {
      function syncBattery() {
        batteryLite = !battery.charging && battery.level <= 0.3;
        if (batteryLite) setLiteMode(true);
        else if (liteMode && goodFrameStreak >= 90) setLiteMode(false);
      }
      battery.addEventListener("levelchange", syncBattery);
      battery.addEventListener("chargingchange", syncBattery);
      syncBattery();
    }).catch(function () {
      /* unsupported / denied */
    });
  }

  function setRingPosition(x, y) {
    ring.style.left = x + "px";
    ring.style.top = y + "px";
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

  function enforceSingleConnection() {
    var best = null;
    var bestDist = Infinity;
    var i;
    var p;
    var dx;
    var dy;
    var dist;

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (p.isStar || !p.connected) continue;

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
      if (!p.isStar && p.connected && p !== best) {
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
    var cx;
    var cy;
    var dx;
    var dy;
    var dist;

    if (p.connected || !isInTextZone(p.x, p.y)) return;

    cx = textZone.left + textZone.width / 2;
    cy = textZone.top + textZone.height / 2;
    dx = p.x - cx;
    dy = p.y - cy;
    dist = Math.sqrt(dx * dx + dy * dy) || 1;
    p.vx += (dx / dist) * 0.055;
    p.vy += (dy / dist) * 0.055;
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

      if (p.isStar) {
        p.connected = false;
        p.linkAnim = 0;
        continue;
      }

      if (shouldReleaseConnections() || liteMode) {
        p.connected = false;
        p.linkAnim = 0;
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

    if (mouse.inHero && !liteMode && isCursorInTextZone()) {
      enforceSingleConnection();
    }
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

      if (!p.isStar) keepOutOfTextZone(p);

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

      clampInsideSection(p);
    }
  }

  function drawSimpleDot(p, alpha) {
    var blink = blinkAmount(p);
    var connected = p.connected ? 1 : 0;
    var r;
    var g;
    var b;
    var a = alpha;

    if (connected) {
      r = 255;
      g = 0;
      b = 170;
      a = alpha * (0.55 + 0.18 * blink);
    } else {
      r = 29;
      g = 29;
      b = 29;
      a = alpha * (0.45 + 0.22 * blink);
    }

    ctx.beginPath();
    ctx.fillStyle = "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
    ctx.arc(p.x, p.y, Math.max(0.95, p.r * (0.9 + 0.06 * blink)), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGreyGlow(p, core, mid, edge, scale) {
    var radius = Math.max(0.95, p.r * Math.min(scale, 1.15) * 0.92);
    ctx.beginPath();
    ctx.fillStyle = "rgba(29, 29, 29, " + core + ")";
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMagentaGlow(p, core, mid, edge, scale, alpha) {
    var radius = Math.max(0.95, p.r * Math.min(scale, 1.15) * 0.92);
    var a = alpha == null ? 1 : alpha;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 0, 170, " + core * a + ")";
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function spawnBlinkRipples(p) {
    var i;
    var rings;
    if (liteMode || !p) return;
    rings = 2 + Math.floor(rand(0, 1.999));
    for (i = 0; i < rings; i += 1) {
      ripples.push({
        particle: p,
        born: time + i * 0.14,
        life: rand(1.15, 1.7),
        maxRadius: rand(52, 96),
        lineWidth: rand(1.05, 1.7)
      });
    }
  }

  function pruneRipples() {
    var alive = [];
    var i;
    var ripple;
    var age;
    for (i = 0; i < ripples.length; i += 1) {
      ripple = ripples[i];
      age = time - ripple.born;
      if (age < ripple.life && ripple.particle) alive.push(ripple);
    }
    ripples = alive;
  }

  function drawRipples() {
    var i;
    var ripple;
    var age;
    var t;
    var radius;
    var alpha;
    var eased;
    var x;
    var y;
    var stroke;

    if (!ripples.length || liteMode) return;

    for (i = 0; i < ripples.length; i += 1) {
      ripple = ripples[i];
      if (!ripple.particle) continue;
      age = time - ripple.born;
      if (age < 0) continue;
      t = age / ripple.life;
      if (t >= 1) continue;

      eased = 1 - Math.pow(1 - t, 2.2);
      radius = ripple.maxRadius * eased;
      alpha = (1 - t) * (1 - t) * 0.22;
      x = ripple.particle.x;
      y = ripple.particle.y;
      stroke = ripple.particle.connected
        ? "rgba(255, 0, 170, " + alpha + ")"
        : "rgba(29, 29, 29, " + alpha + ")";

      ctx.beginPath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = ripple.lineWidth * (1 - t * 0.55);
      ctx.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function blinkAmount(p) {
    var start;
    var rise;
    var fall;
    if (!p || p.isStar) return 0;

    if (time >= p.nextBlink && time >= p.blinkUntil) {
      rise = rand(0.18, 0.32);
      fall = rand(0.35, 0.65);
      p.blinkPeak = time + rise;
      p.blinkUntil = p.blinkPeak + fall;
      p.nextBlink = p.blinkUntil + rand(16, 38);
      spawnBlinkRipples(p);
    }

    if (!p.blinkPeak || time >= p.blinkUntil) return 0;

    start = p.blinkPeak - (p.blinkUntil - p.blinkPeak) * 0.55;
    if (time < start) return 0;

    if (time <= p.blinkPeak) {
      return Math.max(0, Math.min(1, (time - start) / Math.max(0.08, p.blinkPeak - start)));
    }

    return Math.max(0, Math.min(1, (p.blinkUntil - time) / Math.max(0.08, p.blinkUntil - p.blinkPeak)));
  }

  function drawSoftParticle(p) {
    var blink;
    var core;

    if (liteMode) {
      drawSimpleDot(p, 0.42);
      return;
    }

    blink = blinkAmount(p);

    if (p.connected) {
      core = 0.55 + 0.12 * blink;
      drawMagentaGlow(p, core, 0.28, 0.08, 1.05 + 0.04 * blink, 1);
    } else {
      core = 0.38 + 0.16 * blink;
      drawGreyGlow(p, core, 0.22, 0.065, 1.02 + 0.04 * blink);
    }

    if (p.linkAnim > 0) {
      if (p.connected) {
        ctx.globalAlpha = p.linkAnim * 0.85;
        drawMagentaGlow(p, 0.78, 0.585, 0.2, 1.03 + 0.03 * blink, 1);
      } else {
        ctx.globalAlpha = p.linkAnim * 0.75;
        drawGreyGlow(p, 0.72, 0.585, 0.2, 1.03);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawShootingStar(p) {
    if (!p.active || liteMode) return;

    drawGreyGlow(p, 0.73, 0.27, 0.08, 1.11);

    if (p.linkAnim > 0) {
      ctx.globalAlpha = p.linkAnim;
      drawGreyGlow(p, 0.98, 0.585, 0.2, 1.11);
      ctx.globalAlpha = 1;
    }
  }

  function drawConnectionLine(p, anchorX, anchorY, strength) {
    var endX = anchorX + (p.x - anchorX) * p.linkAnim;
    var endY = anchorY + (p.y - anchorY) * p.linkAnim;
    var alpha = 0.12 + 0.18 * strength;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(29, 29, 29, " + alpha + ")";
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
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (!isInsideSection(p.x, p.y, 0)) continue;
      if (isInTextZone(p.x, p.y) && !p.isStar) continue;
      if (p.isStar) {
        drawShootingStar(p);
      } else {
        drawSoftParticle(p);
      }
    }

    pruneRipples();
    drawRipples();

    if (mouse.inHero && !isCursorInNavZone() && !liteMode) {
      for (k = 0; k < particles.length; k += 1) {
        p = particles[k];
        if (p.isStar || !p.connected) continue;

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

    ctx.restore();
  }

  function revealParticles() {
    if (particlesReady) return;
    particlesReady = true;
    if (particlesLayer) particlesLayer.classList.add("is-revealed");
    startLoop();
  }

  function stopCursorLoop() {
    if (cursorRafId) window.cancelAnimationFrame(cursorRafId);
    cursorRafId = 0;
    cursorLoopActive = false;
  }

  function startCursorLoop() {
    if (cursorLoopActive || loopActive || document.hidden || !mouse.visible) return;
    cursorLoopActive = true;
    cursorRafId = window.requestAnimationFrame(cursorLoop);
  }

  function cursorLoop() {
    cursorRafId = 0;
    if (document.hidden || !mouse.visible || loopActive) {
      cursorLoopActive = false;
      return;
    }

    updateCursorMotion();
    cursorRafId = window.requestAnimationFrame(cursorLoop);
  }

  function stopLoop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    loopActive = false;
    releaseAllConnections();
    startCursorLoop();
  }

  function startLoop() {
    if (loopActive || document.hidden || !heroInView) return;
    stopCursorLoop();
    loopActive = true;
    lastFrameTime = performance.now();
    lastStepTime = 0;
    rafId = window.requestAnimationFrame(loop);
  }

  function loop(now) {
    var dt;
    var stepDt;
    var interval;

    rafId = 0;
    if (document.hidden || !heroInView) {
      loopActive = false;
      startCursorLoop();
      return;
    }

    now = now || performance.now();
    dt = lastFrameTime ? now - lastFrameTime : 16;
    lastFrameTime = now;

    updateCursorMotion();

    // Cap only in lite mode; full quality follows the display refresh.
    interval = liteMode ? 1000 / liteTargetFps : 1000 / targetFps;
    if (liteMode && lastStepTime && now - lastStepTime < interval) {
      rafId = window.requestAnimationFrame(loop);
      return;
    }

    stepDt = lastStepTime ? now - lastStepTime : interval;
    lastStepTime = now;
    updateQuality(stepDt);

    time += stepDt * 0.00048;
    syncLayoutCache();

    if (particlesReady) {
      updateParticles();
      draw();
    }

    rafId = window.requestAnimationFrame(loop);
  }

  document.addEventListener("pointermove", function (event) {
    mouse.clientX = event.clientX;
    mouse.clientY = event.clientY;

    if (!mouse.visible) {
      mouse.visible = true;
      cursorClient.x = event.clientX;
      cursorClient.y = event.clientY;
      ring.classList.add("is-visible");
    }

    if (heroInView) {
      if (!loopActive) startLoop();
    } else {
      startCursorLoop();
    }
  });

  document.documentElement.addEventListener("pointerleave", function () {
    mouse.visible = false;
    mouse.inHero = false;
    ring.classList.remove("is-visible");
    stopCursorLoop();
  });

  window.addEventListener("resize", resize);
  resize();
  watchBattery();
  revealParticles();
  startLoop();

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopCursorLoop();
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      loopActive = false;
      releaseAllConnections();
      return;
    }
    if (heroInView) startLoop();
    else startCursorLoop();
  });

  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver(
      function (entries) {
        var entry = entries[0];
        heroInView = !!(entry && entry.isIntersecting && entry.intersectionRatio > 0.02);
        if (heroInView) startLoop();
        else stopLoop();
      },
      { threshold: [0, 0.02, 0.1, 0.25] }
    ).observe(hero);
  }
})();
