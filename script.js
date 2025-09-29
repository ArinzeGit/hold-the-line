(() => {
    // Config
    const GAME_WIDTH = 1000;
    const GAME_HEIGHT = 600;
    const PLAYER_SPEED = 5;
    const PROJECTILE_SPEED = 8;
    const COLLECTIBLE_SPEED = 2;
    const TARGET_WORD = "SOLDIER";
    const NEGATIVE_EMOTIONS = [
        "Fear", "Anxiety", "Anger", "Despair", "Guilt"
    ];
    const EMOTION_COLORS = {
        "Fear": 0x4A6CFF,  //blue
        "Anxiety": 0xFF6EC7, //pink
        "Anger": 0xFF3333,  //red
        "Despair": 0x8A2BE2,  //purple
        "Guilt": 0x00D1A0  //green
    };

    // Placeholder leaderboard
    let leaderboard = [
        { name: "Alice", score: 41 },
        { name: "Bob", score: 37 },
        { name: "Charlie", score: 33 },
        { name: "Dana", score: 28 },
        { name: "Eli", score: 23 },
    ];

    // App setup
    const app = new PIXI.Application({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x111111,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });
    document.getElementById("game-container").appendChild(app.view);

    function checkOrientation() {
        const isPortrait = window.innerHeight > window.innerWidth;
        const isMobile ='ontouchstart' in window || navigator.maxTouchPoints

        const overlay = document.getElementById("rotate-overlay");

        if (isMobile && isPortrait) {
            overlay.style.display = "flex";
        } else {
            overlay.style.display = "none";
        }
    }

    document.getElementById("close-overlay").addEventListener("click", () => {
    document.getElementById("rotate-overlay").style.display = "none";
    });

    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    checkOrientation();

    function resize() {
        // Compute scale
        const scaleX = window.innerWidth / GAME_WIDTH;
        const scaleY = window.innerHeight / GAME_HEIGHT;
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
    const gameOverScene = new PIXI.Container();
    app.stage.addChild(gameScene, uiScene,gameOverScene);
    gameOverScene.visible = false;

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
            fontWeight: "bold",
            fontFamily: "Verdana",
            stroke: "#000000",
            strokeThickness: 4
        });
        letterText.x = i * 30; // spacing between letters
        wordDisplay.addChild(letterText);
        letterTexts.push(letterText);
    }

    // Timer display
    const timerText = new PIXI.Text(`Time left: 60s`, {
        fill: "#fff",
        fontSize: 24,
        fontFamily: "Verdana",
        stroke: "#000000",
        strokeThickness: 4
    });
    timerText.x = GAME_WIDTH - 200;
    timerText.y = 10;
    uiScene.addChild(timerText);

    // Controls
    const keys = {};
    window.addEventListener("keydown", e => keys[e.code] = true);
    window.addEventListener("keyup", e => keys[e.code] = false);

    // Create mobile controls if on a touch device
    const btnSize = 100;
    const padding = btnSize * 0.2;

    function createButton(label, color, x, y, onPress, onRelease) {
        const btn = new PIXI.Container();

        // Glow background (soft halo)
        const glow = new PIXI.Graphics()
            .beginFill(color, 0.15)
            .drawCircle(0, 0, btnSize * 1.2)
            .endFill();
        glow.alpha = 0.4;

        // Outer outline
        const outer = new PIXI.Graphics()
            .lineStyle(4, color, 0.9)       // border
            .beginFill(0x000000, 0.15)      // subtle transparency inside
            .drawCircle(0, 0, btnSize)
            .endFill();

        // Label (cleaner + holographic stroke)
        const text = new PIXI.Text(label, {
            fontSize: 38,
            fill: color,
            fontWeight: "900",
            stroke: 0x000000,
            strokeThickness: 5
        });
        text.anchor.set(0.5);

        btn.addChild(glow, outer, text);
        btn.x = x;
        btn.y = y;
        btn.interactive = true;
        btn.cursor = "pointer";

        // Scale animation on press
        let targetScale = 1;
        function animateScale() {
            btn.scale.x += (targetScale - btn.scale.x) * 0.3;
            btn.scale.y += (targetScale - btn.scale.y) * 0.3;
        }
        PIXI.Ticker.shared.add(animateScale);

        btn.on("pointerdown", () => {
            targetScale = 0.85;  // shrink slightly
            glow.alpha = 0.7;    // brighten glow
            onPress();
        });
        btn.on("pointerup", () => {
            targetScale = 1;
            glow.alpha = 0.4;    // reset glow
            onRelease();
        });
        btn.on("pointerupoutside", () => {
            targetScale = 1;
            glow.alpha = 0.4;
            onRelease();
        });

        return btn;
    }

    function createMobileControls() {
        // Left
        const leftBtn = createButton("◀", 0x06D6A0, padding + btnSize, GAME_HEIGHT - btnSize - padding,
            () => keys["ArrowLeft"] = true,
            () => keys["ArrowLeft"] = false
        );

        // Right
        const rightBtn = createButton("▶", 0x06D6A0, padding * 2 + btnSize * 3, GAME_HEIGHT - btnSize - padding,
            () => keys["ArrowRight"] = true,
            () => keys["ArrowRight"] = false
        );

        // Shoot
        const shootBtn = createButton("●", 0xEF233C, GAME_WIDTH - padding - btnSize, GAME_HEIGHT - btnSize - padding,
            () => keys["Space"] = true,
            () => keys["Space"] = false
        );

        gameScene.addChild(leftBtn, rightBtn, shootBtn);

    }

    if ('ontouchstart' in window || navigator.maxTouchPoints) {
        createMobileControls();
    }

    // Player
    const player = new PIXI.Graphics();
    player.beginFill(0x00ff66);
    player.drawRect(-20, -20, 40, 40); // placeholder
    player.endFill();
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 50;
    gameScene.addChild(player);

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

    // Spawn collectible
    function spawnCollectible() {
    const letter = TARGET_WORD[Math.floor(Math.random() * TARGET_WORD.length)];
    const col = new PIXI.Text(letter, {
        fill: "#ffff00",
        fontSize: 32,
        fontWeight: "bold",
        fontFamily: "Verdana",
        stroke: "#000000",
        strokeThickness: 4
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
        timerText.text = `Time left: ${60 - elapsedTime}s`;
        if (elapsedTime >= 60) {
            timerText.text = `Time up!`;
            endGame(false);
            return;
        }
 
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
                endGame(true); // For testing win scenario. Normally would be:
                // endGame(false);
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
    let enemySpawnInterval = null;
    let collectibleSpawnInterval = null;

    function startSpawning() {
        // clear any old intervals before starting new
        stopSpawning();

        enemySpawnInterval = setInterval(spawnEnemy, 4000);
        collectibleSpawnInterval = setInterval(spawnCollectible, 2000);
    }

    function stopSpawning() {
        if (enemySpawnInterval) {
            clearInterval(enemySpawnInterval);
            enemySpawnInterval = null;
        }
        if (collectibleSpawnInterval) {
            clearInterval(collectibleSpawnInterval);
            collectibleSpawnInterval = null;
        }
        enemies.forEach(en => clearInterval(en.shootInterval));
    }

    // Initial spawn
    startSpawning();

    // Leaderboard input handling
    let activeInput = null;
    let saveButton = null;
    let inputRowX = 0, inputRowY = 0, inputRowWidth = 0;
    let inputLeaderboardContainer = null;
    // Function to position input and save button over the correct leaderboard row
    function positionLeaderboardInputAndSaveBtn() {
        if (!activeInput) return;

        const canvasRect = app.view.getBoundingClientRect();

        // Convert local coords to global
        const globalInputPosition = inputLeaderboardContainer.toGlobal(new PIXI.Point(inputRowX, inputRowY));
        const globalInputEndPosition = inputLeaderboardContainer.toGlobal(new PIXI.Point(inputRowX + inputRowWidth, inputRowY));

        // Screen width for this row
        const screenWidth = globalInputEndPosition.x - globalInputPosition.x;

        // Stage scale
        const scale = app.stage.scale.x;

        // Apply positioning + scaling
        activeInput.style.left = canvasRect.left + globalInputPosition.x * 1.07 + "px"; // *1.07 offset to align with text
        activeInput.style.top = canvasRect.top + globalInputPosition.y + "px";
        activeInput.style.transform = "translateY(-50%)"; // vertical centering
        activeInput.style.width = (screenWidth * 0.75) + "px"; // *0.75 to leave room for score
        activeInput.style.fontSize = `${24 * scale}px`;
        saveButton.style.left = canvasRect.left + globalInputEndPosition.x * 1.02 + "px";
        saveButton.style.top = canvasRect.top + globalInputPosition.y + "px";
        saveButton.style.transform = "translateY(-50%)"; // vertical centering
        saveButton.style.fontSize = `${16 * scale}px`;
    }

    // Keep input and button synced after resize/orientation
    window.addEventListener("resize", () => {
        resize();
        positionLeaderboardInputAndSaveBtn();
    });
    window.addEventListener("orientationchange", () => {
        resize();
        positionLeaderboardInputAndSaveBtn();
    });

    // End game
    function endGame(win) {
        stopSpawning();
        gameOver = true;
        gameScene.visible = false;
        gameOverScene.removeChildren();
        gameOverScene.visible = true;

        // Mission Complete / Failed
        const msg = win ? "Mission Complete!" : "Mission Failed";
        const resultText = new PIXI.Text(msg, {
            fill: win ? "#00ff66" : "#ff3333",
            fontSize: 48,
            fontWeight: "bold"
        });
        resultText.anchor.set(0.5);
        resultText.x = GAME_WIDTH / 2;
        resultText.y = 80;
        gameOverScene.addChild(resultText);

        // Calculate score
        let score = 0; // default score
        if (win) { score = 60 - elapsedTime; }

        // Label (always white)
        const labelText = new PIXI.Text("Your score:", {
            fill: "#ffffff",
            fontSize: 28,
            fontWeight: "bold"
        });

        // Value (green/red)
        const valueText = new PIXI.Text(`${score}`, {
            fill: "#00ff66",
            fontSize: 28,
            fontWeight: "bold"
        });

        // Compute total width (with small spacing)
        const spacing = 10;
        const totalWidth = labelText.width + spacing + valueText.width;

        // Center the whole block
        const startX = (GAME_WIDTH - totalWidth) / 2;
        const y = 130;

        labelText.x = startX;
        labelText.y = y;

        valueText.x = startX + labelText.width + spacing;
        valueText.y = y;

        gameOverScene.addChild(labelText, valueText);

        // Leaderboard title
        const lbTitle = new PIXI.Text("🏆 Top 5 Soldiers", {
            fill: "#ffff00",
            fontSize: 32,
            fontWeight: "bold"
        });
        lbTitle.anchor.set(0.5);
        lbTitle.x = GAME_WIDTH / 2;
        lbTitle.y = 210;
        gameOverScene.addChild(lbTitle);

        // Leaderboard
        const leaderboardContainer = new PIXI.Container();
        gameOverScene.addChild(leaderboardContainer);

        // Check if player qualifies for leaderboard
        const worstEntry = leaderboard[leaderboard.length - 1];
        let qualifies = score > worstEntry.score;
        if (qualifies) {
            // Insert placeholder with a marker until we collect name
            leaderboard.push({ name: "???", score, pending: true });
            leaderboard.sort((a, b) => b.score - a.score);
            leaderboard = leaderboard.slice(0, 5);
        }

        // Clear previous entries
        leaderboardContainer.removeChildren().forEach(c => c.destroy());

         // Set a fixed row width (so scores align neatly)
        const rowWidth = 255;

        // Draw each entry
        let leaderboardYStart = 250;
        leaderboard.forEach((entry, i) => {
            const yPos = leaderboardYStart + i * 30;

            // Row container
            const row = new PIXI.Container();
            row.y = yPos;

            // Rank + name (white, left aligned)
            const nameText = new PIXI.Text(
                `${i + 1}. ${entry.name}`,
                { fill: "#ffffff", fontSize: 24 }
            );
            nameText.anchor.set(0, 0.5);  // left aligned
            nameText.x = 0;

            // Score (green, right aligned within row)
            const scoreText = new PIXI.Text(
                `${entry.score}`,
                { fill: "#00ff66", fontSize: 24 }
            );
            scoreText.anchor.set(1, 0.5); // right aligned
            scoreText.x = rowWidth;

            row.addChild(nameText, scoreText);

            // Center row container as a block
            row.x = GAME_WIDTH / 2 - rowWidth / 2;

            leaderboardContainer.addChild(row);
        });

        // If qualified → ask for name with input box
        if (qualifies) {
            // Find the index of the pending "???" entry
            const index = leaderboard.findIndex(e => e.pending);
            const rowY = leaderboardYStart + index * 30;
            
            // Determine input box position (within canvas coords)
            const inputX = GAME_WIDTH / 2 - rowWidth / 2;
            const inputY = rowY;    

            // Create input overlay
            const input = document.createElement("input");
            input.className = "lb-input";
            input.type = "text";
            input.maxLength = 10;
            input.placeholder = "Your name";
            input.style.position = "absolute";
            input.style.fontWeight = "bold";
            input.style.background = "black";
            input.style.color = "white";
            input.style.border = "none";
            input.style.outline = "none";
            input.style.textAlign = "left";

            // Create save Button
            const button = document.createElement("button");
            button.className = "lb-save";
            button.textContent = "Save";
            button.style.position = "absolute";
            button.style.padding = "0.3em 0.5em";
            button.style.borderRadius = "0.5em";
            button.style.border = "none";
            button.style.background = "#00ff66";
            button.style.color = "#000";
            button.style.fontWeight = "bold";
            button.style.cursor = "pointer";

            // Save references for positioning
            activeInput = input;
            saveButton = button;
            inputRowX = inputX;
            inputRowY = inputY;
            inputRowWidth = rowWidth;
            inputLeaderboardContainer = leaderboardContainer;

            // Initial positioning before appending input and button
            positionLeaderboardInputAndSaveBtn();

            document.body.appendChild(input);
            document.body.appendChild(button);
            input.focus();

            function saveName() {
                if (!input.value.trim()) return;
                const playerName = input.value.trim();
                leaderboard[index].name = playerName;
                delete leaderboard[index].pending;

                // Clean up input
                document.body.removeChild(input);
                document.body.removeChild(button);
                activeInput = null;
                saveButton = null;

                // Redraw leaderboard
                leaderboardContainer.removeChildren().forEach(c => c.destroy());
                leaderboard.forEach((entry, i) => {
                    const yPos = leaderboardYStart + i * 30;

                    // Row container
                    const row = new PIXI.Container();
                    row.y = yPos;

                    // Rank + name (white, left aligned)
                    const nameText = new PIXI.Text(
                        `${i + 1}. ${entry.name}`,
                        { fill: "#ffffff", fontSize: 24 }
                    );
                    nameText.anchor.set(0, 0.5);  // left aligned
                    nameText.x = 0;
                    nameText.y = 0;

                    // Score (green, right aligned within row)
                    const scoreText = new PIXI.Text(
                        `${entry.score}`,
                        { fill: "#00ff66", fontSize: 24 }
                    );
                    scoreText.anchor.set(1, 0.5); // right aligned
                    scoreText.x = rowWidth;
                    scoreText.y = 0;

                    row.addChild(nameText, scoreText);

                    // Center row container as a block
                    row.x = GAME_WIDTH / 2 - rowWidth / 2;

                    leaderboardContainer.addChild(row);
                });
            }

           input.addEventListener("keydown", e => e.key === "Enter" && saveName());

            button.addEventListener("click", saveName);
        }

        // Album link
        const link = new PIXI.Text("🎵 Listen to 'SOLDIER'", {
            fill: "#44ccff",
            fontSize: 28,
            fontWeight: "bold"
        });
        link.anchor.set(0.5);
        link.x = GAME_WIDTH / 2;
        link.y = GAME_HEIGHT - 140;
        link.interactive = true;
        link.buttonMode = true;
        link.cursor = "pointer";
        link.on("pointerover", () => link.style.fill = "#88ddff");
        link.on("pointerout", () => link.style.fill = "#44ccff");
        link.on("pointerdown", () => {
            window.open("https://github.com/ArinzeGit", "_blank");
        });
        gameOverScene.addChild(link);

        // Play Again button
        const playAgain = new PIXI.Text("▶ Play Again", {
            fill: "#ffffff",
            fontSize: 32,
            fontWeight: "bold"
        });
        playAgain.anchor.set(0.5);
        playAgain.x = GAME_WIDTH / 2;
        playAgain.y = GAME_HEIGHT - 80;
        playAgain.interactive = true;
        playAgain.buttonMode = true;
        playAgain.cursor = "pointer";
        playAgain.on("pointerover", () => playAgain.style.fill = "#ffff66");
        playAgain.on("pointerout", () => playAgain.style.fill = "#ffffff");
        playAgain.on("pointerdown", resetGame);
        gameOverScene.addChild(playAgain);
    }

    // Reset game state
    function resetGame() {
        // Reset controls in case endgame destroyed buttons abruptly on mobile
        keys["ArrowLeft"] = false;
        keys["ArrowRight"] = false;
        keys["Space"] = false;

        gameOverScene.visible = false;
        gameScene.visible = true;

        // Reset variables
        collectedLetters.clear();
        timerText.text = `Time left: 60s`;
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

        // Clear any existing input boxes and save buttons 
        document.querySelectorAll(".lb-input, .lb-save").forEach(el => el.remove());

        activeInput = null;
        saveButton = null;
        leaderboard.forEach(entry => {
            if (entry.pending) delete entry.pending;
        });

        startSpawning();
    }

    // Start the game
    resetGame();
})();