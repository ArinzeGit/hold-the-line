(async() => {

     // Wait for Orbitron font to load before creating any PIXI.Text
    await document.fonts.load('20px "Orbitron"');
    await document.fonts.ready;
    console.log("Orbitron font loaded — starting game...");

    // Config
    const GAME_WIDTH = 1000;
    const GAME_HEIGHT = 600;
    const PLAYER_SPEED = 5;
    const PROJECTILE_SPEED = 8;
    const COLLECTIBLE_SPEED = 2;
    const TARGET_WORD = "SOLDIER";
    const overlay = document.getElementById("touch-overlay");
    const MOVE_THRESHOLD = 10; // pixels
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

    // App setup
    const app = new PIXI.Application({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x111111,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });

    const view = app.view;
    view.style.position = "absolute";
    view.style.display = "block"; // removes inline gaps if parent uses inline-block
    document.getElementById("game-container").appendChild(view);

    // Store initial viewport height to prevent issues with dynamic address bars/keyboards
    let initialViewportHeight = window.innerHeight;
    
    // Resize function (used for both loading and game)
    function resize() {
        // Use the larger of initial height or current innerHeight to prevent cropping
        // This handles Safari's address bar and Chrome's keyboard
        const viewportHeight = Math.max(initialViewportHeight, window.innerHeight);
        const viewportWidth = window.innerWidth;
        
        const scaleX = viewportWidth / GAME_WIDTH;
        const scaleY = viewportHeight / GAME_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        const newWidth = Math.floor(GAME_WIDTH * scale);
        const newHeight = Math.floor(GAME_HEIGHT * scale);

        app.renderer.resize(newWidth, newHeight);

        // Center using the actual window dimensions (not the stored height)
        view.style.left = `${(window.innerWidth - newWidth) / 2}px`;
        view.style.top = `${(window.innerHeight - newHeight) / 2}px`;

        app.stage.scale.set(scale);
    }

    // Debounce resize to handle rapid viewport changes
    let resizeTimeout = null;
    function debouncedResize() {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
            resize();
            resizeTimeout = null;
        }, 150);
    }

    // Initial resize
    resize();
    
    // Update initial height after a delay to capture stable viewport (Safari)
    setTimeout(() => {
        initialViewportHeight = Math.max(initialViewportHeight, window.innerHeight);
        resize();
    }, 500);
    
    window.addEventListener("resize", debouncedResize);
    window.addEventListener("orientationchange", () => {
        // Reset initial height on orientation change
        setTimeout(() => {
            initialViewportHeight = window.innerHeight;
            resize();
        }, 100);
    });
    
    // Handle keyboard show/hide - update initial height when keyboard closes
    let keyboardClosedHeight = null;
    window.addEventListener("resize", () => {
        // If viewport height increases, keyboard likely closed
        if (window.innerHeight > initialViewportHeight) {
            initialViewportHeight = window.innerHeight;
        }
    });

    // Create loading scene
    const loadingScene = new PIXI.Container();
    const loadingText = new PIXI.Text("Loading...", {
        fill: "#ffffff",
        fontSize: 36,
        fontFamily: "Orbitron",
        fontWeight: "bold"
    });
    loadingText.anchor.set(0.5);
    loadingText.x = GAME_WIDTH / 2;
    loadingText.y = GAME_HEIGHT / 2;
    loadingScene.addChild(loadingText);

    const progressText = new PIXI.Text("0%", {
        fill: "#00ff66",
        fontSize: 24,
        fontFamily: "Orbitron"
    });
    progressText.anchor.set(0.5);
    progressText.x = GAME_WIDTH / 2;
    progressText.y = GAME_HEIGHT / 2 + 50;
    loadingScene.addChild(progressText);

    app.stage.addChild(loadingScene);
    loadingScene.visible = true;

    // Asset loading function
    async function loadAllAssets() {
        const assetPaths = [
            'assets/game-scene-bg.png',
            'assets/hold-the-line-art.png',
            'assets/soldier-album-art.png',
            'assets/soldier-sprite-gamePlay.png',
            'assets/soldier-sprite-endgame.png',
            'assets/enemy-sprites/fear-sprite.png',
            'assets/enemy-sprites/anxiety-sprite.png',
            'assets/enemy-sprites/anger-sprite.png',
            'assets/enemy-sprites/despair-sprite.png',
            'assets/enemy-sprites/guilt-sprite.png'
        ];

        // Load textures using PIXI.Assets
        const totalAssets = assetPaths.length;
        let loadedAssets = 0;

        // Update progress
        const updateProgress = () => {
            const percent = Math.floor((loadedAssets / totalAssets) * 100);
            progressText.text = `${percent}%`;
        };

        // Load all textures
        const texturePromises = assetPaths.map(path => {
            return PIXI.Assets.load(path).then(() => {
                loadedAssets++;
                updateProgress();
            });
        });

        await Promise.all(texturePromises);
        console.log("All textures loaded");
    }

    // Sound loading function
    function loadSounds() {
        return new Promise((resolve) => {
            const soundConfigs = [
                { name: 'backgroundMusic', src: ['/assets/sounds/killer-by-manfred.mp3'], loop: true, volume: 1 },
                { name: 'shootSound', src: ['/assets/sounds/short-laser-gun-shot.wav'] },
                { name: 'enemyDeathSound', src: ['/assets/sounds/quick-knife-slice-cutting.wav'] },
                { name: 'gotCollectibleSound', src: ['/assets/sounds/sparkle-hybrid-transition.wav'] },
                { name: 'playerDeathSound', src: ['/assets/sounds/male-death-sound.wav'] },
                { name: 'countdownSound', src: ['/assets/sounds/countdown-from-10.wav'] },
                { name: 'winSound', src: ['/assets/sounds/winning-chimes.wav'] },
                { name: 'loseSound', src: ['/assets/sounds/circus-lose.wav'] },
                { name: 'congratulationsSound', src: ['/assets/sounds/congratulations.wav'] },
                { name: 'missionFailedSound', src: ['/assets/sounds/mission-failed.wav'] },
                { name: 'leaderboardApplauseSound', src: ['/assets/sounds/auditorium-moderate-applause-and-cheering.wav'] }
            ];

            const sounds = {};
            let loadedCount = 0;
            const totalSounds = soundConfigs.length;

            soundConfigs.forEach(config => {
                const sound = new Howl({
                    src: config.src,
                    loop: config.loop || false,
                    volume: config.volume || 1,
                    onload: () => {
                        loadedCount++;
                        if (loadedCount === totalSounds) {
                            console.log("All sounds loaded");
                            resolve(sounds);
                        }
                    },
                    onloaderror: (id, error) => {
                        console.warn(`Failed to load sound ${config.name}:`, error);
                        loadedCount++;
                        if (loadedCount === totalSounds) {
                            resolve(sounds);
                        }
                    }
                });
                sounds[config.name] = sound;
            });
        });
    }

    // Declare sound variables in outer scope
    let backgroundMusic, shootSound, enemyDeathSound, gotCollectibleSound, 
        playerDeathSound, countdownSound, winSound, loseSound, 
        congratulationsSound, missionFailedSound, leaderboardApplauseSound;

    // Load everything before starting
    try {
        await loadAllAssets();
        const sounds = await loadSounds();
        
        // Assign sounds to variables
        backgroundMusic = sounds.backgroundMusic;
        shootSound = sounds.shootSound;
        enemyDeathSound = sounds.enemyDeathSound;
        gotCollectibleSound = sounds.gotCollectibleSound;
        playerDeathSound = sounds.playerDeathSound;
        countdownSound = sounds.countdownSound;
        winSound = sounds.winSound;
        loseSound = sounds.loseSound;
        congratulationsSound = sounds.congratulationsSound;
        missionFailedSound = sounds.missionFailedSound;
        leaderboardApplauseSound = sounds.leaderboardApplauseSound;

        // Hide loading scene and initialize game
        loadingScene.visible = false;
        initializeGame();
    } catch (error) {
        console.error("Error loading assets:", error);
        loadingText.text = "Loading failed. Please refresh.";
        progressText.text = "";
    }

    // Placeholder leaderboard
    let leaderboard = [
        { name: "Alice", score: 43 },
        { name: "Bob", score: 38 },
        { name: "Charlie", score: 33 },
        { name: "Dana", score: 28 },
        { name: "Eli", score: 23 },
    ];

    function initializeGame() {
    // Resize function is already defined above and event listeners are already attached

    function checkOrientation() {
        const isPortrait = window.innerHeight > window.innerWidth;
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints;

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

    // Game state
    let collectedLetters = new Set();
    let gameOver = false;
    let startTime = 0;
    let elapsedTime = 0; // in seconds
    let isCountdownPlaying = false;
    let backgroundMusicTimeout = null; // Track delayed background music timeout
    let musicEnabled = false; // Track if user has enabled music
    let musicButtonContainer = null; // Music enable button container

     // Arrays
    const projectiles = [];
    const enemies = [];
    const collectibles = [];
    const enemyBullets = [];

    // Background - use preloaded texture
    const backgroundTexture = PIXI.Assets.get("assets/game-scene-bg.png");
    const backgroundSprite = new PIXI.Sprite(backgroundTexture);

    // Resize to fit game scene
    backgroundSprite.width = GAME_WIDTH;
    backgroundSprite.height = GAME_HEIGHT;

    // Add to stage (at the very back)
    app.stage.addChildAt(backgroundSprite, 0);

    // Game Scenes
    const startScene = new PIXI.Container();

    const gameScene = new PIXI.Container();
    // containers for layering
    const bulletCollectibleContainer = new PIXI.Container();
    const playerEnemyContainer = new PIXI.Container();
    const uiContainer = new PIXI.Container();
    gameScene.addChild(bulletCollectibleContainer, playerEnemyContainer, uiContainer);

    const gameOverScene = new PIXI.Container();

    app.stage.addChild(startScene, gameOverScene, gameScene);
    startScene.visible = false; // Will be shown after loading
    gameScene.visible = false;
    gameOverScene.visible = false;
    disableOverlay();

    // Start Scene - create dynamic background
    // Dark gradient background
    const bgGraphics = new PIXI.Graphics();
    
    // Create gradient effect using multiple rectangles
    const gradientSteps = 20;
    for (let i = 0; i < gradientSteps; i++) {
        const alpha = 1 - (i / gradientSteps) * 0.3;
        const y = (GAME_HEIGHT / gradientSteps) * i;
        const color = i < gradientSteps / 2 
            ? 0x0a0a0a  // Darker at top
            : 0x1a1a1a; // Slightly lighter at bottom
        bgGraphics.beginFill(color, alpha);
        bgGraphics.drawRect(0, y, GAME_WIDTH, GAME_HEIGHT / gradientSteps + 1);
        bgGraphics.endFill();
    }
    
    // Add animated particles effect
    const particleContainer = new PIXI.Container();
    const particles = [];
    for (let i = 0; i < 80; i++) {
        const particle = new PIXI.Graphics();
        const size = Math.random() * 3 + 1; // Larger particles (1-4px)
        const alpha = Math.random() * 0.5 + 0.3; // More visible (0.3-0.8)
        particle.beginFill(0x00ff66, alpha);
        particle.drawCircle(0, 0, size);
        particle.endFill();
        
        const particleData = {
            sprite: particle,
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            speed: Math.random() * 0.8 + 0.3, // Faster movement (0.3-1.1)
            phase: Math.random() * Math.PI * 2, // Random phase for pulsing
        };
        
        particle.x = particleData.x;
        particle.y = particleData.y;
        particles.push(particleData);
        particleContainer.addChild(particle);
    }
    startScene.addChild(bgGraphics);
    startScene.addChild(particleContainer);
    
    // Animate particles
    app.ticker.add(() => {
        if (particleContainer && startScene.visible && particles.length > 0) {
            const time = Date.now() / 1000;
            particles.forEach((p, i) => {
                // Move particle down
                p.y += p.speed;
                
                // Pulsing alpha effect
                p.sprite.alpha = 0.3 + Math.sin(time * 2 + p.phase) * 0.4;
                
                // Reset position when off screen
                if (p.y > GAME_HEIGHT + 10) {
                    p.y = -10;
                    p.x = Math.random() * GAME_WIDTH;
                }
                
                // Update sprite position
                p.sprite.x = p.x;
                p.sprite.y = p.y;
            });
        }
    });
    
    // Store reference for background (used in animation)
    startBG = bgGraphics;

    // Main container for start screen content
    const startContentContainer = new PIXI.Container();
    startScene.addChild(startContentContainer);

    // Left side: Album artwork area
    const albumArtContainer = new PIXI.Container();
    // Position to ensure full visibility (album art extends 140px left from center)
    albumArtContainer.x = 150;
    albumArtContainer.y = GAME_HEIGHT / 2;
    startContentContainer.addChild(albumArtContainer);

    // Album artwork (load from assets)
    const albumArtSize = 280;
    const albumArtSprite = new PIXI.Sprite(PIXI.Assets.get('assets/soldier-album-art.png'));
    albumArtSprite.anchor.set(0.5);
    albumArtSprite.width = albumArtSize;
    albumArtSprite.height = albumArtSize;
    
    // Add rounded corners mask for album art
    const albumArtMask = new PIXI.Graphics();
    albumArtMask.beginFill(0xffffff);
    albumArtMask.drawRoundedRect(-albumArtSize/2, -albumArtSize/2, albumArtSize, albumArtSize, 15);
    albumArtMask.endFill();
    albumArtSprite.mask = albumArtMask;
    albumArtContainer.addChild(albumArtMask);
    albumArtContainer.addChild(albumArtSprite);
    
    // Yellow border around album art
    const albumArtBorder = new PIXI.Graphics();
    albumArtBorder.lineStyle(3, 0xffff00, 0.9);
    albumArtBorder.drawRoundedRect(-albumArtSize/2, -albumArtSize/2, albumArtSize, albumArtSize, 15);
    albumArtContainer.addChild(albumArtBorder);

    // Album title below artwork
    const albumTitle = new PIXI.Text("SOLDIER", {
        fill: "#ffff00",
        fontSize: 32,
        fontWeight: "900",
        fontFamily: "Orbitron",
        letterSpacing: 4
    });
    albumTitle.anchor.set(0.5);
    albumTitle.y = albumArtSize / 2 + 40;
    albumArtContainer.addChild(albumTitle);

    // Right side: Game content (positioned to avoid overlap with album art)
    const gameContentContainer = new PIXI.Container();
    gameContentContainer.x = 620; // Moved right to clear album art (which ends around 290px)
    gameContentContainer.y = GAME_HEIGHT / 2;
    startContentContainer.addChild(gameContentContainer);

    // Background panel for game content
    const contentPanel = new PIXI.Graphics();
    contentPanel.beginFill(0x000000, 0.75);
    contentPanel.drawRoundedRect(-320, -220, 640, 440, 20);
    contentPanel.endFill();
    contentPanel.lineStyle(3, 0x00ff66, 1);
    contentPanel.drawRoundedRect(-320, -220, 640, 440, 20);
    gameContentContainer.addChild(contentPanel);

    // Title
    const titleText = new PIXI.Text("HOLD THE LINE", {
        fill: "#ffff00", // Yellow to match album art
        fontSize: 44,
        fontWeight: "900",
        fontFamily: "Orbitron",
        stroke: "#000000",
        strokeThickness: 4,
        letterSpacing: 6
    });
    titleText.anchor.set(0.5);
    titleText.y = -160;
    gameContentContainer.addChild(titleText);

    // Subtitle
    const subtitleText = new PIXI.Text("Official Game", {
        fill: "#00ff66",
        fontSize: 16,
        fontFamily: "Orbitron",
        letterSpacing: 3
    });
    subtitleText.anchor.set(0.5);
    subtitleText.y = -115;
    gameContentContainer.addChild(subtitleText);

    // Mission Instructions
    const missionText = new PIXI.Text(
        'Mission: Hold the line against the enemies\nand collect all the letters of "SOLDIER" under 60 seconds.',
        {
            fill: '#ffffff',
            fontSize: 20,
            fontFamily: 'Orbitron',
            align: 'center',
            wordWrap: true,
            wordWrapWidth: 580,
            lineHeight: 28,
        }
    );
    missionText.anchor.set(0.5);
    missionText.y = -30;
    gameContentContainer.addChild(missionText);

    // Play Button Container
    const playButtonContainer = new PIXI.Container();
    playButtonContainer.y = 80;
    gameContentContainer.addChild(playButtonContainer);

    // Play Button Background
    const playBtnBg = new PIXI.Graphics();
    playBtnBg.beginFill(0x00ff66, 0.2);
    playBtnBg.drawRoundedRect(-100, -25, 200, 50, 12);
    playBtnBg.endFill();
    playBtnBg.lineStyle(2, 0x00ff66, 1);
    playBtnBg.drawRoundedRect(-100, -25, 200, 50, 12);
    playButtonContainer.addChild(playBtnBg);

    // Play Button Text
    const playBtn = new PIXI.Text("▶ PLAY", {
        fill: "#00ff66",
        fontSize: 32,
        fontWeight: "700",
        fontFamily: "Orbitron",
        letterSpacing: 3
    });
    playBtn.anchor.set(0.5);
    playButtonContainer.addChild(playBtn);

    // Make entire button container interactive
    playButtonContainer.interactive = true;
    playButtonContainer.buttonMode = true;
    playButtonContainer.cursor = "pointer";
    
    // Hover effects
    playButtonContainer.on("pointerover", () => {
        playBtnBg.clear();
        playBtnBg.beginFill(0x00ff66, 0.3);
        playBtnBg.drawRoundedRect(-100, -25, 200, 50, 12);
        playBtnBg.endFill();
        playBtnBg.lineStyle(3, 0x00ff66, 1);
        playBtnBg.drawRoundedRect(-100, -25, 200, 50, 12);
        playBtn.style.fill = "#ffff66";
        playBtn.style.fontSize = 34;
    });
    
    playButtonContainer.on("pointerout", () => {
        playBtnBg.clear();
        playBtnBg.beginFill(0x00ff66, 0.2);
        playBtnBg.drawRoundedRect(-100, -25, 200, 50, 12);
        playBtnBg.endFill();
        playBtnBg.lineStyle(2, 0x00ff66, 1);
        playBtnBg.drawRoundedRect(-100, -25, 200, 50, 12);
        playBtn.style.fill = "#00ff66";
        playBtn.style.fontSize = 32;
    });
    
    playButtonContainer.on("pointerdown", () => {
        resetGame();
    });

    // Music enable button (show if music not enabled) - positioned above album art
    function createMusicButton() {
        if (musicButtonContainer) return; // Already created
        
        musicButtonContainer = new PIXI.Container();
        // Position above album art (which is centered at x=150, y=GAME_HEIGHT/2, size 280)
        const artSize = 280; // Album art size
        musicButtonContainer.x = albumArtContainer.x; // Align with album art
        musicButtonContainer.y = albumArtContainer.y - artSize / 2 - 60; // Above album art
        startContentContainer.addChild(musicButtonContainer);
        
        // Animated pointing finger (medium skin tone)
        const pointingFinger = new PIXI.Text("👇🏽", {
            fontSize: 32,
        });
        pointingFinger.anchor.set(0.5);
        pointingFinger.y = -35;
        musicButtonContainer.addChild(pointingFinger);
        
        // Animate the pointing finger (bounce/pulse effect)
        let fingerOffset = 0;
        app.ticker.add(() => {
            if (pointingFinger && musicButtonContainer && musicButtonContainer.visible) {
                fingerOffset += 0.1;
                pointingFinger.y = -35 + Math.sin(fingerOffset) * 5; // Bounce animation
            }
        });

        const musicBtnBg = new PIXI.Graphics();
        musicBtnBg.beginFill(0x000000, 0.6);
        musicBtnBg.drawRoundedRect(-90, -20, 180, 40, 10);
        musicBtnBg.endFill();
        musicBtnBg.lineStyle(2, 0xffff00, 0.8);
        musicBtnBg.drawRoundedRect(-90, -20, 180, 40, 10);
        musicButtonContainer.addChild(musicBtnBg);

        const musicButtonText = new PIXI.Text("🔊 Enable Music", {
            fill: "#ffff00",
            fontSize: 18,
            fontWeight: "600",
            fontFamily: "Orbitron",
            letterSpacing: 1
        });
        musicButtonText.anchor.set(0.5);
        musicButtonContainer.addChild(musicButtonText);

        musicButtonContainer.interactive = true;
        musicButtonContainer.buttonMode = true;
        musicButtonContainer.cursor = "pointer";
        
        musicButtonContainer.on("pointerover", () => {
            musicBtnBg.clear();
            musicBtnBg.beginFill(0x1a1a1a, 0.7);
            musicBtnBg.drawRoundedRect(-90, -20, 180, 40, 10);
            musicBtnBg.endFill();
            musicBtnBg.lineStyle(3, 0xffff00, 1);
            musicBtnBg.drawRoundedRect(-90, -20, 180, 40, 10);
            musicButtonText.style.fill = "#ffff99";
        });
        
        musicButtonContainer.on("pointerout", () => {
            musicBtnBg.clear();
            musicBtnBg.beginFill(0x000000, 0.6);
            musicBtnBg.drawRoundedRect(-90, -20, 180, 40, 10);
            musicBtnBg.endFill();
            musicBtnBg.lineStyle(2, 0xffff00, 0.8);
            musicBtnBg.drawRoundedRect(-90, -20, 180, 40, 10);
            musicButtonText.style.fill = "#ffff00";
        });
        
        musicButtonContainer.on("pointerdown", () => {
            if (!musicEnabled) {
                backgroundMusic.play();
                musicEnabled = true;
                musicButtonText.text = "🔊 Music Enabled";
                setTimeout(() => {
                    if (musicButtonContainer && musicButtonContainer.parent) {
                        musicButtonContainer.visible = false;
                    }
                }, 1500);
            }
        });
    }
    
    // Create music button after albumArtContainer is defined
    createMusicButton();

    // Album link/promotion on start screen (centered relative to game content container)
    const albumLinkContainer = new PIXI.Container();
    albumLinkContainer.x = gameContentContainer.x; // Center relative to game content container
    albumLinkContainer.y = GAME_HEIGHT - 80;
    startContentContainer.addChild(albumLinkContainer);

    // Album link background (wider to fit text)
    const albumLinkBg = new PIXI.Graphics();
    const buttonWidth = 420;
    const buttonHeight = 40;
    const buttonRadius = 10;
    albumLinkBg.beginFill(0x000000, 0.7);
    albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
    albumLinkBg.endFill();
    albumLinkBg.lineStyle(2, 0xffff00, 0.9);
    albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
    albumLinkContainer.addChild(albumLinkBg);

    const albumLinkText = new PIXI.Text("🎵 Get the SOLDIER Album", {
        fill: "#ffff00",
        fontSize: 22,
        fontWeight: "700",
        fontFamily: "Orbitron",
        letterSpacing: 2
    });
    albumLinkText.anchor.set(0.5);
    albumLinkContainer.addChild(albumLinkText);

    albumLinkContainer.interactive = true;
    albumLinkContainer.buttonMode = true;
    albumLinkContainer.cursor = "pointer";
    albumLinkContainer.on("pointerover", () => {
        albumLinkBg.clear();
        albumLinkBg.beginFill(0x1a1a1a, 0.8);
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkBg.endFill();
        albumLinkBg.lineStyle(3, 0xffff00, 1);
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkText.style.fill = "#ffff99";
    });
    albumLinkContainer.on("pointerout", () => {
        albumLinkBg.clear();
        albumLinkBg.beginFill(0x000000, 0.7);
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkBg.endFill();
        albumLinkBg.lineStyle(2, 0xffff00, 0.9);
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkText.style.fill = "#ffff00";
    });
    albumLinkContainer.on("pointerdown", () => {
        window.open("https://github.com/ArinzeGit", "_blank");
    });

    // Add subtle glow animation to title (yellow theme to match album)
    app.ticker.add(() => {
        if (titleText && startScene.visible) {
            const glowPhase = Date.now() / 1000;
            const glowIntensity = 0.5 + Math.sin(glowPhase) * 0.5;
            // Alternate between darker and brighter yellow
            if (glowIntensity > 0.5) {
                titleText.style.fill = "#ffff00";
            } else {
                titleText.style.fill = "#cccc00";
            }
        }
    });

    // UI Container
    // Letter display container
    const wordDisplay = new PIXI.Container();
    wordDisplay.x = 10;
    wordDisplay.y = 10;
    uiContainer.addChild(wordDisplay);

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
        fontFamily: "Orbitron",
        stroke: "#000000",
        strokeThickness: 4
    });
    timerText.x = GAME_WIDTH - 200;
    timerText.y = 10;
    uiContainer.addChild(timerText);

    // Controls
    const keys = {};
    window.addEventListener("keydown", e => keys[e.code] = true);
    window.addEventListener("keyup", e => keys[e.code] = false);

    //  FULLSCREEN TOUCH CONTROLS (DOM OVERLAY + PIXI)

    // Tracking movement finger
    let movementTouchId = null;
    let lastTouchX = null;

    function enableOverlay() {
        overlay.style.pointerEvents = "auto";
    }

    function disableOverlay() {
        overlay.style.pointerEvents = "none";
    }

    // Add event listeners
    overlay.addEventListener("pointerdown", onDomTouchStart);
    overlay.addEventListener("pointermove", onDomTouchMove);
    overlay.addEventListener("pointerup", onDomTouchEnd);
    overlay.addEventListener("pointercancel", onDomTouchEnd);
    overlay.addEventListener("pointerupoutside", onDomTouchEnd);

    // Convert screen global coords to PIXI local/stage coords
    function screenToLocalX(screenX, screenY) {
        const pos = { x: 0, y: 0 };

        // Convert screen global coords → PIXI global coords
        app.renderer.events.mapPositionToPoint(pos, screenX, screenY);

        // Convert PIXI global coords → PIXI local/stage coords
        const local = app.stage.toLocal(pos);
        return local.x;
    }

    // Decide zones
    function getHalfWidth() {
        return GAME_WIDTH / 2;
    }

    // TOUCH START
    function onDomTouchStart(e) {
        const id = e.pointerId;

        // Convert to PIXI stage coordinates
        const localX = screenToLocalX(e.clientX, e.clientY);
        const half = getHalfWidth();

        if (localX < half && movementTouchId === null) {
            // LEFT SIDE → movement
            movementTouchId = id;
            lastTouchX = localX;
        } else {
            // RIGHT SIDE → shoot
            shootProjectile();
        }
    }

    // TOUCH MOVE
    function onDomTouchMove(e) {
        const id = e.pointerId;
        if (id !== movementTouchId) return;

        const x = screenToLocalX(e.clientX, e.clientY);
        const dx = x - lastTouchX;

        if (Math.abs(dx) < MOVE_THRESHOLD) return;

        if (dx > 0) {
            keys["ArrowRight"] = true;
            keys["ArrowLeft"] = false;
        } else {
            keys["ArrowLeft"] = true;
            keys["ArrowRight"] = false;
        }

        lastTouchX = x;
    }

    // TOUCH END
    function onDomTouchEnd(e) {
        const id = e.pointerId;

        if (id === movementTouchId) {
            keys["ArrowLeft"] = false;
            keys["ArrowRight"] = false;
            movementTouchId = null;
            lastTouchX = null;
        }
    }

    // Game Scene
    // Player sprite - use preloaded texture
    const playerTexture = PIXI.Assets.get('assets/soldier-sprite-gamePlay.png');
    const player = new PIXI.Sprite(playerTexture);

    // Set anchor to center bottom so movement feels natural
    player.anchor.set(0.5, 1);

    // Scale the sprite
    player.scale.set(0.1);

    // Position at bottom center
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT;

    playerEnemyContainer.addChild(player);

    //Functions for spawning entities
    // Spawn enemy
    function spawnEnemy() {
        // Create a container so enemy shape + text stick together
        const enemyContainer = new PIXI.Container();

        // Random emotion
        const emotion = NEGATIVE_EMOTIONS[Math.floor(Math.random() * NEGATIVE_EMOTIONS.length)];
        const color = EMOTION_COLORS[emotion];
        enemyContainer.color = color;       // save color so bullets use same theme

        // Enemy sprite - use preloaded textures
        let enemyTexture;
        if (emotion == "Fear"){
            enemyTexture = PIXI.Assets.get('assets/enemy-sprites/fear-sprite.png');
        }else if (emotion == "Anxiety"){
            enemyTexture = PIXI.Assets.get('assets/enemy-sprites/anxiety-sprite.png');
        }else if (emotion == "Anger"){
            enemyTexture = PIXI.Assets.get('assets/enemy-sprites/anger-sprite.png');
        }else if (emotion == "Despair"){
            enemyTexture = PIXI.Assets.get('assets/enemy-sprites/despair-sprite.png');
        }else if (emotion == "Guilt"){
            enemyTexture = PIXI.Assets.get('assets/enemy-sprites/guilt-sprite.png');
        }
        const enemySprite = new PIXI.Sprite(enemyTexture);

        enemySprite.anchor.set(0.5, 0.5);

        // Scale the sprite
        enemySprite.scale.set(0.08);

        enemyContainer.addChild(enemySprite);
        
        // Position enemyContainer
        enemyContainer.x = Math.random() * (GAME_WIDTH - 50) + 25;
        enemyContainer.y = 50;
        playerEnemyContainer.addChild(enemyContainer);
        enemies.push(enemyContainer);

        // Small pulse animation
        // Define the pulsating function
        const pulse = () => {
            if (!enemyContainer.parent) return; // guard if already removed
            enemyContainer.scale.x = 1 + 0.1 * Math.sin(app.ticker.lastTime / 200);
            enemyContainer.scale.y = 1 + 0.1 * Math.sin(app.ticker.lastTime / 200);
        };
    
        // Attach it
        app.ticker.add(pulse);

        // When enemy is killed:
        enemyContainer.on('removed', () => {
            app.ticker.remove(pulse); // cleanup
        });

        // Shoot bullets every 1.5s
        enemyContainer.shootInterval = setInterval(() => {
            if (!enemyContainer.destroyed && !gameOver) {
                spawnEnemyBullet(enemyContainer);
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
        bulletCollectibleContainer.addChild(bullet);
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
    bulletCollectibleContainer.addChild(col);
    collectibles.push(col);
    }

    // Shoot projectile
    function shootProjectile() {
        const proj = new PIXI.Graphics();
        proj.beginFill(0xffff00);
        proj.drawRect(-3, -10, 6, 20);
        proj.endFill();
        proj.x = player.x;
        proj.y = player.y - 97;
        bulletCollectibleContainer.addChild(proj);
        projectiles.push(proj);
        shootSound.play();
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
        if (!startTime) return;

        // Update timer
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        timerText.text = `Time left: ${60 - elapsedTime}s`;
        if (elapsedTime >= 50 && !isCountdownPlaying) {
            countdownSound.play();
            isCountdownPlaying = true;
        }
        if (elapsedTime >= 60) {
            timerText.text = `Time up!`;
            isCountdownPlaying = false;
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
                bulletCollectibleContainer.removeChild(p);
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
                    playerEnemyContainer.removeChild(en);
                    en.destroy();
                    clearInterval(en.shootInterval); // stop shooting
                    enemies.splice(i, 1);
                    enemyDeathSound.play();
                    bulletCollectibleContainer.removeChild(pr);
                    pr.destroy();
                    projectiles.splice(j, 1);
                    break;
                }
            }

            if (!en.destroyed && en.y > GAME_HEIGHT + 20) {
                playerEnemyContainer.removeChild(en);
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
                playerDeathSound.play();
                // endGame(true); // For testing win scenario. Normally would be:
                endGame(false);
            }

            // Off screen
            if (b.y > GAME_HEIGHT + 20) {
                bulletCollectibleContainer.removeChild(b);
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
                    gotCollectibleSound.play();

                    // Update that letter’s color
                    for (let i = 0; i < TARGET_WORD.length; i++) {
                        if (TARGET_WORD[i] === c.letter) {
                            letterTexts[i].style.fill = "#ffff00"; // bright yellow when collected
                        }
                    }
                }

                bulletCollectibleContainer.removeChild(c);
                c.destroy();
                collectibles.splice(i, 1);

                if (collectedLetters.size === TARGET_WORD.length) {
                    endGame(true);
                }
            }

            if (!c.destroyed && c.y > GAME_HEIGHT + 20) {
                bulletCollectibleContainer.removeChild(c);
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
        activeInput.style.width = (screenWidth * 0.73) + "px"; // *0.73 to leave room for score
        activeInput.style.fontSize = `${22 * scale}px`;
        activeInput.style.padding = "0 5px";
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
        isCountdownPlaying? (countdownSound.stop(),isCountdownPlaying = false) : null;
        win ? (setTimeout(() => {
            congratulationsSound.play();
        }, 1000),winSound.play()) : (setTimeout(() => {
            missionFailedSound.play();
        }, 1000),loseSound.play());
        stopSpawning();
        gameOver = true;
        bulletCollectibleContainer.visible = false;
        playerEnemyContainer.visible = false;
        gameOverScene.removeChildren();
        gameOverScene.visible = true;
        disableOverlay();
        // Clear any existing timeout before setting a new one
        if (backgroundMusicTimeout) {
            clearTimeout(backgroundMusicTimeout);
            backgroundMusicTimeout = null;
        }
        backgroundMusicTimeout = setTimeout(() => {
            backgroundMusic.play();
            backgroundMusicTimeout = null;
        }, 2500);

        // End game background
        const endBg = new PIXI.Graphics();
        const gradient = app.renderer.generateTexture((() => {
            const g = new PIXI.Graphics();
            g.beginTextureFill({ color: 0x111827, alpha: 0.8 });
            g.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            g.endFill();
            g.beginTextureFill({ color: 0x000000, alpha: 0.5 });
            g.drawRect(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT / 2);
            g.endFill();
            return g;
        })());
        endBg.beginTextureFill({ texture: gradient });
        endBg.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        endBg.endFill();
        gameOverScene.addChild(endBg);

        // Mission Complete / Failed
        const msg = win ? "Mission Complete!" : "Mission Failed";
        const resultText = new PIXI.Text(msg, {
            fill: win ? "#00ff66" : "#ff3333",
            fontSize: 48,
            fontFamily: "Orbitron",
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
        const labelText = new PIXI.Text("Score:", {
            fill: "#ffffff",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });

        // Value (green/red)
        const valueText = new PIXI.Text(`${score}`, {
            fill: "#00ff66",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });

        // Compute total width (with small spacing)
        const spacing = 10;
        const totalWidth = labelText.width + spacing + valueText.width;

        // Center the whole block
        const startX = (GAME_WIDTH - totalWidth) / 2;
        const y = 105;

        labelText.x = startX;
        labelText.y = y;

        valueText.x = startX + labelText.width + spacing;
        valueText.y = y;

        gameOverScene.addChild(labelText, valueText);

        // Leaderboard title
        const lbTitle = new PIXI.Text("Top 5 Soldiers", {
            fill: "#ffff00",
            fontSize: 32,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        lbTitle.anchor.set(0.5);
        lbTitle.x = GAME_WIDTH / 2;
        lbTitle.y = 210;
        gameOverScene.addChild(lbTitle);

        const endgameSpriteTexture = PIXI.Assets.get('assets/soldier-sprite-endgame.png');

        const endgameSpriteLeft = new PIXI.Sprite(endgameSpriteTexture);
        endgameSpriteLeft.anchor.set(1,0.5);
        endgameSpriteLeft.scale.set(0.07);
        endgameSpriteLeft.x = (GAME_WIDTH - lbTitle.width) / 2;
        endgameSpriteLeft.y = 210;
        gameOverScene.addChild(endgameSpriteLeft);

        const endgameSpriteRight = new PIXI.Sprite(endgameSpriteTexture);
        endgameSpriteRight.anchor.set(0,0.5);
        endgameSpriteRight.scale.set(0.07);
        endgameSpriteRight.x = (GAME_WIDTH + lbTitle.width) / 2;
        endgameSpriteRight.y = 210;
        gameOverScene.addChild(endgameSpriteRight);

        // Leaderboard
        const leaderboardContainer = new PIXI.Container();
        gameOverScene.addChild(leaderboardContainer);

        // Check if player qualifies for leaderboard
        const worstEntry = leaderboard[leaderboard.length - 1];
        let qualifies = score > worstEntry.score;
        if (qualifies) {
            leaderboardApplauseSound.play();
            // Insert placeholder with a marker until we collect name
            leaderboard.push({ name: " ???", score, pending: true });
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
                { fill: "#ffffff", fontSize: 24, fontFamily: "Orbitron" }
            );
            nameText.anchor.set(0, 0.5);  // left aligned
            nameText.x = 0;

            // Score (green, right aligned within row)
            const scoreText = new PIXI.Text(
                `${entry.score}`,
                { fill: "#00ff66", fontSize: 24, fontFamily: "Orbitron" }
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
            input.placeholder = "Enter your name";
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
                        { fill: "#ffffff", fontSize: 24, fontFamily: "Orbitron" }
                    );
                    nameText.anchor.set(0, 0.5);  // left aligned
                    nameText.x = 0;
                    nameText.y = 0;

                    // Score (green, right aligned within row)
                    const scoreText = new PIXI.Text(
                        `${entry.score}`,
                        { fill: "#00ff66", fontSize: 24, fontFamily: "Orbitron" }
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
        const link = new PIXI.Text("Listen to 🎵SOLDIER", {
            fill: "#44ccff",
            fontSize: 38,
            fontWeight: "bold",
            fontFamily: "Orbitron"
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

        // Back to Menu button
        const backToMenu = new PIXI.Text("↩ Back to Menu", {
            fill: "#ffffff",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        backToMenu.interactive = true;
        backToMenu.buttonMode = true;
        backToMenu.cursor = "pointer";
        backToMenu.on("pointerover", () => backToMenu.style.fill = "#ffff66");
        backToMenu.on("pointerout", () => backToMenu.style.fill = "#ffffff");
        backToMenu.on("pointerdown", () => {
            cleanUnsavedEntries();
            gameOverScene.visible = false;
            gameScene.visible = false;
            startScene.visible = true;
            // Music button won't reappear once dismissed - music continues from endgame
            fixViewport();
        });

        // Play Again button
        const playAgain = new PIXI.Text("▶ Play Again", {
            fill: "#ffffff",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        playAgain.interactive = true;
        playAgain.buttonMode = true;
        playAgain.cursor = "pointer";
        playAgain.on("pointerover", () => playAgain.style.fill = "#ffff66");
        playAgain.on("pointerout", () => playAgain.style.fill = "#ffffff");
        playAgain.on("pointerdown", resetGame);
        
        // Compute total width (with small spacing)
        const spacing_ = 500;
        const totalWidth_ = backToMenu.width + spacing_ + playAgain.width;

        // Center the whole block
        const startX_ = (GAME_WIDTH - totalWidth_) / 2;
        const y_ = GAME_HEIGHT - 90;

        backToMenu.x = startX_;
        backToMenu.y = y_;

        playAgain.x = startX_ + backToMenu.width + spacing_;
        playAgain.y = y_;

        gameOverScene.addChild(backToMenu, playAgain);
    }

    // Reset game state
    function resetGame() {
        // Hide music button and enable music when user clicks Play
        if (musicButtonContainer) {
            musicButtonContainer.visible = false;
            musicEnabled = true;
        }
        
        // Reset controls in case endgame destroyed buttons abruptly on mobile
        keys["ArrowLeft"] = false;
        keys["ArrowRight"] = false;
        keys["Space"] = false;

        startScene.visible = false;
        gameScene.visible = true;
        bulletCollectibleContainer.visible = true;
        playerEnemyContainer.visible = true;
        uiContainer.visible = true;
        gameOverScene.visible = false;
        enableOverlay();
        // Clear the delayed background music timeout if it exists
        if (backgroundMusicTimeout) {
            clearTimeout(backgroundMusicTimeout);
            backgroundMusicTimeout = null;
        }
        backgroundMusic.stop();

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

        cleanUnsavedEntries();

        startSpawning();
    }

    function cleanUnsavedEntries() {
        // Clear any existing input boxes and save buttons 
        document.querySelectorAll(".lb-input, .lb-save").forEach(el => el.remove());

        activeInput = null;
        saveButton = null;
        leaderboard.forEach(entry => {
            if (entry.pending) delete entry.pending;
        });
    }

    // Start scene animation handled above (particles and title glow)

    // Show start scene (music will play when user enables it)
    startScene.visible = true;
    
    // Show music button only if it hasn't been dismissed yet
    if (musicButtonContainer && musicButtonContainer.parent) {
        musicButtonContainer.visible = !musicEnabled;
    }
    } // End of initializeGame
})();