(() => {
    // Config
    const GAME_WIDTH = 1000;
    const GAME_HEIGHT = 600;
    const PLAYER_SPEED = 5;
    const PROJECTILE_SPEED = 8;
    const COLLECTIBLE_SPEED = 2;
    const TARGET_WORD = "SOLDIER";
    const NEGATIVE_EMOTIONS = [
        "Fear", "Anxiety", "Doubt", "Anger", "Despair", "Guilt"
    ];
    const EMOTION_COLORS = {
        "Fear": 0x4A6CFF,
        "Anxiety": 0xFF6EC7,
        "Doubt": 0xFFD166,
        "Anger": 0xFF3333,
        "Despair": 0x8A2BE2,
        "Guilt": 0x00D1A0
    };


    // App setup
    const app = new PIXI.Application({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x111111,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });
    document.getElementById("game-container").appendChild(app.view);

    function applyOrientationTransform() {
        const isPortrait = window.innerHeight > window.innerWidth;
        // Resize renderer to fill screen
        app.renderer.resize(window.innerWidth, window.innerHeight);

        if (isPortrait) {
            // rotate stage +90deg clockwise so the game content appears landscape
            app.stage.rotation = Math.PI / 2;

            // After a +90° rotation about (0,0), x' = -y, y' = x
            // to move everything into positive canvas coords, shift x by screen width
            app.stage.position.set(window.innerWidth, 0);
        } else {
            // normal (landscape) — no rotation
            app.stage.rotation = 0;
            app.stage.position.set(0, 0);
        }
    }

    applyOrientationTransform();
    window.addEventListener("resize", applyOrientationTransform);
    window.addEventListener("orientationchange", applyOrientationTransform);

    function resize() {
        const isPortrait = window.innerHeight > window.innerWidth;

        // Swap width/height when portrait
        const screenW = isPortrait ? window.innerHeight : window.innerWidth;
        const screenH = isPortrait ? window.innerWidth : window.innerHeight;

        // Compute scale
        const scaleX = screenW / GAME_WIDTH;
        const scaleY = screenH / GAME_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        // Scale stage
        app.stage.scale.set(scale);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    // Game state
    let collectedLetters = new Set();
    let gameOver = false;
    let startTime = 0;
    let elapsedTime = 0; // in seconds

    // Containers
    const gameScene = new PIXI.Container();
    const uiScene = new PIXI.Container();
    app.stage.addChild(gameScene, uiScene);

    // Player
    const player = new PIXI.Graphics();
    player.beginFill(0x00ff66);
    player.drawRect(-20, -20, 40, 40); // placeholder
    player.endFill();
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 50;
    gameScene.addChild(player);

    // Arrays
    const projectiles = [];
    const enemies = [];
    const collectibles = [];
    const enemyBullets = [];

    // UI

    // Letter display container
    const wordDisplay = new PIXI.Container();
    wordDisplay.x = 10;
    wordDisplay.y = 10;
    uiScene.addChild(wordDisplay);

    const letterTexts = [];

    for (let i = 0; i < TARGET_WORD.length; i++) {
        const char = TARGET_WORD[i];
        const letterText = new PIXI.Text(char, {
            fill: "#555", // gray initially
            fontSize: 32,
            fontWeight: "bold"
        });
        letterText.x = i * 30; // spacing between letters
        wordDisplay.addChild(letterText);
        letterTexts.push(letterText);
    }

    // Timer display
    const timerText = new PIXI.Text(`Time: 0s`, {
        fill: "#fff",
        fontSize: 24
    });
    timerText.x = GAME_WIDTH - 120;
    timerText.y = 10;
    uiScene.addChild(timerText);

    // Controls
    const keys = {};
    window.addEventListener("keydown", e => keys[e.code] = true);
    window.addEventListener("keyup", e => keys[e.code] = false);

    // Create mobile controls if on a touch device

    function createMobileControls() {
        const btnSize = 60;
        const padding = 20;

        // --- Left Button ---
        const leftBtn = new PIXI.Graphics()
            .beginFill(0x4444ff, 0.5)
            .lineStyle(4, 0xffffff, 0.4)
            .drawCircle(0, 0, btnSize)
            .endFill();

        // Left arrow icon
        const leftArrow = new PIXI.Text("◀", {
            fontSize: 32,
            fill: 0xffffff,
            align: "center"
        });
        leftArrow.anchor.set(0.5);
        leftBtn.addChild(leftArrow);

        leftBtn.x = padding + btnSize;
        leftBtn.y = GAME_HEIGHT - padding - btnSize;
        leftBtn.interactive = true;
        leftBtn.cursor = "pointer";

        leftBtn.on("pointerdown", () => {
            keys["ArrowLeft"] = true;
            leftBtn.scale.set(1.2);
        });
        leftBtn.on("pointerup", () => {
            keys["ArrowLeft"] = false;
            leftBtn.scale.set(1);
        });
        leftBtn.on("pointerupoutside", () => {
            keys["ArrowLeft"] = false;
            leftBtn.scale.set(1);
        });

        // --- Right Button ---
        const rightBtn = new PIXI.Graphics()
            .beginFill(0x44ff44, 0.5)
            .lineStyle(4, 0xffffff, 0.4)
            .drawCircle(0, 0, btnSize)
            .endFill();

        // Right arrow icon
        const rightArrow = new PIXI.Text("▶", {
            fontSize: 32,
            fill: 0xffffff,
            align: "center"
        });
        rightArrow.anchor.set(0.5);
        rightBtn.addChild(rightArrow);

        rightBtn.x = padding + btnSize * 3; // a bit to the right of leftBtn
        rightBtn.y = GAME_HEIGHT - padding - btnSize;
        rightBtn.interactive = true;
        rightBtn.cursor = "pointer";

        rightBtn.on("pointerdown", () => {
            keys["ArrowRight"] = true;
            rightBtn.scale.set(1.2);
        });
        rightBtn.on("pointerup", () => {
            keys["ArrowRight"] = false;
            rightBtn.scale.set(1);
        });
        rightBtn.on("pointerupoutside", () => {
            keys["ArrowRight"] = false;
            rightBtn.scale.set(1);
        });

        // --- Shoot Button ---
        const shootBtn = new PIXI.Graphics()
            .beginFill(0xff4444, 0.5)
            .lineStyle(4, 0xffffff, 0.4)
            .drawCircle(0, 0, btnSize)
            .endFill();

        const shootIcon = new PIXI.Text("●", {
            fontSize: 32,
            fill: 0xffffff,
            align: "center"
        });
        shootIcon.anchor.set(0.5);
        shootBtn.addChild(shootIcon);

        shootBtn.x = GAME_WIDTH - padding - btnSize;
        shootBtn.y = GAME_HEIGHT - padding - btnSize;
        shootBtn.interactive = true;
        shootBtn.cursor = "pointer";

        shootBtn.on("pointerdown", () => {
            keys["Space"] = true;
            shootBtn.scale.set(1.2); // feedback
        });
        shootBtn.on("pointerup", () => {
            keys["Space"] = false;
            shootBtn.scale.set(1);
        });
        shootBtn.on("pointerupoutside", () => {
            keys["Space"] = false;
            shootBtn.scale.set(1);
        });

        // Add to scene
        gameScene.addChild(leftBtn, rightBtn, shootBtn);
    }

    if ('ontouchstart' in window || navigator.maxTouchPoints) {
        createMobileControls();
    }

    // Spawn enemy
    function spawnEnemy() {
    // Create a container so enemy shape + text stick together
    const enemy = new PIXI.Container();

    // Random emotion
    const emotion = NEGATIVE_EMOTIONS[Math.floor(Math.random() * NEGATIVE_EMOTIONS.length)];
    const color = EMOTION_COLORS[emotion];
    enemy.color = color;       // save color so bullets use same theme

    // Enemy circle
    const body = new PIXI.Graphics();
    body.beginFill(color);
    body.drawCircle(0, 0, 22);
    body.endFill();

    // outer glow
    const glow = new PIXI.Graphics();
    glow.beginFill(color, 0.3);
    glow.drawCircle(0, 0, 28);
    glow.endFill();

    enemy.addChild(glow, body);
    
    const label = new PIXI.Text(emotion, {
        fill: "#ffffff",
        fontSize: 14,
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3,
        dropShadow: true,
        dropShadowColor: "#000000",
        dropShadowBlur: 4,
        dropShadowDistance: 2,
        align: "center",
        wordWrap: true,
        wordWrapWidth: 40
    });
    label.anchor.set(0.5);
    enemy.addChild(label);

    // Position enemy
    enemy.x = Math.random() * (GAME_WIDTH - 50) + 25;
    enemy.y = 50;
    gameScene.addChild(enemy);
    enemies.push(enemy);

    // Small pulse animation
    // Define the pulsating function
    const pulse = () => {
        if (!enemy.parent) return; // guard if already removed
        enemy.scale.x = 1 + 0.1 * Math.sin(app.ticker.lastTime / 200);
        enemy.scale.y = 1 + 0.1 * Math.sin(app.ticker.lastTime / 200);
    };
  
    // Attach it
    app.ticker.add(pulse);

    // When enemy is killed:
    enemy.on('removed', () => {
        app.ticker.remove(pulse); // cleanup
    });

    // Shoot bullets every 1.5s
    enemy.shootInterval = setInterval(() => {
        if (!enemy.destroyed && !gameOver) {
            spawnEnemyBullet(enemy);
        }
    }, 1500);
    }

    function spawnEnemyBullet(enemy) {
        const bullet = new PIXI.Graphics();
        bullet.beginFill(enemy.color);
        bullet.drawRect(-3, -10, 6, 20);
        bullet.endFill();
        bullet.x = enemy.x;
        bullet.y = enemy.y + 20;
        gameScene.addChild(bullet);
        enemyBullets.push(bullet);
    }

    // Draw star
    function drawStar(graphics, x, y, radius, points, innerRadius, color) {
        graphics.beginFill(color);
        graphics.moveTo(x + radius, y);

        let angle = Math.PI / points;

        for (let i = 0; i < 2 * points; i++) {
            let r = i % 2 === 0 ? radius : innerRadius;
            let currX = x + Math.cos(i * angle) * r;
            let currY = y + Math.sin(i * angle) * r;
            graphics.lineTo(currX, currY);
        }

        graphics.closePath();
        graphics.endFill();
    }


    // Spawn collectible
    function spawnCollectible() {
    const letter = TARGET_WORD[Math.floor(Math.random() * TARGET_WORD.length)];
    const col = new PIXI.Text(letter, {
        fill: "#ffff00",
        fontSize: 32,
        fontWeight: "bold"
    });
    col.anchor.set(0.5);
    col.x = Math.random() * (GAME_WIDTH - 40) + 20;
    col.y = -20;
    col.letter = letter; // store letter on collectible
    gameScene.addChild(col);
    collectibles.push(col);
    }

    // Shoot projectile
    function shootProjectile() {
        const proj = new PIXI.Graphics();
        proj.beginFill(0xffff00);
        proj.drawRect(-3, -10, 6, 20);
        proj.endFill();
        proj.x = player.x;
        proj.y = player.y - 30;
        gameScene.addChild(proj);
        projectiles.push(proj);
    }

    // Collision check
    function hitTest(a, b) {
        const boundsA = a.getBounds();
        const boundsB = b.getBounds();
        return boundsA.x + boundsA.width > boundsB.x &&
            boundsA.x < boundsB.x + boundsB.width &&
            boundsA.y + boundsA.height > boundsB.y &&
            boundsA.y < boundsB.y + boundsB.height;
    }

    // Game loop
    app.ticker.add(() => {
        if (gameOver) return;

        // Update timer
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        timerText.text = `Time: ${elapsedTime}s`;

        // Move player
        if (keys["ArrowLeft"] || keys["KeyA"]) player.x -= PLAYER_SPEED;
        if (keys["ArrowRight"] || keys["KeyD"]) player.x += PLAYER_SPEED;
        player.x = Math.max(20, Math.min(GAME_WIDTH - 20, player.x));

        // Shooting
        if (keys["Space"]) {
            if (!player.lastShot || Date.now() - player.lastShot > 300) {
                shootProjectile();
                player.lastShot = Date.now();
            }
        }

        // Move projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            if (p.destroyed) continue;

            p.y -= PROJECTILE_SPEED;
            if (p.y < -20) {
                gameScene.removeChild(p);
                p.destroy();
                projectiles.splice(i, 1);
            }
        }

        // Move enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const en = enemies[i];
            if (en.destroyed) continue;

            // Collision with projectiles
            for (let j = projectiles.length - 1; j >= 0; j--) {
                const pr = projectiles[j];
                if (pr.destroyed) continue;

                if (hitTest(pr, en)) {
                    gameScene.removeChild(en);
                    en.destroy();
                    clearInterval(en.shootInterval); // stop shooting
                    enemies.splice(i, 1);

                    gameScene.removeChild(pr);
                    pr.destroy();
                    projectiles.splice(j, 1);
                    break;
                }
            }

            if (!en.destroyed && en.y > GAME_HEIGHT + 20) {
                gameScene.removeChild(en);
                en.destroy();
                enemies.splice(i, 1);
            }
        }

        // Move enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const b = enemyBullets[i];
            if (b.destroyed) continue;

            b.y += 5; // bullet speed

            // Hit player
            if (hitTest(player, b)) {
                endGame(false);
            }

            // Off screen
            if (b.y > GAME_HEIGHT + 20) {
                gameScene.removeChild(b);
                b.destroy();
                enemyBullets.splice(i, 1);
            }
        }

        // Move collectibles
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const c = collectibles[i];
            if (c.destroyed) continue;

            c.y += COLLECTIBLE_SPEED;

            // Collect
            if (hitTest(player, c)) {
                if (!collectedLetters.has(c.letter)) {
                    collectedLetters.add(c.letter);

                    // Update that letter’s color
                    for (let i = 0; i < TARGET_WORD.length; i++) {
                        if (TARGET_WORD[i] === c.letter) {
                            letterTexts[i].style.fill = "#ffff00"; // bright yellow when collected
                        }
                    }
                }

                gameScene.removeChild(c);
                c.destroy();
                collectibles.splice(i, 1);

                if (collectedLetters.size === TARGET_WORD.length) {
                    endGame(true);
                }
            }

            if (!c.destroyed && c.y > GAME_HEIGHT + 20) {
                gameScene.removeChild(c);
                c.destroy();
                collectibles.splice(i, 1);
            }
        }


    });

    // Spawning intervals
    setInterval(spawnEnemy, 4000);
    setInterval(spawnCollectible, 2000);

    // End game
    function endGame(win) {
        gameOver = true;
        gameScene.visible = false;
        uiScene.removeChild(timerText);
        const msg = win ? "Mission Complete!" : "Mission Failed";
        const winText = new PIXI.Text(msg, {
            fill: win ? "#00ff66" : "#ff3333",
            fontSize: 48,
            fontWeight: "bold"
        });
        winText.anchor.set(0.5);
        winText.x = GAME_WIDTH / 2;
        winText.y = GAME_HEIGHT / 2 - 80;
        uiScene.addChild(winText);

        // Play Again button
        const playAgain = new PIXI.Text("▶ Play Again", {
            fill: "#ffffff",
            fontSize: 32,
            fontWeight: "bold"
        });
        playAgain.anchor.set(0.5);
        playAgain.x = GAME_WIDTH / 2;
        playAgain.y = GAME_HEIGHT / 2;
        playAgain.interactive = true;
        playAgain.buttonMode = true;
        playAgain.cursor = "pointer";

        playAgain.on("pointerover", () => playAgain.style.fill = "#ffff66");
        playAgain.on("pointerout", () => playAgain.style.fill = "#ffffff");
        playAgain.on("pointerdown", resetGame);

        uiScene.addChild(playAgain);

        // If player won:
        if (win) {
            const timeResult = new PIXI.Text(`⏱ Time: ${elapsedTime}s`, {
                fill: "#ffffff",
                fontSize: 28,
                fontWeight: "bold"
            });
            timeResult.anchor.set(0.5);
            timeResult.x = GAME_WIDTH / 2;
            timeResult.y = GAME_HEIGHT / 2 + 60;
            uiScene.addChild(timeResult);

            const link = new PIXI.Text("🎵 Listen to 'SOLDIER'", {
                fill: "#44ccff",
                fontSize: 28,
                fontWeight: "bold"
            });
            link.anchor.set(0.5);
            link.x = GAME_WIDTH / 2;
            link.y = GAME_HEIGHT / 2 + 110;
            link.interactive = true;
            link.buttonMode = true;
            link.cursor = "pointer";
            link.on("pointerover", () => link.style.fill = "#88ddff");
            link.on("pointerout", () => link.style.fill = "#44ccff");
            link.on("pointerdown", () => {
                window.open("https://my-portfolio-website-silk-five.vercel.app/home", "_blank");
            });
            uiScene.addChild(link);
        }
    }

    // Reset game state
    function resetGame() {
        // Clear UI
        uiScene.removeChildren();

        // Reset variables
        collectedLetters.clear();
        timerText.text = `Time: 0s`;
        gameOver = false;
        startTime = Date.now();
        elapsedTime = 0;
        
        // Remove old objects
        [...projectiles, ...enemies, ...collectibles, ...enemyBullets].forEach(obj => {
            if (!obj.destroyed) obj.destroy();
        });
        projectiles.length = 0;
        enemies.length = 0;
        collectibles.length = 0;
        enemyBullets.length = 0;

        // Reset player
        player.x = GAME_WIDTH / 2;
        player.y = GAME_HEIGHT - 50;

        // Reset collected letters (set all back to gray)
        letterTexts.forEach(letter => {
            letter.style.fill = "#555"; 
        });

        // Show scene again
        gameScene.visible = true;
        uiScene.addChild(wordDisplay, timerText);
    }

    // Start the game
    resetGame();
})();