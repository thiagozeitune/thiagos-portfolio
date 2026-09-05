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

  // Orbit — first version feel, slowed down
  var orbitCaptureRadius = 160;
  var orbitReleaseRadius = 320;
  var maxOrbitingDots = 3;
  var orbitMinRadius = 42;
  var orbitMaxRadius = 100;
  var orbitAspect = 0.58; // < 1 = horizontal oval
  var orbitSpring = 0.04;
  var approachSpring = 0.018;
  var orbitAngularBase = 0.016;
  var orbitEngageSpeed = 0.022;
  var spinBlendSpeed = 0.018;
  var maxOrbitSpeed = 1.1;
  var approachMaxSpeed = 0.7;
  var orbitDamping = 0.9;

  var driftOrbit = 190;
  var particleCount = 12;
  var shootingStarCount = 1;
  var restoreStrength = 0.004;
  var maxDriftSpeed = 0.11;
  var driftDamping = 0.996;
  var sectionBoundsPad = 10;
  var homeReturnBoost = 0.016;

  var rafId = 0;
  var time = 0;
  var particlesReady = false;
  var heroRect = { left: 0, top: 0, right: 0, bottom: 0 };
  var textZone = { left: 0, top: 0, width: 0, height: 0 };
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
  var liteParticleCount = 7;

  function syncLayoutCache() {
    var rect = hero.getBoundingClientRect();
    heroRect.left = rect.left;
    heroRect.top = rect.top;
    heroRect.right = rect.right;
    heroRect.bottom = rect.bottom;
    textZone = getTextZone();
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function heroCoords(clientX, clientY) {
    return { x: clientX - heroRect.left, y: clientY - heroRect.top };
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

  function clampInsideSection(p) {
    var inset = sectionBoundsPad;
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
    // Keep only a modest hole around the headline area.
    var cx = width * 0.5;
    var cy = height * 0.48;
    var rw = Math.min(width * 0.3, 380);
    var rh = Math.min(height * 0.22, 160);
    var dx = (x - cx) / rw;
    var dy = (y - cy) / rh;
    return dx * dx + dy * dy <= 1;
  }

  function isBlockedSpawnZone(x, y) {
    return isInTextZone(x, y) || isInCenterZone(x, y);
  }

  function spawnRegions() {
    var pad = sectionBoundsPad + 14;
    return [
      // Top band, but stop before the nav cluster on the far right.
      { x0: pad, x1: width * 0.72, y0: pad, y1: height * 0.26, weight: 1 },
      { x0: pad, x1: width - pad, y0: height * 0.74, y1: height - pad, weight: 1 },
      { x0: pad, x1: width * 0.26, y0: height * 0.2, y1: height * 0.8, weight: 1 },
      { x0: width * 0.74, x1: width - pad, y0: height * 0.28, y1: height * 0.8, weight: 1 },
      { x0: pad, x1: width * 0.42, y0: pad, y1: height * 0.42, weight: 1 },
      // Upper-right exists, but lightly — avoid stacking under the menu.
      { x0: width * 0.58, x1: width * 0.86, y0: height * 0.14, y1: height * 0.42, weight: 0.35 },
      { x0: pad, x1: width * 0.42, y0: height * 0.58, y1: height - pad, weight: 1 },
      { x0: width * 0.58, x1: width - pad, y0: height * 0.58, y1: height - pad, weight: 1 }
    ];
  }

  function pickSpawnRegion(preferredIndex) {
    var regions = spawnRegions();
    var i;
    var total = 0;
    var roll;
    var preferred;

    preferred = regions[((preferredIndex % regions.length) + regions.length) % regions.length];
    // Usually honor round-robin, but often skip the light upper-right region.
    if (preferred.weight >= 1 || Math.random() < preferred.weight) return preferred;

    for (i = 0; i < regions.length; i += 1) total += regions[i].weight;
    roll = Math.random() * total;
    for (i = 0; i < regions.length; i += 1) {
      roll -= regions[i].weight;
      if (roll <= 0) return regions[i];
    }
    return regions[0];
  }

  function randomSpawnPoint(regionIndex) {
    var r = pickSpawnRegion(regionIndex);
    var x0 = Math.min(r.x0, r.x1);
    var x1 = Math.max(r.x0, r.x1);
    var y0 = Math.min(r.y0, r.y1);
    var y1 = Math.max(r.y0, r.y1);
    if (x1 - x0 < 8 || y1 - y0 < 8) {
      return {
        x: rand(sectionBoundsPad + 10, width - sectionBoundsPad - 10),
        y: rand(sectionBoundsPad + 10, height - sectionBoundsPad - 10)
      };
    }
    return { x: rand(x0, x1), y: rand(y0, y1) };
  }

  function shouldReleaseOrbits() {
    return !mouse.inHero;
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
    var minDist = Math.min(width, height) / (Math.sqrt(count) * 3.2);
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
    var region;

    for (i = 0; i < count; i += 1) {
      attempts = 0;
      ok = false;
      region = i;
      while (attempts < 70) {
        point = randomSpawnPoint(region + Math.floor(attempts / 8));
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
        while (attempts < 90) {
          point = randomSpawnPoint(i + attempts);
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
        y = rand(20, height - 20);
      }
      positions.push({ x: x, y: y });
    }
    return positions;
  }

  function deactivateShootingStar(p) {
    p.active = false;
    p.orbiting = false;
    p.orbitEngage = 0;
    p.cooldown = rand(3200, 9800);
  }

  function shootingStarExited(p) {
    return !isInsideSection(p.x, p.y, sectionBoundsPad);
  }

  function launchShootingStar(p, initialDelay) {
    var speed = rand(1.35, 2.05);
    var angle = rand(0, Math.PI * 2);
    var pad = sectionBoundsPad + 12;
    p.isStar = true;
    p.x = rand(pad, width - pad);
    p.y = rand(pad, height - pad);
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
    p.orbiting = false;
    p.orbitAngle = 0;
    p.orbitRadius = 0;
    p.orbitDir = 1;
    p.orbitEngage = 0;
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
        orbiting: false,
        orbitAngle: 0,
        orbitRadius: 0,
        orbitDir: 1,
        orbitEngage: 0
      };
      launchShootingStar(star, rand(800, 6200) + i * 1400);
      particles.push(star);
    }
  }

  function createParticles() {
    particles = [];
    var target = liteMode ? liteParticleCount : fullParticleCount;
    var count = Math.round(target * Math.min(1, width / 900));
    count = Math.max(liteMode ? 6 : 10, count);
    var positions = createRandomPositions(count);
    var i;
    var pos;
    var driftRate;

    for (i = 0; i < count; i += 1) {
      pos = positions[i];
      driftRate = rand(0.62, 1.38);
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
        orbiting: false,
        orbitAngle: 0,
        orbitRadius: 0,
        orbitDir: 1,
        orbitDirLocked: false,
        orbitSpinning: false,
        approachMaxDist: 0,
        spinBlend: 0,
        orbitEngage: 0,
        returningHome: false,
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

  function releaseAllOrbits() {
    var i;
    var p;
    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (p.orbiting) releaseOrbit(p);
      else {
        p.orbiting = false;
        p.orbitEngage = 0;
      }
      if (p.isStar && p.active) deactivateShootingStar(p);
    }
  }

  function setLiteMode(on) {
    if (liteMode === !!on) return;
    liteMode = !!on;
    releaseAllOrbits();
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
    if (liteMode && !batteryLite && goodFrameStreak >= 90) setLiteMode(false);
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
    }).catch(function () {});
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
    if (!mouse.visible) return;
    cursorClient.x += (mouse.clientX - cursorClient.x) * 0.18;
    cursorClient.y += (mouse.clientY - cursorClient.y) * 0.18;
    setRingPosition(cursorClient.x, cursorClient.y);
    mouse.inHero = isPointInHero(mouse.clientX, mouse.clientY);
    if (mouse.inHero) {
      var coords = heroCoords(mouse.clientX, mouse.clientY);
      cursor.x = coords.x;
      cursor.y = coords.y;
    } else {
      var ringCoords = heroCoords(cursorClient.x, cursorClient.y);
      cursor.x = ringCoords.x;
      cursor.y = ringCoords.y;
    }
  }

  function releaseOrbit(p) {
    p.orbiting = false;
    p.orbitEngage = 0;
    p.orbitDirLocked = false;
    p.orbitSpinning = false;
    p.spinBlend = 0;
    p.approachMaxDist = 0;
    p.returningHome = true;
  }

  // Screen-space cross of offset × velocity: >0 → angle increases (clockwise on screen).
  function orbitDirFromMotion(dx, dy, vx, vy) {
    return dx * vy - dy * vx >= 0 ? 1 : -1;
  }

  function captureOrbit(p, dx, dy, dist) {
    var preferred = orbitMinRadius + (orbitMaxRadius - orbitMinRadius) * 0.45;
    var cross = dx * p.vy - dy * p.vx;

    p.orbiting = true;
    p.orbitSpinning = false;
    p.spinBlend = 0;
    p.returningHome = false;
    p.orbitAngle = Math.atan2(dy, dx);
    p.orbitRadius = Math.max(orbitMinRadius, Math.min(orbitMaxRadius, dist * 0.55 + preferred * 0.45));
    p.approachMaxDist = dist;

    // Lock from approach motion when there is a clear sideways component.
    if (Math.abs(cross) > 0.02) {
      p.orbitDir = orbitDirFromMotion(dx, dy, p.vx, p.vy);
      p.orbitDirLocked = true;
    } else {
      p.orbitDirLocked = false;
      p.orbitDir = 1;
    }
  }

  function orbitTarget(p) {
    return {
      x: cursor.x + Math.cos(p.orbitAngle) * p.orbitRadius,
      y: cursor.y + Math.sin(p.orbitAngle) * p.orbitRadius * orbitAspect
    };
  }

  // Keep approach from ever moving farther from the cursor (ratchet inward only).
  function constrainApproach(p) {
    var dx = p.x - cursor.x;
    var dy = p.y - cursor.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var maxDist;
    var scale;

    if (dist < 0.0001) return;

    if (dist < p.approachMaxDist) p.approachMaxDist = dist;
    maxDist = p.approachMaxDist;

    if (dist > maxDist) {
      scale = maxDist / dist;
      p.x = cursor.x + dx * scale;
      p.y = cursor.y + dy * scale;
      // Kill outward velocity.
      if (p.vx * dx + p.vy * dy > 0) {
        p.vx = 0;
        p.vy = 0;
      }
    }
  }

  function applyOrbitForce(p, dist) {
    var desiredRadius;
    var angularSpeed;
    var target;
    var engage;
    var dx;
    var dy;
    var cross;
    var gap;

    if (dist === 0) return;

    dx = p.x - cursor.x;
    dy = p.y - cursor.y;

    if (!p.orbitDirLocked) {
      cross = dx * p.vy - dy * p.vx;
      if (Math.abs(cross) > 0.02) {
        p.orbitDir = orbitDirFromMotion(dx, dy, p.vx, p.vy);
        p.orbitDirLocked = true;
      }
    }

    desiredRadius = Math.max(orbitMinRadius, Math.min(orbitMaxRadius, dist * 0.35 + p.orbitRadius * 0.65));
    p.orbitRadius += (desiredRadius - p.orbitRadius) * 0.06;

    target = orbitTarget(p);

    if (!p.orbitSpinning) {
      // Approximation: far out stay on the ray; near the ring, ease into spin.
      gap = Math.sqrt((target.x - p.x) * (target.x - p.x) + (target.y - p.y) * (target.y - p.y));
      engage = Math.max(0.1, p.orbitEngage * 0.85);

      if (gap >= 28) {
        p.orbitAngle = Math.atan2(dy, dx);
        p.spinBlend = 0;
        target = orbitTarget(p);
        p.vx += (target.x - p.x) * approachSpring * engage;
        p.vy += (target.y - p.y) * approachSpring * engage;
      } else {
        p.spinBlend = Math.min(1, (28 - gap) / 28);
        angularSpeed =
          orbitAngularBase *
          p.orbitDir *
          p.spinBlend *
          p.spinBlend *
          0.55;
        p.orbitAngle += angularSpeed;
        target = orbitTarget(p);
        p.vx += (target.x - p.x) * approachSpring * (0.55 + 0.45 * p.spinBlend);
        p.vy += (target.y - p.y) * approachSpring * (0.55 + 0.45 * p.spinBlend);
      }

      if (gap <= 5 || dist <= p.orbitRadius + 2) {
        p.orbitSpinning = true;
        p.spinBlend = Math.max(p.spinBlend || 0, 0.35);
      }
      return;
    }

    // Orbit stage: finish blending angular speed, then follow the oval.
    p.spinBlend = Math.min(1, (p.spinBlend || 0) + spinBlendSpeed);
    angularSpeed =
      orbitAngularBase *
      p.orbitDir *
      (0.85 + orbitMaxRadius / Math.max(p.orbitRadius, orbitMinRadius) * 0.25) *
      (0.2 + 0.8 * p.spinBlend);
    p.orbitAngle += angularSpeed;
    target = orbitTarget(p);

    engage = Math.max(0.2, p.orbitEngage);
    p.vx += (target.x - p.x) * orbitSpring * engage;
    p.vy += (target.y - p.y) * orbitSpring * engage;
  }

  function applyTextZoneRepulsion(p) {
    var cx;
    var cy;
    var dx;
    var dy;
    var dist;
    if (p.orbiting || !isInTextZone(p.x, p.y)) return;
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
    if (p.orbiting) return;
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

    if (p.returningHome) {
      if (hdist < 10) p.returningHome = false;
      else if (hdist > 0) {
        force = Math.min(hdist * homeReturnBoost, 0.12);
        p.vx += (hdx / hdist) * force;
        p.vy += (hdy / hdist) * force;
        return;
      }
    }

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

  // Closest home origins win up to 3 slots; closer homes replace farther ones.
  function syncOrbitSlots() {
    var pool = [];
    var i;
    var p;
    var homeDist;
    var dx;
    var dy;
    var dist;

    if (shouldReleaseOrbits() || liteMode) {
      for (i = 0; i < particles.length; i += 1) {
        p = particles[i];
        if (p.isStar) continue;
        if (p.orbiting) releaseOrbit(p);
        else {
          p.orbiting = false;
          p.orbitEngage = 0;
        }
      }
      return;
    }

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (p.isStar) continue;
      homeDist = Math.sqrt(
        (p.homeX - cursor.x) * (p.homeX - cursor.x) +
          (p.homeY - cursor.y) * (p.homeY - cursor.y)
      );
      if (homeDist <= orbitCaptureRadius || (p.orbiting && homeDist <= orbitReleaseRadius)) {
        pool.push({ particle: p, homeDist: homeDist });
      }
    }

    pool.sort(function (a, b) {
      return a.homeDist - b.homeDist;
    });

    for (i = 0; i < particles.length; i += 1) particles[i]._orbitSelected = false;
    for (i = 0; i < pool.length && i < maxOrbitingDots; i += 1) {
      pool[i].particle._orbitSelected = true;
    }

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (p.isStar) continue;

      if (p._orbitSelected) {
        dx = p.x - cursor.x;
        dy = p.y - cursor.y;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (!p.orbiting) {
          captureOrbit(
            p,
            dx || p.homeX - cursor.x,
            dy || p.homeY - cursor.y,
            dist || 1
          );
        }
        p.orbitEngage = Math.min(1, p.orbitEngage + orbitEngageSpeed);
        applyOrbitForce(p, dist || 1);
      } else if (p.orbiting) {
        releaseOrbit(p);
      } else {
        p.orbitEngage = Math.max(0, p.orbitEngage - orbitEngageSpeed * 1.4);
      }
      p._orbitSelected = false;
    }
  }

  function updateParticles() {
    var i;
    var p;

    syncOrbitSlots();

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];

      if (p.isStar && !p.active) {
        p.cooldown -= 16;
        if (p.cooldown <= 0) launchShootingStar(p, 0);
        continue;
      }

      if (p.isStar && p.active) {
        p.x += p.vx;
        p.y += p.vy;
        if (shootingStarExited(p)) deactivateShootingStar(p);
        continue;
      }

      if (!p.orbiting) {
        applyHomeForces(p);
        applyTextZoneRepulsion(p);
      }

      p.vx *= p.orbiting ? orbitDamping : driftDamping;
      p.vy *= p.orbiting ? orbitDamping : driftDamping;
      clampSpeed(
        p,
        p.orbiting
          ? p.orbitSpinning
            ? maxOrbitSpeed
            : approachMaxSpeed
          : p.returningHome
            ? maxOrbitSpeed * 0.55
            : maxDriftSpeed * (p.driftRate || 1)
      );

      p.x += p.vx;
      p.y += p.vy;
      if (p.orbiting && !p.orbitSpinning) constrainApproach(p);
      if (!p.orbiting) keepOutOfTextZone(p);
      clampInsideSection(p);
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
    }
    if (!p.blinkPeak || time >= p.blinkUntil) return 0;
    start = p.blinkPeak - (p.blinkUntil - p.blinkPeak) * 0.55;
    if (time < start) return 0;
    if (time <= p.blinkPeak) {
      return Math.max(0, Math.min(1, (time - start) / Math.max(0.08, p.blinkPeak - start)));
    }
    return Math.max(0, Math.min(1, (p.blinkUntil - time) / Math.max(0.08, p.blinkUntil - p.blinkPeak)));
  }

  function drawDot(p, alpha) {
    var blink = blinkAmount(p);
    ctx.beginPath();
    ctx.fillStyle = "rgba(29, 29, 29, " + alpha * (0.38 + 0.16 * blink) + ")";
    ctx.arc(p.x, p.y, Math.max(0.95, p.r * (0.9 + 0.06 * blink)), 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    var i;
    var p;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    for (i = 0; i < particles.length; i += 1) {
      p = particles[i];
      if (!isInsideSection(p.x, p.y, 0)) continue;
      if (p.isStar) {
        if (p.active && !liteMode) drawDot(p, 0.73);
        continue;
      }
      if (isInTextZone(p.x, p.y) && !p.orbiting) continue;
      drawDot(p, liteMode ? 0.42 : 1);
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
    releaseAllOrbits();
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
      releaseAllOrbits();
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
