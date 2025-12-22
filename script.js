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

    // Simple resize function: scales to fill screen while maintaining aspect ratio
    function resize() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const scaleX = viewportWidth / GAME_WIDTH;
        const scaleY = viewportHeight / GAME_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        const newWidth = Math.floor(GAME_WIDTH * scale);
        const newHeight = Math.floor(GAME_HEIGHT * scale);

        app.renderer.resize(newWidth, newHeight);

        // Center the canvas
        view.style.left = `${(viewportWidth - newWidth) / 2}px`;
        view.style.top = `${(viewportHeight - newHeight) / 2}px`;

        app.stage.scale.set(scale);
    }

    // Initial resize
    resize();
    
    // Listen for resize and orientation changes
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

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

    // Scenes
    const startScene = new PIXI.Container();
    const gameScene = new PIXI.Container();
    // containers for layering
    const gameSceneBgContainer = new PIXI.Container();
    const bulletCollectibleContainer = new PIXI.Container();
    const playerEnemyContainer = new PIXI.Container();
    const uiContainer = new PIXI.Container();
    gameScene.addChild(gameSceneBgContainer, bulletCollectibleContainer, playerEnemyContainer, uiContainer);
    const gameOverScene = new PIXI.Container();

    app.stage.addChild(startScene, gameOverScene, gameScene);
    startScene.visible = false; // Will be shown after loading
    gameScene.visible = false;
    gameOverScene.visible = false;
    disableOverlay();

    // Start Scene - create dynamic background
    // Dark background with subtle grid pattern (military tech look)
    const bgGraphics = new PIXI.Graphics();
    
    // Dark base background
    bgGraphics.beginFill(0x050505);
    bgGraphics.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bgGraphics.endFill();
    
    // Subtle grid lines (military tech aesthetic)
    bgGraphics.lineStyle(1, 0x00ff66, 0.15); // Subtle green grid
    for (let x = 0; x < GAME_WIDTH; x += 50) {
        bgGraphics.moveTo(x, 0);
        bgGraphics.lineTo(x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 50) {
        bgGraphics.moveTo(0, y);
        bgGraphics.lineTo(GAME_WIDTH, y);
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
    albumArtContainer.x = 165;
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
    gameContentContainer.x = 655; // Moved right to clear album art (which ends around 290px)
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
        
        // Animate the pointing finger and button pulse (bounce/pulse effect)
        let fingerOffset = 0;
        let isMusicButtonHovered = false;
        app.ticker.add(() => {
            if (pointingFinger && musicButtonContainer && musicButtonContainer.visible && !isMusicButtonHovered) {
                fingerOffset += 0.1;
                // Bounce the finger
                pointingFinger.y = -35 + Math.sin(fingerOffset) * 5;
                // Pulse the button scale (same frequency as finger)
                const pulseScale = 1 + Math.sin(fingerOffset) * 0.03; // Very subtle pulse (3%)
                musicButtonContainer.scale.set(pulseScale);
            }
        });

        const musicBtnBg = new PIXI.Graphics();
        let musicBtnWidth = 270;
        let musicBtnHeight = 40;
        
        // Helper function to redraw button background with given width and style
        const redrawButtonBg = (width, height, fill, borderThickness, borderColor, borderAlpha) => {
            musicBtnBg.clear();
            musicBtnBg.beginFill(fill, 1);
            musicBtnBg.drawRoundedRect(-width/2, -height/2, width, height, 10);
            musicBtnBg.endFill();
            musicBtnBg.lineStyle(borderThickness, borderColor, borderAlpha);
            musicBtnBg.drawRoundedRect(-width/2, -height/2, width, height, 10);
        };
        
        redrawButtonBg(musicBtnWidth, musicBtnHeight, 0x000000, 2, 0xffff00, 0.8);
        musicButtonContainer.addChild(musicBtnBg);

        const musicButtonText = new PIXI.Text("🎵 Tap to enable music", {
            fill: "#ffff00",
            fontSize: 18,
            fontWeight: "600",
            fontFamily: "Orbitron",
            letterSpacing: 1
        });
        musicButtonText.anchor.set(0.5);
        musicButtonContainer.addChild(musicButtonText);
        musicButtonContainer.addChild(pointingFinger);

        musicButtonContainer.interactive = true;
        musicButtonContainer.buttonMode = true;
        musicButtonContainer.cursor = "pointer";
        
        musicButtonContainer.on("pointerover", () => {
            isMusicButtonHovered = true;
            redrawButtonBg(musicBtnWidth, musicBtnHeight, 0x1a1a1a, 3, 0xffff00, 1);
            musicButtonText.style.fill = "#ffff99";
            musicButtonContainer.scale.set(1.0); // Reset scale on hover
        });
        
        musicButtonContainer.on("pointerout", () => {
            isMusicButtonHovered = false;
            redrawButtonBg(musicBtnWidth, musicBtnHeight, 0x000000, 2, 0xffff00, 0.8);
            musicButtonText.style.fill = "#ffff00";
            // Scale will be controlled by pulse animation, not reset to 1.0
        });
        
        musicButtonContainer.on("pointerdown", () => {
            if (!musicEnabled) {
                backgroundMusic.play();
                musicEnabled = true;
                musicButtonText.text = "🎵 Music Enabled";
                musicBtnWidth = 205;
                redrawButtonBg(musicBtnWidth, musicBtnHeight, 0x000000, 2, 0xffff00, 0.8);
                
                // Show warning about silent mode after brief delay
                setTimeout(() => {
                    musicButtonText.text = "🔇 If you don't hear music,\nturn off silent mode";
                    musicButtonText.style.align = "center";
                    musicButtonText.style.fill = "#ffaa00"; // Orange warning color
                    
                    // Increase button width to accommodate longer text
                    musicBtnWidth = 310;
                    musicBtnHeight = 60;
                    redrawButtonBg(musicBtnWidth, musicBtnHeight, 0x000000, 2, 0xffff00, 0.8);
                    
                    // Show warning message for a moment, then hide button
                    setTimeout(() => {
                        if (musicButtonContainer && musicButtonContainer.parent) {
                            musicButtonContainer.visible = false;
                        }
                    }, 2000);
                }, 1000); // Show warning after 1 second
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
    albumLinkBg.beginFill(0x000000, 1);
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
        albumLinkBg.beginFill(0x1a1a1a, 1); // Lighter background, but still opaque
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkBg.endFill();
        albumLinkBg.lineStyle(3, 0xffff00, 1); // Thicker border on hover
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkText.style.fill = "#ffff99"; // Brighter text
    });
    albumLinkContainer.on("pointerout", () => {
        albumLinkBg.clear();
        albumLinkBg.beginFill(0x000000, 1); // Back to opaque black
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkBg.endFill();
        albumLinkBg.lineStyle(2, 0xffff00, 0.9); // Normal border
        albumLinkBg.drawRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, buttonRadius);
        albumLinkText.style.fill = "#ffff00"; // Normal text color
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

    // Game Scene Background - Animated grid with subtle movement
    const gameSceneBgGraphics = new PIXI.Graphics();
    
    // Store grid offset for animation
    let gridOffsetX = 0;
    let gridOffsetY = 0;
    const gridSpacing = 50;
    
    // Function to draw the grid
    const drawGameGrid = () => {
        // Clear everything and redraw
        gameSceneBgGraphics.clear();
        
        // Dark base background
        gameSceneBgGraphics.beginFill(0x050505);
        gameSceneBgGraphics.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        gameSceneBgGraphics.endFill();
        
        // Draw grid lines with offset for animation
        gameSceneBgGraphics.lineStyle(1, 0x00ff66, 0.15); // Subtle green grid
        
        // Calculate the starting position accounting for offset
        const startX = Math.floor(-gridOffsetX / gridSpacing) * gridSpacing + (gridOffsetX % gridSpacing);
        const startY = Math.floor(-gridOffsetY / gridSpacing) * gridSpacing + (gridOffsetY % gridSpacing);
        
        // Vertical lines
        for (let x = startX; x < GAME_WIDTH; x += gridSpacing) {
            gameSceneBgGraphics.moveTo(x, 0);
            gameSceneBgGraphics.lineTo(x, GAME_HEIGHT);
        }
        
        // Horizontal lines
        for (let y = startY; y < GAME_HEIGHT; y += gridSpacing) {
            gameSceneBgGraphics.moveTo(0, y);
            gameSceneBgGraphics.lineTo(GAME_WIDTH, y);
        }
    };
    
    // Initial grid draw
    drawGameGrid();
    gameSceneBgContainer.addChild(gameSceneBgGraphics);
    
    // Animate the grid with subtle movement
    app.ticker.add(() => {
        if (gameScene.visible && !gameOver) {
            // Slow, subtle movement (different speeds for parallax effect)
            gridOffsetX += 0.05; // Horizontal movement
            gridOffsetY += 0.03; // Vertical movement (slower for depth)
            
            // Wrap offsets to prevent overflow
            if (gridOffsetX >= gridSpacing) gridOffsetX -= gridSpacing;
            if (gridOffsetY >= gridSpacing) gridOffsetY -= gridSpacing;
            
            // Redraw grid with new offsets
            drawGameGrid();
        }
    });
    // UI Container - Card-based design
    // Letter display card (top left)
    const letterCard = new PIXI.Container();
    letterCard.x = 20;
    letterCard.y = 20;
    
    const letterCardBg = new PIXI.Graphics();
    const letterCardWidth = 240;
    const letterCardHeight = 50;
    letterCardBg.beginFill(0x000000, 0.75);
    letterCardBg.drawRoundedRect(0, 0, letterCardWidth, letterCardHeight, 10);
    letterCardBg.endFill();
    letterCardBg.lineStyle(2, 0xffff00, 1); // Yellow border to match theme
    letterCardBg.drawRoundedRect(0, 0, letterCardWidth, letterCardHeight, 10);
    letterCard.addChild(letterCardBg);
    
    // Letter display container (inside card)
    const wordDisplay = new PIXI.Container();
    wordDisplay.x = 15; // Padding from card edge
    wordDisplay.y = letterCardHeight / 2; // Center vertically
    letterCard.addChild(wordDisplay);

    const letterTexts = [];
    const letterSpacing = 28;
    const totalWordWidth = (TARGET_WORD.length - 1) * letterSpacing + 25; // Approximate width
    const startX = (letterCardWidth - totalWordWidth) / 2; // Center letters in card

    for (let i = 0; i < TARGET_WORD.length; i++) {
        const char = TARGET_WORD[i];
        const letterText = new PIXI.Text(char, {
            fill: "#555", // gray initially
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron", // Match game font
            stroke: "#000000",
            strokeThickness: 3
        });
        letterText.anchor.set(0.5, 0.5); // Center anchor for better alignment
        letterText.x = startX + i * letterSpacing;
        letterText.y = 0;
        wordDisplay.addChild(letterText);
        letterTexts.push(letterText);
    }
    
    uiContainer.addChild(letterCard);

    // Timer display card (top right)
    const timerCard = new PIXI.Container();
    timerCard.x = GAME_WIDTH - 220; // Position from right
    timerCard.y = 20;
    
    const timerCardBg = new PIXI.Graphics();
    const timerCardWidth = 200;
    const timerCardHeight = 50;
    timerCardBg.beginFill(0x000000, 0.75);
    timerCardBg.drawRoundedRect(0, 0, timerCardWidth, timerCardHeight, 10);
    timerCardBg.endFill();
    timerCardBg.lineStyle(2, 0x00ff66, 1); // Green border for timer
    timerCardBg.drawRoundedRect(0, 0, timerCardWidth, timerCardHeight, 10);
    timerCard.addChild(timerCardBg);
    
    // Timer text (inside card)
    const timerText = new PIXI.Text(`Time left: 60s`, {
        fill: "#00ff66", // Green to match border
        fontSize: 22,
        fontFamily: "Orbitron",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3
    });
    timerText.anchor.set(0.5, 0.5);
    timerText.x = timerCardWidth / 2;
    timerText.y = timerCardHeight / 2;
    timerCard.addChild(timerText);
    
    uiContainer.addChild(timerCard);

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

    // Create explosion effect when enemy is hit
    function createExplosionEffect(x, y, color = 0xff3333) {
        const explosionContainer = new PIXI.Container();
        explosionContainer.x = x;
        explosionContainer.y = y;
        playerEnemyContainer.addChild(explosionContainer);

        const particleCount = 12;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const particle = new PIXI.Graphics();
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            const size = 3 + Math.random() * 3;
            
            particle.beginFill(color, 1);
            particle.drawCircle(0, 0, size);
            particle.endFill();
            explosionContainer.addChild(particle);

            particles.push({
                sprite: particle,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02
            });
        }

        // Animate particles
        const animateExplosion = () => {
            let allDead = true;
            
            particles.forEach(p => {
                if (p.life > 0) {
                    allDead = false;
                    p.sprite.x += p.vx;
                    p.sprite.y += p.vy;
                    p.vx *= 0.95; // Friction
                    p.vy *= 0.95;
                    p.life -= p.decay;
                    p.sprite.alpha = p.life;
                    p.sprite.scale.set(p.life);
                }
            });

            if (allDead) {
                explosionContainer.removeChildren().forEach(c => c.destroy());
                playerEnemyContainer.removeChild(explosionContainer);
                explosionContainer.destroy();
                app.ticker.remove(animateExplosion);
            }
        };

        app.ticker.add(animateExplosion);
    }

    // Create collection effect when player collects a collectible
    // Uses radiating circles for a smooth, elegant effect
    function createCollectionEffect(x, y) {
        const collectionContainer = new PIXI.Container();
        collectionContainer.x = x;
        collectionContainer.y = y;
        bulletCollectibleContainer.addChild(collectionContainer);

        const circleCount = 3;
        const circles = [];

        // Create multiple expanding circles
        for (let i = 0; i < circleCount; i++) {
            const circle = new PIXI.Graphics();
            const initialRadius = 5 + i * 3;
            const maxRadius = 30 + i * 10;
            const speed = 2 + i * 0.5;
            const delay = i * 0.1; // Stagger the circles slightly
            
            circle.lineStyle(3, 0xffff00, 1); // Yellow border
            circle.drawCircle(0, 0, initialRadius);
            
            collectionContainer.addChild(circle);

            circles.push({
                graphics: circle,
                radius: initialRadius,
                maxRadius: maxRadius,
                speed: speed,
                delay: delay,
                life: 1.0,
                elapsed: 0
            });
        }

        // Animate circles
        const animateCollection = () => {
            let allDead = true;
            
            circles.forEach(c => {
                c.elapsed += 0.016; // ~60fps timing
                
                if (c.elapsed > c.delay && c.life > 0) {
                    allDead = false;
                    
                    // Expand the circle
                    c.radius += c.speed;
                    
                    // Calculate alpha based on how far it's expanded
                    const progress = (c.radius - 5) / (c.maxRadius - 5);
                    c.life = Math.max(0, 1 - progress);
                    
                    // Clear and redraw circle at new size
                    c.graphics.clear();
                    c.graphics.lineStyle(3, 0xffff00, c.life);
                    c.graphics.drawCircle(0, 0, c.radius);
                    
                    // Remove when fully expanded
                    if (c.radius >= c.maxRadius) {
                        c.life = 0;
                    }
                }
            });

            if (allDead) {
                collectionContainer.removeChildren().forEach(c => c.destroy());
                bulletCollectibleContainer.removeChild(collectionContainer);
                collectionContainer.destroy();
                app.ticker.remove(animateCollection);
            }
        };

        app.ticker.add(animateCollection);
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
                    // Use enemy's position directly (both are in same container)
                    // Enemy sprite is centered (anchor 0.5, 0.5) so en.x, en.y is the center
                    const explosionX = en.x;
                    const explosionY = en.y;
                    
                    // Create explosion effect (use enemy's color if available)
                    const enemyColor = en.color || 0xff3333;
                    createExplosionEffect(explosionX, explosionY, enemyColor);
                    
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
                    // Get collectible position for visual effect
                    const collectibleX = c.x;
                    const collectibleY = c.y;
                    
                    // Create collection effect
                    createCollectionEffect(collectibleX, collectibleY);
                    
                    collectedLetters.add(c.letter);
                    gotCollectibleSound.play();

                    // Update that letter's color and add attention-grabbing animation
                    for (let i = 0; i < TARGET_WORD.length; i++) {
                        if (TARGET_WORD[i] === c.letter) {
                            const letterText = letterTexts[i];
                            letterText.style.fill = "#ffff00"; // bright yellow when collected
                            
                            // Add pulse animation to draw attention
                            const originalScale = letterText.scale.x || 1;
                            let pulsePhase = 0;
                            const pulseAnimation = () => {
                                pulsePhase += 0.2;
                                if (pulsePhase >= Math.PI * 2) {
                                    letterText.scale.set(originalScale);
                                    app.ticker.remove(pulseAnimation);
                                    return;
                                }
                                // Pulse from 1x to 1.4x and back
                                const scale = originalScale + Math.sin(pulsePhase) * 0.4;
                                letterText.scale.set(scale);
                            };
                            app.ticker.add(pulseAnimation);
                            
                            // Add glow effect (yellow stroke instead of black)
                            letterText.style.stroke = "#ffff00";
                            letterText.style.strokeThickness = 4; // Slightly thicker for more glow
                            
                            // Reduce glow after animation (keep yellow stroke but thinner)
                            setTimeout(() => {
                                letterText.style.strokeThickness = 2; // Keep subtle glow
                            }, 600);
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

    // High score input modal (cleaner approach)
    let inputModalContainer = null;
    let inputModalInput = null;
    let inputModalButton = null;
    let pendingLeaderboardIndex = null;

    // Modular leaderboard renderer
    function renderLeaderboard(container, leaderboardData, startY, rowWidth) {
        container.removeChildren().forEach(c => c.destroy());
        
        leaderboardData.forEach((entry, i) => {
            const yPos = startY + i * 32; // Slightly more spacing
            
            const row = new PIXI.Container();
            row.y = yPos;
            
            // Rank + name (white, left aligned)
            const nameText = new PIXI.Text(
                `${i + 1}. ${entry.name || " ???"}`,
                { fill: entry.pending ? "#ffff00" : "#ffffff", fontSize: 22, fontFamily: "Orbitron" }
            );
            nameText.anchor.set(0, 0.5);
            nameText.x = 0;
            
            // Score (green, right aligned)
            const scoreText = new PIXI.Text(
                `${entry.score}`,
                { fill: "#00ff66", fontSize: 22, fontFamily: "Orbitron" }
            );
            scoreText.anchor.set(1, 0.5);
            scoreText.x = rowWidth;
            
            row.addChild(nameText, scoreText);
            row.x = -rowWidth / 2; // Center within the card container
            
            container.addChild(row);
        });
    }

    // Create/show input modal for high score entry
    function showHighScoreInputModal(leaderboardIndex, callback) {
        // Remove any existing modal
        if (inputModalContainer) {
            gameOverScene.removeChild(inputModalContainer);
            if (inputModalInput && inputModalInput.parentNode) {
                document.body.removeChild(inputModalInput);
            }
            if (inputModalButton && inputModalButton.parentNode) {
                document.body.removeChild(inputModalButton);
            }
        }

        // Create modal container
        inputModalContainer = new PIXI.Container();
        inputModalContainer.x = GAME_WIDTH / 2;
        inputModalContainer.y = GAME_HEIGHT / 2;
        gameOverScene.addChild(inputModalContainer);

        // Modal background (dark card with border)
        const modalBg = new PIXI.Graphics();
        modalBg.beginFill(0x000000, 0.9);
        modalBg.drawRoundedRect(-200, -100, 400, 200, 15);
        modalBg.endFill();
        modalBg.lineStyle(3, 0xffff00, 1);
        modalBg.drawRoundedRect(-200, -100, 400, 200, 15);
        inputModalContainer.addChild(modalBg);

        // Title
        const title = new PIXI.Text("🎉 New High Score!", {
            fill: "#ffff00",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        title.anchor.set(0.5);
        title.y = -60;
        inputModalContainer.addChild(title);

        // Prompt text
        const prompt = new PIXI.Text("Enter your name:", {
            fill: "#ffffff",
            fontSize: 20,
            fontFamily: "Orbitron"
        });
        prompt.anchor.set(0.5);
        prompt.y = -20;
        inputModalContainer.addChild(prompt);

        // HTML input (positioned absolutely over canvas)
        inputModalInput = document.createElement("input");
        inputModalInput.type = "text";
        inputModalInput.maxLength = 10;
        inputModalInput.placeholder = "Your name";
        inputModalInput.style.position = "absolute";
        inputModalInput.style.fontFamily = "Orbitron";
        inputModalInput.style.fontSize = "20px";
        inputModalInput.style.fontWeight = "bold";
        inputModalInput.style.textAlign = "center";
        inputModalInput.style.width = "300px";
        inputModalInput.style.height = "35px";
        inputModalInput.style.background = "#111";
        inputModalInput.style.color = "#fff";
        inputModalInput.style.border = "2px solid #ffff00";
        inputModalInput.style.borderRadius = "8px";
        inputModalInput.style.padding = "0 10px";
        inputModalInput.style.outline = "none";

        // Save button
        inputModalButton = document.createElement("button");
        inputModalButton.textContent = "SAVE";
        inputModalButton.style.position = "absolute";
        inputModalButton.style.fontFamily = "Orbitron";
        inputModalButton.style.fontSize = "18px";
        inputModalButton.style.fontWeight = "bold";
        inputModalButton.style.width = "150px";
        inputModalButton.style.height = "40px";
        inputModalButton.style.background = "#00ff66";
        inputModalButton.style.color = "#000";
        inputModalButton.style.border = "none";
        inputModalButton.style.borderRadius = "8px";
        inputModalButton.style.cursor = "pointer";
        inputModalButton.style.transition = "background 0.2s";

        // Position input and button (centered on screen)
        function positionModalElements() {
            const canvasRect = app.view.getBoundingClientRect();
            const scale = app.stage.scale.x;
            const centerX = canvasRect.left + canvasRect.width / 2;
            const centerY = canvasRect.top + canvasRect.height / 2;
            
            inputModalInput.style.left = `${centerX - 150}px`;
            inputModalInput.style.top = `${centerY - 5}px`;
            inputModalInput.style.transform = `scale(${scale}) translate(-50%, -50%)`;
            inputModalInput.style.transformOrigin = "center";
            
            inputModalButton.style.left = `${centerX - 75}px`;
            inputModalButton.style.top = `${centerY + 45}px`;
            inputModalButton.style.transform = `scale(${scale}) translate(-50%, -50%)`;
            inputModalButton.style.transformOrigin = "center";
        }

        positionModalElements();
        document.body.appendChild(inputModalInput);
        document.body.appendChild(inputModalButton);
        inputModalInput.focus();

        // Save handler
        function saveName() {
            if (!inputModalInput.value.trim()) return;
            const playerName = inputModalInput.value.trim();
            
            // Clean up resize handler
            if (inputModalInput._resizeHandler) {
                window.removeEventListener("resize", inputModalInput._resizeHandler);
            }
            
            // Clean up
            gameOverScene.removeChild(inputModalContainer);
            document.body.removeChild(inputModalInput);
            document.body.removeChild(inputModalButton);
            inputModalContainer = null;
            inputModalInput = null;
            inputModalButton = null;
            
            callback(playerName);
        }

        inputModalInput.addEventListener("keydown", e => {
            if (e.key === "Enter") saveName();
        });
        inputModalButton.addEventListener("click", saveName);
        inputModalButton.addEventListener("mouseenter", () => {
            inputModalButton.style.background = "#ffff66";
        });
        inputModalButton.addEventListener("mouseleave", () => {
            inputModalButton.style.background = "#00ff66";
        });

        // Update position on resize
        const resizeHandler = () => positionModalElements();
        window.addEventListener("resize", resizeHandler);
        // Store handler for cleanup if needed (we'll clean up on save)
        inputModalInput._resizeHandler = resizeHandler;
    }

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
        gameSceneBgContainer.visible = false;
        bulletCollectibleContainer.visible = false;
        playerEnemyContainer.visible = false;
        gameOverScene.removeChildren();
        gameOverScene.visible = true;
        disableOverlay();
        
        // Clean up any existing input modal
        if (inputModalContainer) {
            gameOverScene.removeChild(inputModalContainer);
            if (inputModalInput && inputModalInput.parentNode) {
                document.body.removeChild(inputModalInput);
            }
            if (inputModalButton && inputModalButton.parentNode) {
                document.body.removeChild(inputModalButton);
            }
            inputModalContainer = null;
            inputModalInput = null;
            inputModalButton = null;
        }
        
        // Clear any existing timeout before setting a new one
        if (backgroundMusicTimeout) {
            clearTimeout(backgroundMusicTimeout);
            backgroundMusicTimeout = null;
        }
        backgroundMusicTimeout = setTimeout(() => {
            backgroundMusic.play();
            backgroundMusicTimeout = null;
        }, 2500);

        // Background - match start scene style (grid pattern)
        const bgGraphics = new PIXI.Graphics();
        
        // Dark base background
        bgGraphics.beginFill(0x050505);
        bgGraphics.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        bgGraphics.endFill();
        
        // Subtle grid lines (military tech aesthetic)
        bgGraphics.lineStyle(1, 0x00ff66, 0.15); // Subtle green grid
        for (let x = 0; x < GAME_WIDTH; x += 50) {
            bgGraphics.moveTo(x, 0);
            bgGraphics.lineTo(x, GAME_HEIGHT);
        }
        for (let y = 0; y < GAME_HEIGHT; y += 50) {
            bgGraphics.moveTo(0, y);
            bgGraphics.lineTo(GAME_WIDTH, y);
        }
        gameOverScene.addChild(bgGraphics);

        // Add animated particles (like start scene)
        const particleContainer = new PIXI.Container();
        const particles = [];
        for (let i = 0; i < 60; i++) {
            const particle = new PIXI.Graphics();
            const size = Math.random() * 3 + 1;
            const alpha = Math.random() * 0.5 + 0.3;
            particle.beginFill(0x00ff66, alpha);
            particle.drawCircle(0, 0, size);
            particle.endFill();
            
            const particleData = {
                sprite: particle,
                x: Math.random() * GAME_WIDTH,
                y: Math.random() * GAME_HEIGHT,
                speed: Math.random() * 0.8 + 0.3,
                phase: Math.random() * Math.PI * 2,
            };
            
            particle.x = particleData.x;
            particle.y = particleData.y;
            particles.push(particleData);
            particleContainer.addChild(particle);
        }
        gameOverScene.addChild(particleContainer);
        
        // Animate particles
        app.ticker.add(() => {
            if (particleContainer && gameOverScene.visible && particles.length > 0) {
                const time = Date.now() / 1000;
                particles.forEach((p) => {
                    p.y += p.speed;
                    p.sprite.alpha = 0.3 + Math.sin(time * 2 + p.phase) * 0.4;
                    if (p.y > GAME_HEIGHT + 10) {
                        p.y = -10;
                        p.x = Math.random() * GAME_WIDTH;
                    }
                    p.sprite.x = p.x;
                    p.sprite.y = p.y;
                });
            }
        });

        // Calculate score
        let score = 0;
        if (win) { score = 60 - elapsedTime; }

        // Main content container (centered)
        const mainContentContainer = new PIXI.Container();
        mainContentContainer.x = GAME_WIDTH / 2;
        mainContentContainer.y = 150;
        gameOverScene.addChild(mainContentContainer);

        // Result Card (Mission Complete/Failed + Score)
        const resultCard = new PIXI.Container();
        resultCard.y = 0;
        
        const resultCardBg = new PIXI.Graphics();
        resultCardBg.beginFill(0x000000, 0.75);
        resultCardBg.drawRoundedRect(-280, -60, 560, 120, 15);
        resultCardBg.endFill();
        resultCardBg.lineStyle(3, win ? 0x00ff66 : 0xff3333, 1);
        resultCardBg.drawRoundedRect(-280, -60, 560, 120, 15);
        resultCard.addChild(resultCardBg);

        const msg = win ? "Mission Complete!" : "Mission Failed";
        const resultText = new PIXI.Text(msg, {
            fill: win ? "#00ff66" : "#ff3333",
            fontSize: 36,
            fontFamily: "Orbitron",
            fontWeight: "bold"
        });
        resultText.anchor.set(0.5);
        resultText.y = -25;
        resultCard.addChild(resultText);

        const scoreLabel = new PIXI.Text("Score:", {
            fill: "#ffffff",
            fontSize: 24,
            fontFamily: "Orbitron"
        });
        scoreLabel.anchor.set(0.5);
        scoreLabel.x = -40;
        scoreLabel.y = 15;
        resultCard.addChild(scoreLabel);

        const scoreValue = new PIXI.Text(`${score}`, {
            fill: "#00ff66",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        scoreValue.anchor.set(0.5);
        scoreValue.x = 50;
        scoreValue.y = 15;
        resultCard.addChild(scoreValue);
        mainContentContainer.addChild(resultCard);

        // Leaderboard Card - sized to fit only the list
        const leaderboardCard = new PIXI.Container();
        leaderboardCard.y = 195;
        
        // Card dimensions: title at top, list below, with padding
        const cardWidth = 560;
        const cardHeight = 220; // Enough for title + 5 entries with padding
        
        const leaderboardCardBg = new PIXI.Graphics();
        leaderboardCardBg.beginFill(0x000000, 0.75);
        leaderboardCardBg.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 15);
        leaderboardCardBg.endFill();
        leaderboardCardBg.lineStyle(3, 0xffff00, 1);
        leaderboardCardBg.drawRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 15);
        leaderboardCard.addChild(leaderboardCardBg);

        // Leaderboard title
        const lbTitle = new PIXI.Text("Top 5 Soldiers", {
            fill: "#ffff00",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Orbitron",
            letterSpacing: 3
        });
        lbTitle.anchor.set(0.5);
        lbTitle.y = -cardHeight/2 + 30;
        leaderboardCard.addChild(lbTitle);

        // Leaderboard container
        const leaderboardContainer = new PIXI.Container();
        leaderboardContainer.y = -cardHeight/2 + 70; // Below title
        leaderboardCard.addChild(leaderboardContainer);

        // Check if player qualifies
        const worstEntry = leaderboard[leaderboard.length - 1];
        let qualifies = score > worstEntry.score;
        if (qualifies) {
            leaderboardApplauseSound.play();
            leaderboard.push({ name: null, score, pending: true });
            leaderboard.sort((a, b) => b.score - a.score);
            leaderboard = leaderboard.slice(0, 5);
        }

        // Render leaderboard (rowWidth should fit within card which is 560px wide, leaving padding)
        const rowWidth = 520;
        const leaderboardYStart = 0;
        renderLeaderboard(leaderboardContainer, leaderboard, leaderboardYStart, rowWidth);

        // Show input modal if qualified
        if (qualifies) {
            const pendingIndex = leaderboard.findIndex(e => e.pending);
            pendingLeaderboardIndex = pendingIndex;
            
            setTimeout(() => {
                showHighScoreInputModal(pendingIndex, (playerName) => {
                    leaderboard[pendingIndex].name = playerName;
                    delete leaderboard[pendingIndex].pending;
                    pendingLeaderboardIndex = null;
                    renderLeaderboard(leaderboardContainer, leaderboard, leaderboardYStart, rowWidth);
                });
            }, 500);
        }

        mainContentContainer.addChild(leaderboardCard);

        // Back to Menu button (will be positioned on left side of leaderboard card)
        const backToMenuContainer = new PIXI.Container();
        backToMenuContainer.y = leaderboardCard.y; // Same y level as leaderboard
        backToMenuContainer.x = -390; // Left side
        
        const backBtnBg = new PIXI.Graphics();
        const backBtnWidth = 200;
        const backBtnHeight = 40;
        backBtnBg.beginFill(0x000000, 0.75);
        backBtnBg.drawRoundedRect(-backBtnWidth/2, -backBtnHeight/2, backBtnWidth, backBtnHeight, 10);
        backBtnBg.endFill();
        backBtnBg.lineStyle(2, 0xffffff, 1);
        backBtnBg.drawRoundedRect(-backBtnWidth/2, -backBtnHeight/2, backBtnWidth, backBtnHeight, 10);
        backToMenuContainer.addChild(backBtnBg);

        const backToMenu = new PIXI.Text("↩ Back to Menu", {
            fill: "#ffffff",
            fontSize: 20,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        backToMenu.anchor.set(0.5);
        backToMenuContainer.addChild(backToMenu);

        backToMenuContainer.interactive = true;
        backToMenuContainer.buttonMode = true;
        backToMenuContainer.cursor = "pointer";
        backToMenuContainer.on("pointerover", () => {
            backBtnBg.clear();
            backBtnBg.beginFill(0x333333, 0.85);
            backBtnBg.drawRoundedRect(-backBtnWidth/2, -backBtnHeight/2, backBtnWidth, backBtnHeight, 10);
            backBtnBg.endFill();
            backBtnBg.lineStyle(3, 0xffff66, 1);
            backBtnBg.drawRoundedRect(-backBtnWidth/2, -backBtnHeight/2, backBtnWidth, backBtnHeight, 10);
            backToMenu.style.fill = "#ffff66";
        });
        backToMenuContainer.on("pointerout", () => {
            backBtnBg.clear();
            backBtnBg.beginFill(0x000000, 0.75);
            backBtnBg.drawRoundedRect(-backBtnWidth/2, -backBtnHeight/2, backBtnWidth, backBtnHeight, 10);
            backBtnBg.endFill();
            backBtnBg.lineStyle(2, 0xffffff, 1);
            backBtnBg.drawRoundedRect(-backBtnWidth/2, -backBtnHeight/2, backBtnWidth, backBtnHeight, 10);
            backToMenu.style.fill = "#ffffff";
        });
        backToMenuContainer.on("pointerdown", () => {
            cleanUnsavedEntries();
            gameOverScene.visible = false;
            gameScene.visible = false;
            startScene.visible = true;
        });

        mainContentContainer.addChild(backToMenuContainer);

        // Play Again button (will be positioned on right side of leaderboard card)
        const playAgainContainer = new PIXI.Container();
        playAgainContainer.y = leaderboardCard.y; // Same y level as leaderboard
        playAgainContainer.x = 390; // Right side
        
        const playBtnBg = new PIXI.Graphics();
        const playBtnWidth = 200;
        const playBtnHeight = 40;
        playBtnBg.beginFill(0x00ff66, 0.3);
        playBtnBg.drawRoundedRect(-playBtnWidth/2, -playBtnHeight/2, playBtnWidth, playBtnHeight, 10);
        playBtnBg.endFill();
        playBtnBg.lineStyle(2, 0x00ff66, 1);
        playBtnBg.drawRoundedRect(-playBtnWidth/2, -playBtnHeight/2, playBtnWidth, playBtnHeight, 10);
        playAgainContainer.addChild(playBtnBg);

        const playAgain = new PIXI.Text("▶ Play Again", {
            fill: "#00ff66",
            fontSize: 20,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        playAgain.anchor.set(0.5);
        playAgainContainer.addChild(playAgain);

        playAgainContainer.interactive = true;
        playAgainContainer.buttonMode = true;
        playAgainContainer.cursor = "pointer";
        playAgainContainer.on("pointerover", () => {
            playBtnBg.clear();
            playBtnBg.beginFill(0x00ff66, 0.4);
            playBtnBg.drawRoundedRect(-playBtnWidth/2, -playBtnHeight/2, playBtnWidth, playBtnHeight, 10);
            playBtnBg.endFill();
            playBtnBg.lineStyle(3, 0x00ff66, 1);
            playBtnBg.drawRoundedRect(-playBtnWidth/2, -playBtnHeight/2, playBtnWidth, playBtnHeight, 10);
            playAgain.style.fill = "#ffff66";
        });
        playAgainContainer.on("pointerout", () => {
            playBtnBg.clear();
            playBtnBg.beginFill(0x00ff66, 0.3);
            playBtnBg.drawRoundedRect(-playBtnWidth/2, -playBtnHeight/2, playBtnWidth, playBtnHeight, 10);
            playBtnBg.endFill();
            playBtnBg.lineStyle(2, 0x00ff66, 1);
            playBtnBg.drawRoundedRect(-playBtnWidth/2, -playBtnHeight/2, playBtnWidth, playBtnHeight, 10);
            playAgain.style.fill = "#00ff66";
        });
        playAgainContainer.on("pointerdown", resetGame);
        
        mainContentContainer.addChild(playAgainContainer);

        // Album button with art inside
        const albumButton = new PIXI.Container();
        albumButton.x = GAME_WIDTH / 2;
        albumButton.y = mainContentContainer.y + leaderboardCard.y + cardHeight/2 + 85;
        
        const albumBtnBg = new PIXI.Graphics();
        const albumBtnWidth = 460; // Wider to prevent text overflow
        const albumBtnHeight = 90; // Increased height to accommodate art
        albumBtnBg.beginFill(0x000000, 1); // Fully opaque
        albumBtnBg.drawRoundedRect(-albumBtnWidth/2, -albumBtnHeight/2, albumBtnWidth, albumBtnHeight, 12);
        albumBtnBg.endFill();
        albumBtnBg.lineStyle(2, 0xffff00, 1);
        albumBtnBg.drawRoundedRect(-albumBtnWidth/2, -albumBtnHeight/2, albumBtnWidth, albumBtnHeight, 12);
        albumButton.addChild(albumBtnBg);

        // Album art thumbnail (inside button, left side)
        // Make it slightly smaller to fit within the button border (2px border means 4px total inset needed)
        const artSize = 88; // Slightly smaller to leave space for the 2px border
        
        const albumArtThumb = new PIXI.Sprite(PIXI.Assets.get('assets/soldier-album-art.png'));
        albumArtThumb.anchor.set(0.5);
        albumArtThumb.width = artSize;
        albumArtThumb.height = artSize;
        const artX = -albumBtnWidth/2 + artSize/2 + 1; // Positioned with inset from left edge
        albumArtThumb.x = artX;
        
        // Add rounded corners mask to match button's rounded corners
        const artMask = new PIXI.Graphics();
        artMask.beginFill(0xffffff);
        artMask.drawRoundedRect(-artSize/2, -artSize/2, artSize, artSize, 11); // Slightly smaller radius for smaller art
        artMask.endFill();
        artMask.x = artX; // Position mask at same location as art
        albumArtThumb.mask = artMask;
        albumButton.addChild(artMask);
        albumButton.addChild(albumArtThumb);

        // Album button text (right side of art)
        const albumBtnText = new PIXI.Text("🎵 Get the SOLDIER Album", {
            fill: "#ffff00",
            fontSize: 22,
            fontWeight: "bold",
            fontFamily: "Orbitron"
        });
        albumBtnText.anchor.set(0, 0.5);
        // Position text to the right of the art (art center + half art size + gap)
        albumBtnText.x = artX + artSize/2 + 8; // To the right of art with small gap
        albumButton.addChild(albumBtnText);

        // Animated pointing finger (medium skin tone) pointing at album button
        const albumPointingFinger = new PIXI.Text("👇🏽", {
            fontSize: 32,
        });
        albumPointingFinger.anchor.set(0.5);
        albumPointingFinger.y = -albumBtnHeight/2 - 15; // Positioned above the button
        
        // Animate the pointing finger and button pulse effect
        let albumFingerOffset = 0;
        const animateAlbumFinger = () => {
            if (albumPointingFinger && albumButton && gameOverScene.visible && !isAlbumButtonHovered) {
                albumFingerOffset += 0.1;
                // Bounce the finger
                albumPointingFinger.y = -albumBtnHeight/2 - 15 + Math.sin(albumFingerOffset) * 5;
                
                // Pulse the button scale (same frequency as finger)
                const pulseScale = 1 + Math.sin(albumFingerOffset) * 0.03; // Very subtle pulse (3%)
                albumButton.scale.set(pulseScale);
            }
        };
        app.ticker.add(animateAlbumFinger);
        
        albumButton.addChild(albumPointingFinger);

        albumButton.interactive = true;
        albumButton.buttonMode = true;
        albumButton.cursor = "pointer";
        
        // Track if button is hovered to pause pulse when hovered
        let isAlbumButtonHovered = false;
        
        albumButton.on("pointerover", () => {
            isAlbumButtonHovered = true;
            albumBtnBg.clear();
            albumBtnBg.beginFill(0x1a1a1a, 1); // Lighter background, fully opaque
            albumBtnBg.drawRoundedRect(-albumBtnWidth/2, -albumBtnHeight/2, albumBtnWidth, albumBtnHeight, 12);
            albumBtnBg.endFill();
            albumBtnBg.lineStyle(3, 0xffff00, 1); // Thicker, brighter border
            albumBtnBg.drawRoundedRect(-albumBtnWidth/2, -albumBtnHeight/2, albumBtnWidth, albumBtnHeight, 12);
            albumBtnText.style.fill = "#ffff99"; // Brighter text
            albumButton.scale.set(1.02); // Slight scale up for emphasis
        });
        albumButton.on("pointerout", () => {
            isAlbumButtonHovered = false;
            albumBtnBg.clear();
            albumBtnBg.beginFill(0x000000, 1); // Back to opaque black
            albumBtnBg.drawRoundedRect(-albumBtnWidth/2, -albumBtnHeight/2, albumBtnWidth, albumBtnHeight, 12);
            albumBtnBg.endFill();
            albumBtnBg.lineStyle(2, 0xffff00, 1); // Normal border
            albumBtnBg.drawRoundedRect(-albumBtnWidth/2, -albumBtnHeight/2, albumBtnWidth, albumBtnHeight, 12);
            albumBtnText.style.fill = "#ffff00"; // Normal text color
            albumButton.scale.set(1.0); // Reset scale
        });
        albumButton.on("pointerdown", () => {
            window.open("https://github.com/ArinzeGit", "_blank");
        });

        gameOverScene.addChild(albumButton);
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
        gameSceneBgContainer.visible = true;
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
            letter.style.stroke = "#000000";
            letter.style.strokeThickness = 0;
        });

        cleanUnsavedEntries();

        startSpawning();
    }

    function cleanUnsavedEntries() {
        // Clear any existing input modal
        if (inputModalContainer) {
            gameOverScene.removeChild(inputModalContainer);
            inputModalContainer = null;
        }
        if (inputModalInput && inputModalInput.parentNode) {
            if (inputModalInput._resizeHandler) {
                window.removeEventListener("resize", inputModalInput._resizeHandler);
            }
            document.body.removeChild(inputModalInput);
            inputModalInput = null;
        }
        if (inputModalButton && inputModalButton.parentNode) {
            document.body.removeChild(inputModalButton);
            inputModalButton = null;
        }
        
        // Clean up pending entries
        leaderboard.forEach(entry => {
            if (entry.pending) delete entry.pending;
        });
        pendingLeaderboardIndex = null;
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