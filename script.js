(() => {
    // Config
    const GAME_WIDTH = 800;
    const GAME_HEIGHT = 600;
    const PLAYER_SPEED = 5;
    const PROJECTILE_SPEED = 8;
    const ENEMY_SPEED = 3;
    const COLLECTIBLE_SPEED = 2;
    const TARGET_SCORE = 5;

    // App setup
    const app = new PIXI.Application({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x111111,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });
    document.getElementById("game-container").appendChild(app.view);

    // Resize to fit screen
    function resize() {
        const scaleX = window.innerWidth / GAME_WIDTH;
        const scaleY = window.innerHeight / GAME_HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        app.view.style.transform = `scale(${scale})`;
        app.view.style.transformOrigin = "top left";
    }
    window.addEventListener("resize", resize);
    resize();

    // Game state
    let score = 0;
    let gameOver = false;

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

    // UI
    const scoreText = new PIXI.Text(`Score: ${score}`, {
        fill: "#fff",
        fontSize: 24
    });
    scoreText.x = 10;
    scoreText.y = 10;
    uiScene.addChild(scoreText);

    // Controls
    const keys = {};
    window.addEventListener("keydown", e => keys[e.code] = true);
    window.addEventListener("keyup", e => keys[e.code] = false);

    // Create mobile controls if on a touch device
    function createMobileControls() {
        const btnSize = 60;
        const padding = 20;

        const leftBtn = new PIXI.Graphics()
            .beginFill(0xffffff, 0.2)
            .drawCircle(0, 0, btnSize)
            .endFill();
        leftBtn.x = padding + btnSize;
        leftBtn.y = GAME_HEIGHT - padding - btnSize;
        leftBtn.interactive = true;
        leftBtn.cursor = "pointer";
        leftBtn.on("pointerdown", () => keys["ArrowLeft"] = true);
        leftBtn.on("pointerup", () => keys["ArrowLeft"] = false);
        leftBtn.on("pointerupoutside", () => keys["ArrowLeft"] = false);

        const rightBtn = new PIXI.Graphics()
            .beginFill(0xffffff, 0.2)
            .drawCircle(0, 0, btnSize)
            .endFill();
        rightBtn.x = leftBtn.x + btnSize * 2;
        rightBtn.y = leftBtn.y;
        rightBtn.interactive = true;
        rightBtn.cursor = "pointer";
        rightBtn.on("pointerdown", () => keys["ArrowRight"] = true);
        rightBtn.on("pointerup", () => keys["ArrowRight"] = false);
        rightBtn.on("pointerupoutside", () => keys["ArrowRight"] = false);

        gameScene.addChild(leftBtn, rightBtn);
    }

    if ('ontouchstart' in window || navigator.maxTouchPoints) {
        createMobileControls();
    }

    // Spawn enemy
    function spawnEnemy() {
        const enemy = new PIXI.Graphics();
        enemy.beginFill(0xff3333);
        enemy.drawCircle(0, 0, 20);
        enemy.endFill();
        enemy.x = Math.random() * (GAME_WIDTH - 40) + 20;
        enemy.y = -20;
        gameScene.addChild(enemy);
        enemies.push(enemy);
    }

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
        const col = new PIXI.Graphics();
        drawStar(col, 0, 0, 10, 5, 5, 0xffff00);
        col.x = Math.random() * (GAME_WIDTH - 20) + 10;
        col.y = -20;
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

    // Simple collision check
    function hitTest(a, b) {
        const ab = a.getBounds();
        const bb = b.getBounds();
        return ab.x + ab.width > bb.x &&
            ab.x < bb.x + bb.width &&
            ab.y + ab.height > bb.y &&
            ab.y < bb.y + bb.height;
    }

    // Game loop
    app.ticker.add(() => {
        if (gameOver) return;

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

            en.y += ENEMY_SPEED;

            // Collision with player
            if (hitTest(player, en)) {
                endGame(false);
            }

            // Collision with projectiles
            for (let j = projectiles.length - 1; j >= 0; j--) {
                const pr = projectiles[j];
                if (pr.destroyed) continue;

                if (hitTest(pr, en)) {
                    gameScene.removeChild(en);
                    en.destroy();
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

        // Move collectibles
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const c = collectibles[i];
            if (c.destroyed) continue;

            c.y += COLLECTIBLE_SPEED;

            // Collect
            if (hitTest(player, c)) {
                score++;
                scoreText.text = `Score: ${score}`;
                gameScene.removeChild(c);
                c.destroy();
                collectibles.splice(i, 1);

                if (score >= TARGET_SCORE) {
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
    setInterval(spawnEnemy, 1500);
    setInterval(spawnCollectible, 3000);

    // End game
    function endGame(win) {
        gameOver = true;
        gameScene.visible = false;

        const msg = win ? "Mission Complete!" : "Mission Failed";
        const winText = new PIXI.Text(msg, {
            fill: win ? "#00ff66" : "#ff3333",
            fontSize: 48,
            fontWeight: "bold"
        });
        winText.anchor.set(0.5);
        winText.x = GAME_WIDTH / 2;
        winText.y = GAME_HEIGHT / 2 - 50;
        uiScene.addChild(winText);

        if (win) {
            const link = new PIXI.Text("🎵 Listen to 'SOLDIER'", {
                fill: "#44ccff",
                fontSize: 28,
                fontWeight: "bold"
            });
            link.anchor.set(0.5);
            link.x = GAME_WIDTH / 2;
            link.y = GAME_HEIGHT / 2 + 30;
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
})();