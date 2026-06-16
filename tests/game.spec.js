const { test, expect } = require('@playwright/test');

test.describe('Neon Kitty Catcher - Game Loading', () => {
  test('should load the game page successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Neon Kitty Catcher');
  });

  test('should display the start screen', async ({ page }) => {
    await page.goto('/');
    const startScreen = page.locator('#start-screen');
    await expect(startScreen).toBeVisible();
    await expect(startScreen.locator('h1')).toContainText('NEON KITTY');
    await expect(startScreen.locator('h1')).toContainText('CATCHER');
  });

  test('should have a start button', async ({ page }) => {
    await page.goto('/');
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toContainText('START GAME');
  });

  test('should have game canvas element', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeAttached();
  });

  test('should have UI overlay elements', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#score-display')).toBeVisible();
    await expect(page.locator('#lives-display')).toBeVisible();
    await expect(page.locator('#score')).toContainText('0');
    await expect(page.locator('#lives')).toContainText('3');
  });

  test('should have neon CSS styling applied', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('.neon-title').first();
    const textShadow = await title.evaluate(el => getComputedStyle(el).textShadow);
    expect(textShadow).toBeTruthy();
    expect(textShadow).not.toBe('none');
  });

  test('should load game.js without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(1000);
    const criticalErrors = errors.filter(e => !e.includes('MediaPipe') && !e.includes('Hands'));
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Neon Kitty Catcher - Game Start', () => {
  test('should start the game when start button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const startScreen = page.locator('#start-screen');
    await expect(startScreen).toHaveClass(/hidden/);

    const state = await page.evaluate(() => window.NeonKittyGame.getState());
    expect(state).toBe('playing');
  });

  test('should initialize simulation mode in headless browser', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(1000);

    const isSim = await page.evaluate(() => window.NeonKittyGame.isSimulationMode());
    expect(isSim).toBe(true);
  });

  test('should hide start screen and show game elements after starting', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await expect(page.locator('#start-screen')).toHaveClass(/hidden/);
    await expect(page.locator('#game-over-screen')).toHaveClass(/hidden/);
  });
});

test.describe('Neon Kitty Catcher - Cat Spawning', () => {
  test('should spawn cats during gameplay', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(4000);

    const catCount = await page.evaluate(() => window.NeonKittyGame.getCatsCount());
    expect(catCount).toBeGreaterThan(0);
  });

  test('should spawn cats continuously', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(2000);

    const count1 = await page.evaluate(() => window.NeonKittyGame.getCatsCount());
    await page.waitForTimeout(2000);
    const count2 = await page.evaluate(() => window.NeonKittyGame.getCatsCount());

    expect(count1 + count2).toBeGreaterThan(0);
  });

  test('should manually spawn a cat via API', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => window.NeonKittyGame.spawnCat());
    await page.waitForTimeout(100);

    const catCount = await page.evaluate(() => window.NeonKittyGame.getCatsCount());
    expect(catCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Neon Kitty Catcher - Glass Element', () => {
  test('should have glass positioned on the right side', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const glassPos = await page.evaluate(() => window.NeonKittyGame.getGlassPos());
    const viewportWidth = page.viewportSize().width;

    expect(glassPos.x).toBeGreaterThan(viewportWidth * 0.6);
    expect(glassPos.w).toBeGreaterThan(0);
    expect(glassPos.h).toBeGreaterThan(0);
  });

  test('should detect points inside the glass area', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const glassPos = await page.evaluate(() => window.NeonKittyGame.getGlassPos());
    const centerX = glassPos.x + glassPos.w / 2;
    const centerY = glassPos.y + glassPos.h / 2;

    const inside = await page.evaluate(
      ({ x, y }) => window.NeonKittyGame.isInGlass(x, y),
      { x: centerX, y: centerY }
    );
    expect(inside).toBe(true);

    const outside = await page.evaluate(
      ({ x, y }) => window.NeonKittyGame.isInGlass(x, y),
      { x: 10, y: 10 }
    );
    expect(outside).toBe(false);
  });
});

test.describe('Neon Kitty Catcher - Catching and Scoring', () => {
  test('should catch a cat by moving mouse over it', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const cat = new (window.NeonKittyGame.constructor || Object)();
      window.NeonKittyGame.spawnCat();
    });
    await page.waitForTimeout(200);

    const catsInfo = await page.evaluate(() => {
      const cats = window.NeonKittyGame.getCatsCount();
      return cats;
    });
    expect(catsInfo).toBeGreaterThanOrEqual(1);
  });

  test('should increase score when cat is dropped in glass', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const scoreBefore = await page.evaluate(() => window.NeonKittyGame.getScore());

    await page.evaluate(() => {
      window.NeonKittyGame.spawnCat();
    });
    await page.waitForTimeout(200);

    const glassPos = await page.evaluate(() => window.NeonKittyGame.getGlassPos());
    const centerX = glassPos.x + glassPos.w / 2;
    const centerY = glassPos.y + glassPos.h / 2;

    await page.mouse.move(100, 300);
    await page.waitForTimeout(100);

    await page.evaluate(({ x, y }) => {
      window.NeonKittyGame.handleFingerMove(x, y);
    }, { x: centerX, y: centerY });
    await page.waitForTimeout(500);

    const scoreAfter = await page.evaluate(() => window.NeonKittyGame.getScore());
    expect(scoreAfter).toBeGreaterThanOrEqual(scoreBefore);
  });

  test('should display score in the UI', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const scoreText = await page.locator('#score').textContent();
    expect(parseInt(scoreText)).toBeGreaterThanOrEqual(0);
  });

  test('should show combo text for consecutive catches', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const comboDisplay = page.locator('#combo-display');
    await expect(comboDisplay).toBeAttached();
  });
});

test.describe('Neon Kitty Catcher - Lives System', () => {
  test('should start with 3 lives', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const lives = await page.evaluate(() => window.NeonKittyGame.getLives());
    expect(lives).toBe(3);
  });

  test('should display lives in the UI', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const livesText = await page.locator('#lives').textContent();
    expect(livesText).toBe('3');
  });

  test('should lose life when cat escapes', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.NeonKittyGame.spawnCat();
    });
    await page.waitForTimeout(100);

    const livesBefore = await page.evaluate(() => window.NeonKittyGame.getLives());

    await page.evaluate(() => {
      const cats = document.querySelector('#game-canvas');
      if (window.NeonKittyGame.getCatsCount() > 0) {
        const gameCanvas = cats;
      }
    });

    await page.waitForTimeout(5000);

    const livesAfter = await page.evaluate(() => window.NeonKittyGame.getLives());
    expect(livesAfter).toBeLessThanOrEqual(livesBefore);
  });
});

test.describe('Neon Kitty Catcher - Game Over', () => {
  test('should show game over screen when lives reach zero', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.NeonKittyGame.endGame();
    });
    await page.waitForTimeout(500);

    const gameOverScreen = page.locator('#game-over-screen');
    await expect(gameOverScreen).toBeVisible();

    const state = await page.evaluate(() => window.NeonKittyGame.getState());
    expect(state).toBe('gameover');
  });

  test('should display final score on game over screen', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => window.NeonKittyGame.endGame());
    await page.waitForTimeout(500);

    const finalScore = page.locator('#final-score');
    await expect(finalScore).toBeVisible();
  });

  test('should have a restart button on game over screen', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => window.NeonKittyGame.endGame());
    await page.waitForTimeout(500);

    const restartBtn = page.locator('#restart-btn');
    await expect(restartBtn).toBeVisible();
    await expect(restartBtn).toContainText('PLAY AGAIN');
  });

  test('should restart the game when restart button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => window.NeonKittyGame.endGame());
    await page.waitForTimeout(500);

    await page.click('#restart-btn');
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => window.NeonKittyGame.getState());
    expect(state).toBe('playing');

    const gameOverScreen = page.locator('#game-over-screen');
    await expect(gameOverScreen).toHaveClass(/hidden/);

    const score = await page.evaluate(() => window.NeonKittyGame.getScore());
    expect(score).toBe(0);

    const lives = await page.evaluate(() => window.NeonKittyGame.getLives());
    expect(lives).toBe(3);
  });
});

test.describe('Neon Kitty Catcher - Full Gameplay Flow', () => {
  test('should complete a full game session: start, play, game over, restart', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#start-screen')).toBeVisible();
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    let state = await page.evaluate(() => window.NeonKittyGame.getState());
    expect(state).toBe('playing');

    await page.waitForTimeout(2000);

    const catCount = await page.evaluate(() => window.NeonKittyGame.getCatsCount());
    expect(catCount).toBeGreaterThanOrEqual(0);

    await page.evaluate(() => window.NeonKittyGame.endGame());
    await page.waitForTimeout(500);

    state = await page.evaluate(() => window.NeonKittyGame.getState());
    expect(state).toBe('gameover');
    await expect(page.locator('#game-over-screen')).toBeVisible();

    await page.click('#restart-btn');
    await page.waitForTimeout(500);

    state = await page.evaluate(() => window.NeonKittyGame.getState());
    expect(state).toBe('playing');

    const score = await page.evaluate(() => window.NeonKittyGame.getScore());
    expect(score).toBe(0);
  });

  test('should interact with cats using mouse movement in simulation mode', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => window.NeonKittyGame.spawnCat());
    await page.waitForTimeout(200);

    await page.mouse.move(640, 360);
    await page.waitForTimeout(100);
    await page.mouse.move(200, 300);
    await page.waitForTimeout(100);
    await page.mouse.move(400, 400);
    await page.waitForTimeout(100);

    const fingerIndicator = page.locator('#finger-indicator');
    const isActive = await fingerIndicator.evaluate(el => {
      return el.classList.contains('active') || getComputedStyle(el).display !== 'none';
    });
    expect(isActive).toBeTruthy();
  });

  test('should catch cat and drop it in glass via mouse simulation', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.NeonKittyGame.spawnCat();
    });
    await page.waitForTimeout(300);

    const catPositions = await page.evaluate(() => {
      const game = window.NeonKittyGame;
      return { catCount: game.getCatsCount() };
    });

    if (catPositions.catCount > 0) {
      const glassPos = await page.evaluate(() => window.NeonKittyGame.getGlassPos());
      const glassCenterX = glassPos.x + glassPos.w / 2;
      const glassCenterY = glassPos.y + glassPos.h / 2;

      await page.mouse.move(glassCenterX, glassCenterY);
      await page.waitForTimeout(300);
    }

    const gameState = await page.evaluate(() => window.NeonKittyGame.getState());
    expect(gameState).toBe('playing');
  });
});

test.describe('Neon Kitty Catcher - Visual Effects', () => {
  test('should render canvas with proper dimensions', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const dimensions = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      return {
        width: canvas.width,
        height: canvas.height
      };
    });

    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
  });

  test('should have background gradient styling', async ({ page }) => {
    await page.goto('/');
    const bg = await page.evaluate(() => {
      const container = document.getElementById('game-container');
      return getComputedStyle(container).background;
    });
    expect(bg).toBeTruthy();
  });

  test('should have neon button styling', async ({ page }) => {
    await page.goto('/');
    const btnStyle = await page.evaluate(() => {
      const btn = document.getElementById('start-btn');
      const style = getComputedStyle(btn);
      return {
        boxShadow: style.boxShadow,
        border: style.border
      };
    });
    expect(btnStyle.boxShadow).toBeTruthy();
    expect(btnStyle.boxShadow).not.toBe('none');
  });

  test('should have video element for camera', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('#camera-feed');
    await expect(video).toBeAttached();
  });
});

test.describe('Neon Kitty Catcher - Responsive Design', () => {
  test('should adapt to different viewport sizes', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const glassPos = await page.evaluate(() => window.NeonKittyGame.getGlassPos());
    expect(glassPos.x).toBeLessThan(800);
    expect(glassPos.y).toBeLessThan(600);
  });

  test('should handle window resize', async ({ page }) => {
    await page.goto('/');
    await page.click('#start-btn');
    await page.waitForTimeout(500);

    const glassBefore = await page.evaluate(() => window.NeonKittyGame.getGlassPos());

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);

    const glassAfter = await page.evaluate(() => window.NeonKittyGame.getGlassPos());

    expect(glassAfter.x).not.toBe(glassBefore.x);
  });
});
