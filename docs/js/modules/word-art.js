// === CONFIGURATION ===
const CONFIG = {
  duration:       6000,   // total ms (6 seconds)
  monsoonStart:   2000,   // ms
  animalStart:    2500,   // ms
  monsoonEnd:     4500,   // ms
  monkeyEnd:      3500,   // ms, ends 500ms before storm ends
  baseInterval:   50,     // ms between storm ticks (for rate scaling)
  lightRate:      0.15,   // start even slower
  denseRate:      12.0,   // much denser monsoon
  taperRate:      2.0,    // still a strong taper
  animalRateMul:  0.7,    // animals ramp up too
  audioLoopMs:    2113,   // 2.513636 - 0.4 seconds, in ms
  hintClicks:     7,
  wordartFontMin: 1.2,
  wordartFontMax: 3.6,
  wordartScaleMin: 0.8,
  wordartScaleMax: 2.0,
  animalSizeMin:  80,
  animalSizeMax:  220
};

let monkeyVolumeLevel = 0.6;
function playMonkeySound() {
  const audio = new Audio('../data/monkey.mp3');
  audio.volume = Math.min(1, monkeyVolumeLevel);
  monkeyVolumeLevel += 0.05; // increase each time
  audio.play().catch(() => {/* muted tab or error */});
}

function startMonkeyLoop(startTime) {
  function loop() {
    const elapsed = performance.now() - startTime;
    if (elapsed >= CONFIG.monkeyEnd) return;
    playMonkeySoundLayered();
    setTimeout(loop, CONFIG.audioLoopMs);
  }
  loop();
}

let lastThunder = 0;

function playMonkeySoundLayered() {
  playMonkeySound();
  setTimeout(() => {
    if (Math.random() < 0.7) playMonkeySound();
  }, 300);
}

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function initWordArt() {
  let allowWordArtSpam = false;
  let clickCount = 0;
  let nightToggleCount = 0;
  let lastTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
  let monsoonTriggered = false;

  if (isMobileDevice()) {
    // On mobile, disable click handler and use night mode toggle sequence
    // Listen for dark mode toggle
    const observer = new MutationObserver(() => {
      const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      if (currentTheme !== lastTheme) {
        nightToggleCount++;
        lastTheme = currentTheme;
        if (nightToggleCount >= 6 && !monsoonTriggered) {
          monsoonTriggered = true;
          // Use a generic label for mobile
          runMonsoon('monsoon', window.innerWidth);
        }
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') allowWordArtSpam = true;
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') allowWordArtSpam = false;
  });

  document.addEventListener('click', (e) => {
    const currentFile = window.location.pathname.split('/').pop();
    const excludedPages = ['index.html', 'research.html', 'kazakhstan.html', 'china.html'];
    if (excludedPages.includes(currentFile)) return;

    const newsletterCard = document.querySelector('.newsletter-card');
    const navBar = document.querySelector('nav.sticky');
    const isClickInsideCard = newsletterCard && newsletterCard.contains(e.target);
    const isClickInsideNav = navBar && navBar.contains(e.target);
    const isClickOutsideCardAndNav = !isClickInsideCard && !isClickInsideNav;

    if (allowWordArtSpam || isClickOutsideCardAndNav) {
      if (currentFile) {
        let displayText = currentFile;
        if (currentFile.startsWith('kz-')) displayText = 'kazakhstan.html';
        if (allowWordArtSpam) {
          runMonsoon(displayText, window.innerWidth);
        } else {
          clickCount++;
          if (clickCount === CONFIG.hintClicks) showHint();
        }
        // Thunder on click during storm, debounced
        if (typeof runMonsoon.monsoonActive === 'function' && runMonsoon.monsoonActive()) {
          if (performance.now() - lastThunder > 800) {
            triggerThunder();
            lastThunder = performance.now();
          }
        }
      }
    }
  });

  // --- Single WordArt ---
  function showWordArt(text, x, y) {
    const banner = document.createElement('div');
    banner.className = 'wordart-banner';
    banner.textContent = text;
    const sizeFactor = Math.random();
    let randomScale, randomFontSize;
    randomScale = CONFIG.wordartScaleMin + Math.random() * (CONFIG.wordartScaleMax - CONFIG.wordartScaleMin);
    randomFontSize = CONFIG.wordartFontMin + Math.random() * (CONFIG.wordartFontMax - CONFIG.wordartFontMin);
    const randomRotation = (Math.random() - 0.5) * 60;
    banner.style.fontSize = `${randomFontSize}rem`;
    banner.style.left = `${x}px`;
    banner.style.top = `${y}px`;
    banner.style.setProperty('--scale', randomScale);
    banner.style.transform = `translate(-50%, -50%) scale(var(--scale)) rotate(${randomRotation}deg)`;
    banner.style.animation = 'wordartFadeInClick 1.2s ease forwards';
    document.body.appendChild(banner);
    setTimeout(() => { banner.classList.add('floaty'); }, 1200);
    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.8s ease';
      setTimeout(() => banner.remove(), 800);
    }, 800);
  }

  // --- Monsoon Orchestrator ---
  function runMonsoon(text, screenWidth) {
    const start = performance.now();
    let monkeySoundStarted = false;
    let animId;
    let darkModeTriggered = false;
    let lightningScheduled = false;
    let monsoonActive = false;
    function tick(now) {
      const elapsed = now - start;
      if (!monsoonActive && elapsed >= CONFIG.monsoonStart && elapsed < CONFIG.monsoonEnd) {
        monsoonActive = true;
      }
      if (elapsed >= CONFIG.monsoonEnd && monsoonActive) {
        monsoonActive = false;
      }
      if (elapsed > CONFIG.duration) {
        cancelAnimationFrame(animId);
        document.body.classList.remove('dark-mode');
        document.body.classList.add('post-monsoon-fade');
        setTimeout(() => {
          document.body.classList.remove('post-monsoon-fade');
        }, 1000);
        monkeyVolumeLevel = 0.6; // reset for next storm
        return;
      }
      // Schedule lightning strike earlier
      if (!lightningScheduled && elapsed >= (CONFIG.monsoonStart - 400)) {
        lightningScheduled = true;
        triggerLightningImage();
        setTimeout(() => {
          triggerThunder();
        }, 200);
      }
      // Trigger dark mode at monsoon start
      if (!darkModeTriggered && elapsed >= CONFIG.monsoonStart) {
        darkModeTriggered = true;
        document.body.classList.add('dark-mode');
      }
      let rate = elapsed < CONFIG.monsoonStart
        ? CONFIG.lightRate
        : elapsed < CONFIG.monsoonEnd
          ? CONFIG.denseRate
          : CONFIG.taperRate;
      if (Math.random() < rate * (CONFIG.baseInterval/50)) {
        createWordArtDrop(text, screenWidth);
      }
      if (!monkeySoundStarted && elapsed >= (CONFIG.animalStart - 100)) {
        monkeySoundStarted = true;
        playMonkeySound();
        startMonkeyLoop(start);
        // Bonus: one last monkey scream after monkeyEnd
        setTimeout(() => {
          if (monkeySoundStarted && (performance.now() - start) < CONFIG.duration) playMonkeySound();
        }, CONFIG.monkeyEnd + 100 - (performance.now() - start));
      }
      if (elapsed >= CONFIG.animalStart) {
        if (Math.random() < rate * CONFIG.animalRateMul) {
          createAnimalDrop(screenWidth);
        }
      }
      animId = requestAnimationFrame(tick);
    }
    animId = requestAnimationFrame(tick);
    // Expose monsoonActive for click handler
    runMonsoon.monsoonActive = () => monsoonActive;
  }

  // Lightning image effect
  function triggerLightningImage() {
    let lightning = document.getElementById('lightning-flash');
    if (!lightning) {
      lightning = document.createElement('img');
      lightning.id = 'lightning-flash';
      lightning.src = '../images-optimized/lightning.png';
      lightning.style.position = 'fixed';
      lightning.style.top = '0';
      lightning.style.left = '0';
      lightning.style.width = '100vw';
      lightning.style.height = '100vh';
      lightning.style.objectFit = 'cover';
      lightning.style.opacity = '0';
      lightning.style.pointerEvents = 'none';
      lightning.style.zIndex = '100000';
      lightning.style.transition = 'opacity 60ms';
      document.body.appendChild(lightning);
    }
    lightning.style.opacity = '1';
    setTimeout(() => {
      lightning.style.opacity = '0';
    }, 120);
  }

  // Thunder sound effect
  function triggerThunder() {
    const thunder = new Audio('../data/thunder.mp3');
    thunder.volume = 0.8;
    thunder.play().catch(() => {/* mute or tab-throttled */});
  }

  // --- WordArt Drop ---
  function createWordArtDrop(text, screenWidth) {
    const banner = document.createElement('div');
    banner.className = 'wordart-banner rainstorm';
    banner.textContent = text;
    const randomX = Math.random() * screenWidth;
    const randomScale = CONFIG.wordartScaleMin + Math.random() * (CONFIG.wordartScaleMax - CONFIG.wordartScaleMin);
    const randomFontSize = CONFIG.wordartFontMin + Math.random() * (CONFIG.wordartFontMax - CONFIG.wordartFontMin);
    const randomRotation = (Math.random() - 0.5) * 60;
    const spin = (Math.random() > 0.5 ? 1 : -1) * (90 + Math.random() * 90);
    banner.style.fontSize = `${randomFontSize}rem`;
    banner.style.left = `${randomX}px`;
    banner.style.top = `-100px`;
    banner.style.setProperty('--start-scale', 0.5);
    banner.style.setProperty('--scale', randomScale);
    banner.style.transform = `translate(-50%, -50%) scale(var(--start-scale)) rotate(${randomRotation}deg)`;
    banner.style.setProperty('--final-rotation', `${spin}deg`);
    banner.style.animation = 'wordartRainstorm 0.75s ease-in forwards';
    banner.style.zIndex = '10000';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 1500);
  }

  // --- Animal Drop ---
  function createAnimalDrop(screenWidth) {
    const animalImages = [
      'chimp.png', 'chimp2.png', 'giraffe.png', 'chimp3.png'
    ];
    const animalDiv = document.createElement('div');
    animalDiv.className = 'animal-rainstorm';
    const randomAnimal = animalImages[Math.floor(Math.random() * animalImages.length)];
    const img = document.createElement('img');
    img.src = `../images-optimized/animals/${randomAnimal}`;
    img.alt = randomAnimal.replace('.png', '');
    const randomX = Math.random() * screenWidth;
    const startY = -100;
    const animalSize = CONFIG.animalSizeMin + Math.random() * (CONFIG.animalSizeMax - CONFIG.animalSizeMin);
    const randomRotation = (Math.random() - 0.5) * 120;
    const spinDirection = Math.random() > 0.5 ? 1 : -1;
    const baseRotation = 135;
    const randomFactor = Math.random();
    let rotationMultiplier;
    if (randomFactor < 0.7) {
      rotationMultiplier = 0.8 + randomFactor * 0.4;
    } else if (randomFactor < 0.9) {
      rotationMultiplier = 1.5 + (randomFactor - 0.7) * 7.5;
    } else {
      rotationMultiplier = 3 + (randomFactor - 0.9) * 50;
    }
    const finalRotation = spinDirection * baseRotation * rotationMultiplier;
    animalDiv.style.position = 'fixed';
    animalDiv.style.left = `${randomX}px`;
    animalDiv.style.top = `${startY}px`;
    animalDiv.style.width = `${animalSize}px`;
    animalDiv.style.height = `${animalSize}px`;
    animalDiv.style.setProperty('--final-rotation', `${finalRotation}deg`);
    animalDiv.style.setProperty('--scale', animalSize/150); // for future CSS use
    animalDiv.style.transform = `translate(-50%, -50%) rotate(${randomRotation}deg)`;
    animalDiv.style.animation = 'animalRainstorm 0.75s ease-in forwards';
    animalDiv.style.zIndex = '10000';
    animalDiv.style.pointerEvents = 'none';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    animalDiv.appendChild(img);
    document.body.appendChild(animalDiv);
    setTimeout(() => animalDiv.remove(), 1500);
  }

  // --- Hint ---
  function showHint() {
    const hint = document.createElement('div');
    hint.className = 'wordart-hint';
    hint.innerHTML = '<span>*pst*</span><br>try holding "w"';
    hint.style.position = 'fixed';
    hint.style.bottom = '20px';
    hint.style.right = '20px';
    hint.style.background = 'rgba(0, 0, 0, 0.8)';
    hint.style.color = 'white';
    hint.style.padding = '15px 20px';
    hint.style.borderRadius = '10px';
    hint.style.fontFamily = 'monospace';
    hint.style.fontSize = '14px';
    hint.style.zIndex = '10001';
    hint.style.opacity = '0';
    hint.style.transform = 'translateY(20px)';
    hint.style.transition = 'all 0.5s ease';
    hint.style.cursor = 'pointer';
    hint.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    hint.querySelector('span').style.color = '#ff6b6b';
    hint.querySelector('span').style.fontWeight = 'bold';
    document.body.appendChild(hint);
    setTimeout(() => {
      hint.style.opacity = '1';
      hint.style.transform = 'translateY(0)';
    }, 100);
    hint.addEventListener('click', () => {
      hint.style.opacity = '0';
      hint.style.transform = 'translateY(20px)';
      setTimeout(() => hint.remove(), 500);
    });
    setTimeout(() => {
      if (hint.parentNode) {
        hint.style.opacity = '0';
        hint.style.transform = 'translateY(20px)';
        setTimeout(() => hint.remove(), 500);
      }
    }, 3000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWordArt);
} else {
  initWordArt();
} 