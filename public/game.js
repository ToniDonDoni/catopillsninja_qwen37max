(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const video = document.getElementById('camera-feed');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const comboEl = document.getElementById('combo');
  const comboDisplay = document.getElementById('combo-display');
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScoreEl = document.getElementById('final-score');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const fingerIndicator = document.getElementById('finger-indicator');

  let W, H;
  let gameState = 'start';
  let score = 0;
  let lives = 3;
  let combo = 0;
  let comboTimer = null;
  let comboResetTimer = null;
  let cats = [];
  let pills = [];
  let particles = [];
  let sparkles = [];
  let fingerPos = null;
  let grabbedCat = null;
  let catSpawnTimer = 0;
  let catSpawnInterval = 90;
  let difficulty = 1;
  let frameCount = 0;
  let handTrackingReady = false;
  let simulationMode = false;

  const GLASS_WIDTH = 120;
  const GLASS_HEIGHT = 180;
  let glassX, glassY;

  const CAT_COLORS = [
    '#ff00ff', '#00ffff', '#ff6600', '#ffff00',
    '#00ff66', '#ff0066', '#6600ff', '#ff3399',
    '#33ffcc', '#ff9900'
  ];

  const CAT_EMOJIS = ['😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐱'];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    glassX = W - GLASS_WIDTH - 30;
    glassY = H - GLASS_HEIGHT - 40;
  }

  window.addEventListener('resize', resize);
  resize();

  class Cat {
    constructor() {
      this.size = 50 + Math.random() * 20;
      this.color = CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)];
      this.emoji = CAT_EMOJIS[Math.floor(Math.random() * CAT_EMOJIS.length)];
      this.grabbed = false;
      this.alive = true;
      this.rotation = 0;
      this.rotSpeed = (Math.random() - 0.5) * 0.05;
      this.glowPhase = Math.random() * Math.PI * 2;
      this.trail = [];
      this.spawnFromSide();
    }

    spawnFromSide() {
      const side = Math.floor(Math.random() * 3);
      const speed = 2 + Math.random() * 2 * difficulty;

      if (side === 0) {
        this.x = -this.size;
        this.y = H * 0.2 + Math.random() * H * 0.5;
        this.vx = speed;
        this.vy = (Math.random() - 0.5) * speed * 0.5;
      } else if (side === 1) {
        this.x = Math.random() * W * 0.5;
        this.y = -this.size;
        this.vx = (Math.random() - 0.3) * speed;
        this.vy = speed * 0.7;
      } else {
        this.x = W * 0.3 + Math.random() * W * 0.3;
        this.y = H + this.size;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = -speed;
      }

      this.gravity = 0.08 + Math.random() * 0.04;
    }

    update() {
      if (this.grabbed) {
        if (fingerPos) {
          this.x += (fingerPos.x - this.x) * 0.3;
          this.y += (fingerPos.y - this.y) * 0.3;
          this.vx = 0;
          this.vy = 0;
        }
        this.trail.push({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > 15) this.trail.shift();
      } else {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
      }

      this.glowPhase += 0.08;

      if (!this.grabbed) {
        if (this.y > H + this.size * 2 || this.x > W + this.size * 2 || this.x < -this.size * 3) {
          this.alive = false;
          if (gameState === 'playing') {
            lives--;
            livesEl.textContent = lives;
            if (lives <= 0) endGame();
          }
        }
      }

      this.trail.forEach(t => t.alpha -= 0.07);
      this.trail = this.trail.filter(t => t.alpha > 0);
    }

    draw() {
      ctx.save();

      this.trail.forEach(t => {
        ctx.globalAlpha = t.alpha * 0.3;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      const glowIntensity = 15 + Math.sin(this.glowPhase) * 10;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = glowIntensity;

      this.drawCatBody();

      ctx.restore();
    }

    drawCatBody() {
      const s = this.size;

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.5, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-s * 0.35, -s * 0.35);
      ctx.lineTo(-s * 0.2, -s * 0.6);
      ctx.lineTo(-s * 0.05, -s * 0.35);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(s * 0.05, -s * 0.35);
      ctx.lineTo(s * 0.2, -s * 0.6);
      ctx.lineTo(s * 0.35, -s * 0.35);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-s * 0.15, -s * 0.05, s * 0.07, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s * 0.15, -s * 0.05, s * 0.07, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-s * 0.13, -s * 0.08, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.17, -s * 0.08, s * 0.03, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.05);
      ctx.lineTo(-s * 0.05, s * 0.1);
      ctx.moveTo(0, s * 0.05);
      ctx.lineTo(s * 0.05, s * 0.1);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.15, s * 0.05);
        ctx.lineTo(i * s * 0.45, s * 0.0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * s * 0.15, s * 0.08);
        ctx.lineTo(i * s * 0.45, s * 0.1);
        ctx.stroke();
      }

      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(s * 0.4, s * 0.1);
      ctx.quadraticCurveTo(s * 0.7, -s * 0.2, s * 0.6, -s * 0.4);
      ctx.stroke();
    }

    containsPoint(px, py) {
      const dx = px - this.x;
      const dy = py - this.y;
      return Math.sqrt(dx * dx + dy * dy) < this.size * 0.6;
    }
  }

  class Pill {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.width = 30;
      this.height = 14;
      this.alpha = 1;
      this.rotation = Math.random() * Math.PI;
      this.dissolving = false;
      this.dissolveProgress = 0;
      this.particles = [];
    }

    update() {
      if (this.dissolving) {
        this.dissolveProgress += 0.02;
        this.alpha = 1 - this.dissolveProgress;
        this.width *= 0.99;
        this.height *= 0.99;

        if (Math.random() < 0.4) {
          this.particles.push({
            x: this.x + (Math.random() - 0.5) * this.width,
            y: this.y + (Math.random() - 0.5) * this.height,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2 - 1,
            alpha: 1,
            size: 2 + Math.random() * 4,
            color: this.color
          });
        }

        this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.03;
          p.size *= 0.97;
        });
        this.particles = this.particles.filter(p => p.alpha > 0);
      }
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      ctx.shadowColor = this.color;
      ctx.shadowBlur = 20;

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.roundRect(-this.width / 2, -this.height / 2, this.width / 2, this.height, this.height / 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(0, -this.height / 2, this.width / 2, this.height, this.height / 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -this.height / 2);
      ctx.lineTo(0, this.height / 2);
      ctx.stroke();

      ctx.restore();

      this.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    isDone() {
      return this.dissolving && this.alpha <= 0 && this.particles.length === 0;
    }
  }

  class Particle {
    constructor(x, y, color, type = 'burst') {
      this.x = x;
      this.y = y;
      this.color = color;
      this.type = type;
      this.alpha = 1;

      if (type === 'burst') {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 2 + Math.random() * 5;
        this.decay = 0.02 + Math.random() * 0.02;
      } else if (type === 'sparkle') {
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -1 - Math.random() * 3;
        this.size = 1 + Math.random() * 3;
        this.decay = 0.01 + Math.random() * 0.02;
      }
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= this.decay;
      if (this.type === 'burst') {
        this.vy += 0.1;
        this.size *= 0.98;
      }
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    isDead() {
      return this.alpha <= 0;
    }
  }

  function drawGlass() {
    ctx.save();

    const gx = glassX;
    const gy = glassY;
    const gw = GLASS_WIDTH;
    const gh = GLASS_HEIGHT;

    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20 + Math.sin(frameCount * 0.03) * 10;

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 10, gy + gh);
    ctx.lineTo(gx + gw - 10, gy + gh);
    ctx.lineTo(gx + gw, gy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 10, gy + gh);
    ctx.lineTo(gx + gw - 10, gy + gh);
    ctx.lineTo(gx + gw, gy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(gx + 15, gy + 10);
    ctx.lineTo(gx + 20, gy + gh - 20);
    ctx.lineTo(gx + 30, gy + gh - 20);
    ctx.lineTo(gx + 25, gy + 10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(gx + gw / 2, gy, gw / 2, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROP HERE', gx + gw / 2, gy - 15);

    ctx.restore();
  }

  function isInGlass(x, y) {
    const gx = glassX;
    const gy = glassY;
    const gw = GLASS_WIDTH;
    const gh = GLASS_HEIGHT;
    return x > gx && x < gx + gw && y > gy && y < gy + gh;
  }

  function spawnCat() {
    cats.push(new Cat());
  }

  function createBurst(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(x, y, color, 'burst'));
    }
  }

  function createSparkles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      sparkles.push(new Particle(x, y, color, 'sparkle'));
    }
  }

  function processCatInGlass(cat) {
    const pill = new Pill(cat.x, cat.y, cat.color);
    pills.push(pill);
    createBurst(cat.x, cat.y, cat.color, 30);
    createSparkles(cat.x, cat.y, '#ffff00', 15);

    setTimeout(() => {
      pill.dissolving = true;
    }, 500);

    combo++;
    const points = 10 * combo;
    score += points;
    scoreEl.textContent = score;

    if (combo > 1) {
      comboEl.textContent = `${combo}x COMBO! +${points}`;
      comboDisplay.classList.add('show');
      clearTimeout(comboTimer);
      comboTimer = setTimeout(() => {
        comboDisplay.classList.remove('show');
      }, 1000);
    } else {
      comboEl.textContent = `+${points}`;
      comboDisplay.classList.add('show');
      clearTimeout(comboTimer);
      comboTimer = setTimeout(() => {
        comboDisplay.classList.remove('show');
      }, 800);
    }

    clearTimeout(comboResetTimer);
    comboResetTimer = setTimeout(() => {
      combo = 0;
    }, 3000);

    cat.alive = false;
    grabbedCat = null;
  }

  function drawBackground() {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, W, H);

    const gridSize = 60;
    ctx.strokeStyle = `rgba(255, 0, 255, ${0.03 + Math.sin(frameCount * 0.01) * 0.02})`;
    ctx.lineWidth = 0.5;
    const offset = (frameCount * 0.5) % gridSize;

    for (let x = -gridSize + offset; x < W + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = -gridSize + offset; y < H + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function gameLoop() {
    frameCount++;
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    if (gameState === 'playing') {
      catSpawnTimer++;
      if (catSpawnTimer >= catSpawnInterval) {
        catSpawnTimer = 0;
        spawnCat();
        difficulty = 1 + score / 200;
        catSpawnInterval = Math.max(30, 90 - score / 5);
      }
    }

    drawGlass();

    cats.forEach(cat => {
      cat.update();
      cat.draw();
    });
    cats = cats.filter(c => c.alive);

    pills.forEach(pill => {
      pill.update();
      pill.draw();
    });
    pills = pills.filter(p => !p.isDone());

    particles.forEach(p => {
      p.update();
      p.draw();
    });
    particles = particles.filter(p => !p.isDead());

    sparkles.forEach(s => {
      s.update();
      s.draw();
    });
    sparkles = sparkles.filter(s => !s.isDead());

    if (fingerPos && gameState === 'playing') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(fingerPos.x, fingerPos.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(gameLoop);
  }

  function handleFingerMove(x, y) {
    fingerPos = { x, y };

    fingerIndicator.style.left = x + 'px';
    fingerIndicator.style.top = y + 'px';
    fingerIndicator.classList.add('active');

    if (gameState !== 'playing') return;

    if (grabbedCat) {
      if (isInGlass(x, y)) {
        processCatInGlass(grabbedCat);
      }
    } else {
      for (let i = cats.length - 1; i >= 0; i--) {
        if (cats[i].containsPoint(x, y) && !cats[i].grabbed) {
          grabbedCat = cats[i];
          grabbedCat.grabbed = true;
          createSparkles(x, y, grabbedCat.color, 5);
          break;
        }
      }
    }
  }

  function handleFingerLost() {
    fingerIndicator.classList.remove('active');
    if (grabbedCat) {
      grabbedCat.grabbed = false;
      grabbedCat.vy = -2;
      grabbedCat.vx = (Math.random() - 0.5) * 3;
      grabbedCat = null;
    }
    fingerPos = null;
  }

  function initHandTracking() {
    if (typeof Hands === 'undefined') {
      console.warn('MediaPipe Hands not loaded, using simulation mode');
      simulationMode = true;
      initSimulationMode();
      return;
    }

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const x = (1 - indexTip.x) * W;
        const y = indexTip.y * H;
        handleFingerMove(x, y);
      } else {
        handleFingerLost();
      }
    });

    if (typeof Camera !== 'undefined') {
      const camera = new Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video });
        },
        width: 640,
        height: 480
      });

      camera.start().then(() => {
        handTrackingReady = true;
      }).catch((err) => {
        console.warn('Camera access denied, using simulation mode:', err);
        simulationMode = true;
        initSimulationMode();
      });
    } else {
      simulationMode = true;
      initSimulationMode();
    }
  }

  function initSimulationMode() {
    handTrackingReady = true;
    let mouseDown = false;

    canvas.addEventListener('mousemove', (e) => {
      handleFingerMove(e.clientX, e.clientY);
    });

    canvas.addEventListener('mousedown', () => { mouseDown = true; });
    canvas.addEventListener('mouseup', () => {
      mouseDown = false;
      if (grabbedCat) {
        if (isInGlass(fingerPos.x, fingerPos.y)) {
          processCatInGlass(grabbedCat);
        } else {
          grabbedCat.grabbed = false;
          grabbedCat.vy = -2;
          grabbedCat = null;
        }
      }
    });

    canvas.addEventListener('mouseleave', () => {
      handleFingerLost();
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleFingerMove(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleFingerMove(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      if (grabbedCat && fingerPos) {
        if (isInGlass(fingerPos.x, fingerPos.y)) {
          processCatInGlass(grabbedCat);
        } else {
          grabbedCat.grabbed = false;
          grabbedCat.vy = -2;
          grabbedCat = null;
        }
      }
      handleFingerLost();
    });
  }

  function startGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    combo = 0;
    difficulty = 1;
    cats = [];
    pills = [];
    particles = [];
    sparkles = [];
    grabbedCat = null;
    catSpawnTimer = 0;
    catSpawnInterval = 90;
    scoreEl.textContent = '0';
    livesEl.textContent = '3';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    if (!handTrackingReady) {
      initHandTracking();
    }
  }

  function endGame() {
    gameState = 'gameover';
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
    if (grabbedCat) {
      grabbedCat.grabbed = false;
      grabbedCat = null;
    }
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  window.NeonKittyGame = {
    getState: () => gameState,
    getScore: () => score,
    getLives: () => lives,
    getCombo: () => combo,
    getCatsCount: () => cats.length,
    getPillsCount: () => pills.length,
    startGame,
    endGame,
    spawnCat,
    handleFingerMove,
    handleFingerLost,
    isInGlass,
    getGlassPos: () => ({ x: glassX, y: glassY, w: GLASS_WIDTH, h: GLASS_HEIGHT }),
    isSimulationMode: () => simulationMode,
    isHandTrackingReady: () => handTrackingReady
  };

  gameLoop();
})();
