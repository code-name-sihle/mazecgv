console.log('main.js loaded');

//--------------------------------IMPORTS----------------------------------------
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, Clock } from 'three';

//--------------------------------GLOBAL VARIABLES------------------------------
// Game State Variables
let isTransitioning = false;
let currentMaze = null;
let character, mixer, walkAction, idleAction, maze;
let currentLevel = 1;
let collectedCoins = 0;
let totalCoins;
let hasMoved = false;
let timerId = null;
let isGameOver = false;
let timeLeft = 60;

// Movement Controls
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
};

// Collision Detection
const raycaster = new THREE.Raycaster();
let characterBox = new THREE.Box3();
let exitBox = new THREE.Box3();
let greenBox = new THREE.Box3();

// Coin System
let coins = [];
let coinModel;
const coinPositions = [
    { x: 3.5, y: 5, z: 9 },
    { x: 4.5, y: 5, z: 9.5 },
    { x: 9.5, y: 5, z: 23.5 },
    { x: 19.5, y: 5, z: 8.5 },
    { x: 20, y: 5, z: 35 },
    { x: 25, y: 5, z: 39 },
    { x: 29, y: 5, z: 2.5 },
    { x: 30, y: 5, z: 2 },
    { x: 40.5, y: 5, z: 13.5 },
    { x: 46, y: 5, z: 51.5 },
    { x: 52, y: 5, z: 9.5 },
];

// Type definitions for better code maintenance
const GameStatus = {
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};
let currentGameState = GameStatus.PLAYING;
//--------------------------------SCENE SETUP----------------------------------
// Scene Creation
console.log('Creating the scene...');
const scene = new THREE.Scene();
const clock = new THREE.Clock();

// Camera Setup
console.log('Setting up the cameras...');
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const miniMapCamera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 500);
miniMapCamera.position.set(0, 100, 0);
miniMapCamera.lookAt(0, 0, 0);

// Renderer Setup
console.log('Setting up the renderers...');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const miniMapRenderer = new THREE.WebGLRenderer({ alpha: true });
miniMapRenderer.setSize(1000, 1000);
miniMapRenderer.domElement.style.position = 'absolute';
miniMapRenderer.domElement.style.bottom = '-160px';
miniMapRenderer.domElement.style.left = '-480px';
miniMapRenderer.domElement.style.pointerEvents = 'none';
miniMapRenderer.domElement.style.zIndex = 10;
document.body.appendChild(miniMapRenderer.domElement);

// Skybox Setup
console.log('Setting up the skybox...');
const cubeTextureLoader = new THREE.CubeTextureLoader();
const skyboxTexture = cubeTextureLoader.load([
  'back.jpg', 'left.jpg',
  'bottom.jpg', 'right.jpg',
  'front.jpg', 'top.jpg'
]);
scene.background = skyboxTexture;

// Handle window resize
console.log('Setting up window resize event listener...');
window.addEventListener('resize', () => {
  console.log('Window resized, updating camera and renderer...');
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
//--------------------------------LIGHTING SETUP-------------------------------
// Ambient Light
const light = new THREE.AmbientLight(0x404040, 3);
scene.add(light);

// Directional Light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

// Point Light
const pointLight = new THREE.PointLight(0xff7f00, 0.5, 20);
pointLight.position.set(0, 10, 0);
pointLight.castShadow = true;
scene.add(pointLight);
// Optimize shadow settings for better performance
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;

//------------------PLAYER SETUP AND CONTROLS---------------------------------
//--------------------------------PLAYER SETUP & CONTROLS-------------------------
// Player Loading
function loadPlayer() {
    console.log('Loading player...');
    const loader = new FBXLoader();
    const ANIMATION_CROSSFADE_TIME = 0.2;
    loader.load('asset/jogPlayer.fbx', (joggingfbx) => {
        console.log('Player loaded successfully');
        character = joggingfbx;
        character.position.set(24, 0, 2);
        character.scale.set(0.045, 0.045, 0.045);

        // Add shadow casting
        character.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(character);

        mixer = new AnimationMixer(character);
        walkAction = mixer.clipAction(joggingfbx.animations[0]);
        walkAction.loop = THREE.LoopRepeat;
        walkAction.play();

        // Load idle animation
        loader.load('asset/idlePlayer.fbx', (idleFBX) => {
            console.log('Idle animation loaded successfully');
            idleAction = mixer.clipAction(idleFBX.animations[0]);
            idleAction.loop = THREE.LoopRepeat;
            idleAction.play();
            idleAction.weight = 1;
            walkAction.weight = 0;
        });

        setInitialCameraPosition();
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('Error loading jogging FBX', error);
    });
}

// Camera Controls
function setInitialCameraPosition() {
    console.log('Setting initial camera position');
    if (!character) return;
    camera.position.set(24, 10, 17);
    camera.lookAt(character.position);
}

function updateCamera() {
    console.log('Updating camera position');
    if (!character) return;
    const offset = new THREE.Vector3(0, 10, 15);
    const lookAtPos = character.position.clone();
    camera.position.copy(character.position).add(offset);
    camera.lookAt(lookAtPos);
}

// Player Movement Controls
function updatePlayerMovement() {
    console.log('Updating player movement');
    if (!character || isGameOver) return;

    const moveSpeed = 0.5;
    let moved = false;

    if (keys.w) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(character.quaternion);
        if (!checkRaycastCollision(forward)) {
            character.position.add(forward.multiplyScalar(moveSpeed));
            moved = true;
        }
    }
    if (keys.s) {
        const backward = new THREE.Vector3(0, 0, 1);
        backward.applyQuaternion(character.quaternion);
        if (!checkRaycastCollision(backward)) {
            character.position.add(backward.multiplyScalar(moveSpeed));
            moved = true;
        }
    }
    if (keys.a) {
        character.rotation.y += 0.05;
        moved = true;
    }
    if (keys.d) {
        character.rotation.y -= 0.05;
        moved = true;
    }

    // Update animation states
    if (moved && !hasMoved) {
        walkAction.weight = 1;
        idleAction.weight = 0;
        hasMoved = true;
    } else if (!moved && hasMoved) {
        walkAction.weight = 0;
        idleAction.weight = 1;
        hasMoved = false;
    }

    updateCamera();
}

// Player Movement Event Listeners
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        console.log(`Key down: ${key}`);
        keys[key] = true;
    }
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        console.log(`Key up: ${key}`);
        keys[key] = false;
    }
});

// Player Position Reset
function resetPlayerPosition() {
    console.log('Resetting player position');
    if (character) {
        character.position.set(24, 0, 2);
        character.rotation.y = 0;
        
        if (walkAction && idleAction) {
            walkAction.reset();
            idleAction.reset();
            walkAction.weight = 0;
            idleAction.weight = 1;
        }
    }
}
//-----------helper functions-----------------------------------------------------
// Loading screen UI elements
const loadingScreen = document.createElement('div');
loadingScreen.className = 'loading-screen';
loadingScreen.innerHTML = `
    <div class="loading-content">
        <h2>Loading Maze</h2>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <p class="loading-text">0%</p>
    </div>
`;
document.body.appendChild(loadingScreen);

// Error message UI element
const errorContainer = document.createElement('div');
errorContainer.className = 'error-container';
errorContainer.style.display = 'none';
document.body.appendChild(errorContainer);

// Loading screen functions
function showLoadingScreen() {
    loadingScreen.style.display = 'flex';
    // Reset progress
    const progressFill = loadingScreen.querySelector('.progress-fill');
    const loadingText = loadingScreen.querySelector('.loading-text');
    if (progressFill) progressFill.style.width = '0%';
    if (loadingText) loadingText.textContent = '0%';
}

function hideLoadingScreen() {
    loadingScreen.style.display = 'none';
}

function updateLoadingProgress(progress) {
    const progressFill = loadingScreen.querySelector('.progress-fill');
    const loadingText = loadingScreen.querySelector('.loading-text');
    
    if (progressFill && loadingText) {
        const percentage = Math.round(progress);
        progressFill.style.width = `${percentage}%`;
        loadingText.textContent = `${percentage}%`;
    }
}

// Error handling functions
function showErrorMessage(message) {
    errorContainer.innerHTML = `
        <div class="error-content">
            <p class="error-text">${message}</p>
            <button class="retry-button">Retry</button>
        </div>
    `;
    errorContainer.style.display = 'flex';
    
    // Add retry button functionality
    const retryButton = errorContainer.querySelector('.retry-button');
    retryButton.addEventListener('click', () => {
        errorContainer.style.display = 'none';
        // Retry loading the current level
        if (typeof currentLevel !== 'undefined') {
            loadMazeForLevel(currentLevel);
        } else {
            loadMaze1();
        }
    });
}

// Add necessary CSS styles
const styles = document.createElement('style');
styles.textContent = `
    .loading-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .loading-content {
        background: #fff;
        padding: 2rem;
        border-radius: 8px;
        text-align: center;
    }
    
    .progress-bar {
        width: 200px;
        height: 20px;
        background: #eee;
        border-radius: 10px;
        overflow: hidden;
        margin: 1rem 0;
    }
    
    .progress-fill {
        width: 0%;
        height: 100%;
        background: #4CAF50;
        transition: width 0.3s ease;
    }
    
    .error-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .error-content {
        background: #fff;
        padding: 2rem;
        border-radius: 8px;
        text-align: center;
    }
    
    .error-text {
        color: #f44336;
        margin-bottom: 1rem;
    }
    
    .retry-button {
        padding: 0.5rem 1rem;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.3s;
    }
    
    .retry-button:hover {
        background: #45a049;
    }
`;

//--------green mesh-----------------------------------------------------------
let greenMesh = null;
let greenGeometry= null;
let greenMaterial = null;

function createGreenMesh(){
    // Once the maze is loaded, create and add the greenMesh
  greenGeometry = new THREE.PlaneGeometry(2, 6.5);  // Width and height of the rectangle
  greenMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,  // Base color (green)
    emissive: 0x00ff00,  // green emission light
    emissiveIntensity: 1,  // Intensity of the emissive light
    side: THREE.DoubleSide,  // Makes the plane visible from both sides
  });

  greenMesh = new THREE.Mesh(greenGeometry, greenMaterial);
  greenMesh.position.set(25, 0, -1);  // Position the object behind the player
  greenMesh.scale.set(3.3, 3.8, 3.8);
  scene.add(greenMesh);

}

//--------------------------------MAZE SYSTEM----------------------------------
// Maze Loading Setup
const gltfLoader = new GLTFLoader();
const mazeConfig = {
  1: { file: 'asset/Maze2.glb', timeLimit: 60 },
  2: { file: 'asset/Maze3.glb', timeLimit: 120 },
  3: { file: 'asset/Maze4.glb', timeLimit: 180 }
};

// Exit Zone Setup with improved visual feedback
const exitGeometry = new THREE.PlaneGeometry(2, 4);
const exitMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 1,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.8
});
const exitMesh = new THREE.Mesh(exitGeometry, exitMaterial);
exitMesh.position.set(30, 5, 54);
exitMesh.scale.set(3.3, 3.3, 3.8);
scene.add(exitMesh);

// Add pulsing animation to exit
const pulseAnimation = () => {
  const pulse = new THREE.AnimationMixer(exitMesh);
  const track = new THREE.NumberKeyframeTrack(
    '.material.emissiveIntensity',
    [0, 1],
    [1, 0.5]
  );
  const clip = new THREE.AnimationClip('pulse', 1, [track]);
  const action = pulse.clipAction(clip);
  action.setLoop(THREE.LoopPingPong);
  action.play();
  return pulse;
};
const exitPulse = pulseAnimation();

// Maze Loading Functions with improved error handling and loading states
async function loadMaze1() {
  try {
    showLoadingScreen();
    const gltf = await loadGLTFPromise('asset/Maze2.glb');
    setupMaze(gltf.scene);
    createGreenMesh();
    hideLoadingScreen();
  } catch (error) {
    console.error('Failed to load initial maze:', error);
    showErrorMessage('Failed to load maze. Please refresh the page.');
  }
}

async function loadMazeForLevel(level) {
  if (!mazeConfig[level]) {
    throw new Error(`Invalid level: ${level}`);
  }

  try {
    showLoadingScreen();
    cleanupCurrentMaze();
    
    const gltf = await loadGLTFPromise(mazeConfig[level].file);
    setupMaze(gltf.scene);
    
    hideLoadingScreen();
    return Promise.resolve();
  } catch (error) {
    hideLoadingScreen();
    showErrorMessage(`Failed to load level ${level}`);
    return Promise.reject(error);
  }
}

// Helper Functions
function loadGLTFPromise(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, 
      (xhr) => {
        const progress = (xhr.loaded / xhr.total * 100);
        updateLoadingProgress(progress);
      }, 
      reject
    );
  });
}

function setupMaze(mazeScene) {
  currentMaze = mazeScene;
  currentMaze.position.set(0, 0, 0);
  currentMaze.scale.set(55, 55, 55);
  applyMazeMaterials(currentMaze);
  scene.add(currentMaze);
}

function cleanupCurrentMaze() {
  if (currentMaze) {
    currentMaze.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    scene.remove(currentMaze);
    currentMaze = null;
  }
  
  coins.forEach(coin => {
    if (coin.geometry) coin.geometry.dispose();
    if (coin.material) coin.material.dispose();
    scene.remove(coin);
  });
  coins = [];
}

// Improved material handling with memory management
function applyMazeMaterials(mazeObject) {
  const materials = new Map();
  
  mazeObject.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      
      if (child.material) {
        // Reuse materials for similar meshes
        const materialKey = `${child.material.color.getHex()}-${child.material.metalness}-${child.material.roughness}`;
        
        if (!materials.has(materialKey)) {
          const material = child.material.clone();
          material.roughness = 0.7;
          material.metalness = 0.3;
          material.envMap = skyboxTexture;
          material.envMapIntensity = 1;
          materials.set(materialKey, material);
        }
        
        child.material = materials.get(materialKey);
      }
    }
  });
}

// Improved level transition system with proper state management
async function handleLevelTransition() {
  if (isTransitioning) return;
  isTransitioning = true;
  
  const nextLevel = currentLevel + 1;
  
  try {
    if (nextLevel > 3) {
      await handleGameCompletion();
      return;
    }

    const transitionUI = createTransitionUI(nextLevel);
    await fadeOutScene();
    await loadMazeForLevel(nextLevel);
    updateGameState(nextLevel);
    await fadeInScene();
    
    setTimeout(() => removeTransitionUI(transitionUI), 1000);
  } catch (error) {
    console.error('Level transition failed:', error);
    showErrorMessage('Failed to load next level');
  } finally {
    isTransitioning = false;
  }
}

// UI Helper Functions
function createTransitionUI(level) {
  const container = document.createElement('div');
  container.className = 'level-transition';
  container.innerHTML = `
    <div class="transition-content">
      <h2>Level ${level}</h2>
      <div class="loading-bar"></div>
    </div>
  `;
  document.body.appendChild(container);
  return container;
}

function updateGameState(nextLevel) {
  resetPlayerPosition();
  currentLevel = nextLevel;
  timeLeft = mazeConfig[nextLevel].timeLimit;
  collectedCoins = 0;
  
  if (currentLevel >= 2) {
    addCoinsToMaze();
  }
  
  updateCoinDisplay();
  resetTimer();
}

// Initialize first maze
loadMaze1();

//--------------------------------COIN LOADING----------------------------------------
// Coin System Configuration
const COIN_CONFIG = {
    scale: 0.01,
    rotationSpeed: 0.02,
    hoverHeight: 0.2,
    hoverSpeed: 0.003,
    collectionRadius: 2,
    material: {
        color: 0xffd700,
        metalness: 1,
        roughness: 0.3,
        envMapIntensity: 1
    }
};

// Coin Model Variables
//let coins = [];
//let coinModel;
let coinMaterial;

// Coin Animation Variables
const coinAnimations = {
    time: 0,
    initialPositions: new Map()
};

// Initialize Coin Material
function initializeCoinMaterial() {
    coinMaterial = new THREE.MeshStandardMaterial({
        ...COIN_CONFIG.material,
        envMap: skyboxTexture
    });
}

// Load Coin Model with improved error handling
function loadCoinModel() {
    return new Promise((resolve, reject) => {
        const coinLoader = new FBXLoader();
        
        coinLoader.load('asset/coin.fbx', 
            (fbx) => {
                coinModel = setupCoinModel(fbx);
                resolve(coinModel);
            },
            (xhr) => {
                const progress = (xhr.loaded / xhr.total * 100).toFixed(2);
                console.log(`Loading coin model: ${progress}%`);
            },
            (error) => {
                console.error('Failed to load coin model:', error);
                reject(error);
            }
        );
    });
}

// Setup Coin Model
function setupCoinModel(fbx) {
    fbx.scale.setScalar(COIN_CONFIG.scale);
    
    fbx.traverse((child) => {
        if (child.isMesh) {
            child.material = coinMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    return fbx;
}

// Coin Positions Manager
const coinPositionsManager = {
    positions: [
        { x: 3.5, y: 5, z: 9 },
        { x: 4.5, y: 5, z: 9.5 },
        { x: 9.5, y: 5, z: 23.5 },
        { x: 19.5, y: 5, z: 8.5 },
        { x: 20, y: 5, z: 35 },
        { x: 25, y: 5, z: 39 },
        { x: 29, y: 5, z: 2.5 },
        { x: 30, y: 5, z: 2 },
        { x: 40.5, y: 5, z: 13.5 },
        { x: 46, y: 5, z: 51.5 },
        { x: 52, y: 5, z: 9.5 }
    ],
    
    getPositionsForLevel(level) {
        // You can customize positions based on level
        return this.positions;
    }
};

// Add Coins to Maze with improved performance
async function addCoinsToMaze() {
    if (!coinModel) {
        try {
            await loadCoinModel();
        } catch (error) {
            console.error('Failed to load coins:', error);
            return;
        }
    }
    
    cleanupExistingCoins();
    
    if (currentLevel < 2) return;
    
    const positions = coinPositionsManager.getPositionsForLevel(currentLevel);
    
    positions.forEach(pos => {
        const coin = createCoin(pos);
        coins.push(coin);
        scene.add(coin);
        
        // Store initial position for animation
        coinAnimations.initialPositions.set(coin.uuid, pos.y);
    });
}

// Create Individual Coin
function createCoin(position) {
    const coin = coinModel.clone();
    coin.position.set(position.x, position.y, position.z);
    return coin;
}

// Cleanup Existing Coins
function cleanupExistingCoins() {
    coins.forEach(coin => {
        scene.remove(coin);
        if (coin.geometry) coin.geometry.dispose();
    });
    coins = [];
    coinAnimations.initialPositions.clear();
}

// Update Coin Animations
function updateCoins(deltaTime) {
    coinAnimations.time += deltaTime;
    
    coins.forEach(coin => {
        // Rotation animation
        coin.rotation.y += COIN_CONFIG.rotationSpeed;
        
        // Hovering animation
        const initialY = coinAnimations.initialPositions.get(coin.uuid);
        if (initialY !== undefined) {
            coin.position.y = initialY + 
                Math.sin(coinAnimations.time * COIN_CONFIG.hoverSpeed) * 
                COIN_CONFIG.hoverHeight;
        }
    });
}

// Optimized Coin Collection Detection
function checkCoinCollection() {
    if (!character || coins.length === 0) return;
    
    const characterPosition = new THREE.Vector3();
    character.getWorldPosition(characterPosition);
    
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        const coinPosition = new THREE.Vector3();
        coin.getWorldPosition(coinPosition);
        
        if (coinPosition.distanceTo(characterPosition) < COIN_CONFIG.collectionRadius) {
            collectCoin(i);
        }
    }
}

// Coin Collection Handler
function collectCoin(index) {
    const coin = coins[index];
    
    // Play collection animation
    playCoinCollectionEffect(coin.position);
    
    // Remove coin
    scene.remove(coin);
    coins.splice(index, 1);
    coinAnimations.initialPositions.delete(coin.uuid);
    
    // Update game state
    collectedCoins++;
    updateCoinDisplay();
    
    // Play sound effect if available
    playCollectionSound();
}

// Visual Effects
function playCoinCollectionEffect(position) {
    // Create particle effect
    const particles = new THREE.Points(
        new THREE.BufferGeometry(),
        new THREE.PointsMaterial({
            color: COIN_CONFIG.material.color,
            size: 0.1,
            transparent: true
        })
    );
    
    // Add particles to scene and animate them
    scene.add(particles);
    setTimeout(() => scene.remove(particles), 500);
}

// Sound Effects
function playCollectionSound() {
    // Add sound effect implementation here
    // This is a placeholder for sound implementation
}

// Initialize the coin system
initializeCoinMaterial();



//  -------------------------------- COLLISION DETECTION --------------------------------

// Constants
const COLLISION_CONSTANTS = {
    RAY_OFFSET_DISTANCE: 1.5,
    COLLISION_THRESHOLD: 2,
    EXIT_COLLISION_THRESHOLD: 0.5,
    MIN_DETECTION_DISTANCE: 0.1
};

class CollisionSystem {
    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.characterBox = new THREE.Box3();
        this.exitBox = new THREE.Box3();
        this.greenBox = new THREE.Box3();
        
        // Reusable vectors to minimize garbage collection
        this._tempVector = new THREE.Vector3();
        this._thresholdVector = new THREE.Vector3();
    }

    /**
     * Checks for collisions using raycasting
     * @param {THREE.Vector3} directionVector - Direction to check for collision
     * @param {THREE.Object3D} character - Character mesh
     * @param {THREE.Object3D} currentMaze - Current maze object
     * @returns {boolean} Whether a collision was detected
     */
    checkRaycastCollision(directionVector, character, currentMaze) {
        try {
            if (!this._validateInputs(character, currentMaze, directionVector)) {
                return false;
            }

            const rayOrigin = this._calculateRayOrigin(
                character.position,
                directionVector
            );

            this.raycaster.set(rayOrigin, directionVector.normalize());
            const intersects = this.raycaster.intersectObjects(
                currentMaze.children,
                true
            );

            return (
                intersects.length > 0 &&
                intersects[0].distance < COLLISION_CONSTANTS.COLLISION_THRESHOLD
            );
        } catch (error) {
            console.error('Error in checkRaycastCollision:', error);
            return false;
        }
    }

    /**
     * Checks for collision with the exit
     * @param {THREE.Object3D} character - Character mesh
     * @param {THREE.Object3D} exitMesh - Exit mesh
     * @param {boolean} isTransitioning - Whether the game is in transition
     * @returns {boolean} Whether character has collided with exit
     */
    checkExitCollision(character, exitMesh, isTransitioning) {
        try {
            if (!this._validateExitInputs(character, exitMesh)) {
                return false;
            }

            this._updateBoundingBoxes(character, exitMesh);

            const collision = this.characterBox.intersectsBox(this.exitBox);
            return collision && !isTransitioning;
        } catch (error) {
            console.error('Error in checkExitCollision:', error);
            return false;
        }
    }

    /**
     * Updates the bounding boxes with threshold
     * @private
     */
    _updateBoundingBoxes(character, exitMesh) {
        this.characterBox.setFromObject(character);
        this.exitBox.setFromObject(exitMesh);

        this._thresholdVector.set(
            COLLISION_CONSTANTS.EXIT_COLLISION_THRESHOLD,
            COLLISION_CONSTANTS.EXIT_COLLISION_THRESHOLD,
            COLLISION_CONSTANTS.EXIT_COLLISION_THRESHOLD
        );

        this.characterBox.min.add(this._thresholdVector);
        this.characterBox.max.sub(this._thresholdVector);
    }

    /**
     * Calculates ray origin with offset
     * @private
     */
    _calculateRayOrigin(position, directionVector) {
        return position
            .clone()
            .add(
                directionVector
                    .clone()
                    .normalize()
                    .multiplyScalar(COLLISION_CONSTANTS.RAY_OFFSET_DISTANCE)
            );
    }

    /**
     * Validates inputs for raycast collision
     * @private
     */
    _validateInputs(character, currentMaze, directionVector) {
        return (
            character &&
            currentMaze &&
            directionVector &&
            directionVector.lengthSq() > COLLISION_CONSTANTS.MIN_DETECTION_DISTANCE
        );
    }

    /**
     * Validates inputs for exit collision
     * @private
     */
    _validateExitInputs(character, exitMesh) {
        return character && exitMesh;
    }
}

export default CollisionSystem;


//----------game logic-----------------------------------------------------------
class GameState {
    static INITIAL_TIME = 60;
    static INITIAL_POSITION = new THREE.Vector3(24, 0, 2);
  
    constructor() {
      console.log('Initializing game state...');
      this.isTransitioning = false;
      this.currentLevel = 1;
      this.collectedCoins = 0;
      this.timeLeft = GameState.INITIAL_TIME;
      this.timerId = null;
      this.isGameOver = false;
      this.hasMoved = false;
      this.flashInterval = null;
    }
  }
  
  class GameLogicSystem {
    constructor(scene, renderer, miniMapRenderer, character, mixer) {
      console.log('Initializing game logic system...');
      this.gameState = new GameState();
      this.scene = scene;
      this.renderer = renderer;
      this.miniMapRenderer = miniMapRenderer;
      this.character = character;
      this.mixer = mixer;
      this.clock = new THREE.Clock();
  
      this.domElements = {
        timer: document.getElementById('timer'),
        gameOverModal: document.getElementById('gameOverModal'),
        gameWonModal: document.getElementById('gameWonModal'),
        startModal: document.getElementById('startModal')
      };
  
      // Bind methods to preserve context
      this.animate = this.animate.bind(this);
      this.startTimer = this.startTimer.bind(this);
    }
  
    /**
     * Starts the game timer
     */
    startTimer() {
      console.log('Starting the game timer...');
      if (this.gameState.timerId) {
        clearInterval(this.gameState.timerId);
      }
  
      this.gameState.timerId = setInterval(() => {
        if (this.gameState.timeLeft <= 0) {
          this.handleTimeUp();
        } else {
          this.updateTimer();
        }
      }, 1000);
    }
  
    /**
     * Handles timer reaching zero
     * @private
     */
    handleTimeUp() {
      console.log('Time is up, handling game over...');
      clearInterval(this.gameState.timerId);
      this.gameState.isGameOver = true;
      this.showGameOver();
    }
  
    /**
     * Updates timer display
     * @private
     */
    updateTimer() {
      this.gameState.timeLeft--;
      if (this.domElements.timer) {
        this.domElements.timer.textContent = this.gameState.timeLeft;
      }
    }
  
    /**
     * Main game animation loop
     */
    animate() {
      console.log('Entering game animation loop...');
      requestAnimationFrame(this.animate);
  
      const delta = this.clock.getDelta();
      this.updateGameState(delta);
      this.renderScene();
    }
  
    /**
     * Updates game state each frame
     * @private
     */
    updateGameState(delta) {
      console.log('Updating game state...');
      if (this.mixer && this.gameState.hasMoved) {
        console.log('Updating character animations...');
        this.mixer.update(delta);
      }
  
      if (!this.gameState.isGameOver && this.character) {
        console.log('Updating player movement and coin collection...');
        this.updatePlayerMovement();
        this.checkCoinCollection();
  
        if (this.checkExitCollision()) {
          console.log('Handling level transition...');
          this.handleLevelTransition();
        }
      }
    }
  
    /**
     * Renders the main scene and minimap
     * @private
     */
    renderScene() {
      console.log('Rendering the scene and minimap...');
      this.renderer.render(this.scene, this.camera);
      this.miniMapRenderer.render(this.scene, this.miniMapCamera);
    }
  
    /**
     * Resets player position and animation
     */
    resetPlayerPosition() {
      console.log('Resetting player position and animations...');
      if (!this.character) return;
  
      this.character.position.copy(GameState.INITIAL_POSITION);
      this.character.rotation.y = 0;
  
      this.resetAnimations();
    }
  
    /**
     * Resets character animations
     * @private
     */
    resetAnimations() {
      console.log('Resetting character animations...');
      if (this.walkAction && this.idleAction) {
        this.walkAction.reset();
        this.idleAction.reset();
        this.walkAction.weight = 0;
        this.idleAction.weight = 1;
      }
    }
  
    /**
     * Shows game over modal
     */
    showGameOver() {
      console.log('Showing game over modal...');
      if (this.domElements.gameOverModal) {
        this.domElements.gameOverModal.style.display = 'flex';
      }
      this.gameState.isGameOver = true;
    }
  
    /**
     * Shows game won modal
     */
    showGameWon() {
      console.log('Showing game won modal...');
      if (this.domElements.gameWonModal) {
        this.domElements.gameWonModal.style.display = 'flex';
      }
      this.gameState.isGameOver = true;
    }
  
    /**
     * Restarts the game
     */
    restartGame() {
      console.log('Restarting the game...');
      this.clearIntervals();
      this.resetGameState();
      this.resetUI();
      this.resetLevel();
    }
  
    /**
     * Clears all active intervals
     * @private
     */
    clearIntervals() {
      console.log('Clearing all active intervals...');
      clearInterval(this.gameState.timerId);
      clearInterval(this.gameState.flashInterval);
      document.body.classList.remove('flashing');
    }
  
    /**
     * Resets game state to initial values
     * @private
     */
    resetGameState() {
      console.log('Resetting game state to initial values...');
      this.gameState = new GameState();
      this.updateCoinDisplay();
    }
  
    /**
     * Resets UI elements
     * @private
     */
    resetUI() {
      console.log('Resetting UI elements...');
      if (this.domElements.timer) {
        this.domElements.timer.textContent = GameState.INITIAL_TIME;
      }
      if (this.domElements.gameOverModal) {
        this.domElements.gameOverModal.style.display = 'none';
      }
      if (this.domElements.startModal) {
        this.domElements.startModal.style.display = 'flex';
      }
    }
  
    /**
     * Resets level state
     * @private
     */
    resetLevel() {
      console.log('Resetting level state...');
      if (this.maze) {
        this.scene.remove(this.maze);
      }
      this.loadMaze1();
      if (this.character) {
        this.character.position.copy(GameState.INITIAL_POSITION);
      }
    }
  
    /**
     * Updates coin display
     * @private
     */
    updateCoinDisplay() {
      console.log('Updating coin display...');
      // Implementation depends on your UI setup
      // Add coin display update logic here
    }
  }
  
  export { GameLogicSystem, GameState };
// --------------------------------EVENT HANDLER SYSTEM  --------------------------------

class EventHandlerSystem {
    constructor(gameLogic) {
        this.gameLogic = gameLogic;
        this.buttonIds = {
            start: 'startButton',
            exit: 'exitButton',
            restart: 'restartButton',
            returnToMenu: 'returnToMenu'
        };
        this.modalIds = { start: 'startModal' };
        this.registeredListeners = [];
 
        // Bind methods to preserve context
        this.startGame = this.startGame.bind(this);
        this.handleExit = this.handleExit.bind(this);
        this.handleRestart = this.handleRestart.bind(this);
        this.cleanup = this.cleanup.bind(this);
 
        this.initializeEventListeners();
    }
 
    initializeEventListeners() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupListeners());
        } else {
            this.setupListeners();
        }
        window.addEventListener('unload', this.cleanup);
        window.startGame = this.startGame;
    }
 
    setupListeners() {
        try {
            this.setupButtonListener(this.buttonIds.start, this.startGame);
            this.setupButtonListener(this.buttonIds.exit, this.handleExit);
            this.setupButtonListener(this.buttonIds.restart, this.handleRestart);
            this.setupButtonListener(this.buttonIds.returnToMenu, this.handleExit);
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }
 
    setupButtonListener(buttonId, handler) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', handler);
            this.registeredListeners.push({ buttonId, handler });
        } else {
            console.warn(`Button with id '${buttonId}' not found`);
        }
    }
 
    startGame() {
        try {
            console.log('Starting game...');
            this.hideStartModal();
            this.resetGameState();
            this.updateDisplays();
            this.initializeGameElements();
        } catch (error) {
            console.error('Error starting game:', error);
            this.handleGameError('Failed to start game');
        }
    }
 
    hideStartModal() {
        const startModal = document.getElementById(this.modalIds.start);
        if (startModal) {
            startModal.style.display = 'none';
        }
    }
 
    resetGameState() {
        if (this.gameLogic) {
            this.gameLogic.isGameOver = false;
            this.gameLogic.timeLeft = 60;
            this.gameLogic.collectedCoins = 0;
            this.gameLogic.currentLevel = 1;
        }
    }
 
    updateDisplays() {
        this.updateCoinDisplay();
        this.updateTimerDisplay();
    }
 
    updateCoinDisplay() {
        if (this.gameLogic && this.gameLogic.updateCoinDisplay) {
            this.gameLogic.updateCoinDisplay();
        }
    }
 
    updateTimerDisplay() {
        const timerElement = document.getElementById('timer');
        if (timerElement && this.gameLogic) {
            timerElement.textContent = this.gameLogic.timeLeft;
        }
    }
 
    initializeGameElements() {
        if (this.gameLogic) {
            this.gameLogic.startTimer();
            this.gameLogic.loadMaze1();
            this.gameLogic.resetPlayerPosition();
        }
    }
 
    handleExit() {
        try {
            console.log('Handling game exit...');
            this.cleanup();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error handling exit:', error);
            this.handleGameError('Failed to exit game');
        }
    }
 
    handleRestart() {
        try {
            console.log('Restarting game...');
            if (this.gameLogic) {
                this.gameLogic.restartGame();
            }
        } catch (error) {
            console.error('Error restarting game:', error);
            this.handleGameError('Failed to restart game');
        }
    }
 
    handleGameError(message) {
        console.error(message);
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
 
    cleanup() {
        try {
            console.log('Cleaning up game resources...');
            if (this.gameLogic) {
                this.gameLogic.cleanup();
            }
            this.removeEventListeners();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
 
    removeEventListeners() {
        this.registeredListeners.forEach(({ buttonId, handler }) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.removeEventListener('click', handler);
            }
        });
        this.registeredListeners = [];
    }
 }
 
 class KeyboardController {
    constructor(gameLogic) {
        this.gameLogic = gameLogic;
        this.keys = new Set();
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.initializeKeyboardControls();
    }
 
    initializeKeyboardControls() {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }
 
    handleKeyDown(event) {
        this.keys.add(event.key.toLowerCase());
    }
 
    handleKeyUp(event) {
        this.keys.delete(event.key.toLowerCase());
    }
 
    cleanup() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
 }
 
 export { EventHandlerSystem, KeyboardController };

//--------------------------------CLEANUP AND INITIALIZATION------------------------------------
// Proper cleanup function
function cleanup() {
    console.log('Performing cleanup...');
    clearInterval(timerId);
    if (mixer) mixer.stopAllAction();
  
    // Remove event listeners
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  
    // Dispose of geometries and materials
    scene.traverse((object) => {
      if (object.geometry) {
        console.log('Disposing of geometry:', object.geometry);
        object.geometry.dispose();
      }
      if (object.material) {
        console.log('Disposing of material:', object.material);
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  
    console.log('Disposing of renderer and mini-map renderer...');
    renderer.dispose();
    miniMapRenderer.dispose();
  }
  
  // Add event listener for cleanup on window unload
  window.addEventListener('unload', cleanup);
  
  // Initialize the game
  function initializeGame() {
    console.log('Initializing the game...');
    // Load the first maze and reset player position
    loadMaze1();
    resetPlayerPosition();
  }
  
  // Start the game loop
  function animate() {
    console.log('Starting the game loop...');
    requestAnimationFrame(animate);
  
    const delta = clock.getDelta();
  
    // Only update animations if character exists and is moving
    if (mixer && hasMoved) {
      console.log('Updating animations...');
      mixer.update(delta);
    }
  
    // Update game state
    if (!isGameOver && character) {
      console.log('Updating player movement and coin collection...');
      updatePlayerMovement();
      checkCoinCollection();
  
      if (checkExitCollision()) {
        console.log('Handling level transition...');
        handleLevelTransition();
      }
    }
  
    // Render scene
    console.log('Rendering the scene...');
    renderer.render(scene, camera);
    miniMapRenderer.render(scene, miniMapCamera);
  }
  
  // Start the animation loop
  console.log('Starting the animation loop...');
  animate();
  
  // Call the initialize function to set up the game
  console.log('Initializing the game...');
  initializeGame();