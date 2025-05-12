let scene, camera, renderer, cube, previewBlock;
const keys = {};
let velocityY = 0;
let isJumping = false;
const gravity = -0.01;
let cameraAngle = 0;
let cameraElevation = 15 * Math.PI / 180;
let cameraRadius = 5;
let blockColorIndex = 1;
let placedBlocks = [];
let blockColors = [
  0xff0000, 0xffa500, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0x800080, 0xffffff, 0x888888
];
let blockDistance = 1;
let blockHeightOffset = 0;
let placingActive = false;
let drawingUIVisible = false;
let drawCanvas, drawCtx, cubeTexture;
let controlsMenu;

init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Setup drawing canvas for texture
  drawCanvas = document.createElement('canvas');
  drawCanvas.width = 256;
  drawCanvas.height = 256;
  drawCtx = drawCanvas.getContext('2d');
  drawCtx.fillStyle = '#cccccc';
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

  // Create cube texture from the canvas
  cubeTexture = new THREE.CanvasTexture(drawCanvas);
  const cubeMaterial = new THREE.MeshBasicMaterial({ map: cubeTexture });

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  cube = new THREE.Mesh(geometry, cubeMaterial);
  cube.position.y = 0.5;
  scene.add(cube);

  // Preview block (for previewing placement)
  const previewMaterial = new THREE.MeshBasicMaterial({ color: 0x063970, opacity: 0.5, transparent: true });
  previewBlock = new THREE.Mesh(geometry, previewMaterial);
  scene.add(previewBlock);

  // Wireframe ground
  const groundGeo = new THREE.PlaneGeometry(100, 100, 10, 10);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x555567, wireframe: true });
  const groundVisual = new THREE.Mesh(groundGeo, groundMat);
  groundVisual.rotation.x = -Math.PI / 2;
  scene.add(groundVisual);

  // Solid invisible ground for collision
  const groundSolidGeo = new THREE.BoxGeometry(100, 1, 100);
  const groundSolidMat = new THREE.MeshBasicMaterial({ visible: false });
  const groundSolid = new THREE.Mesh(groundSolidGeo, groundSolidMat);
  groundSolid.position.y = 0;
  groundSolid.userData.isPermanent = true;  // mark as permanent
  scene.add(groundSolid);
  placedBlocks.push(groundSolid); // Important: for collision

  // Event listener for keyboard input
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Enter') placingActive = true;
    if (e.code === 'KeyO') {
      drawingUIVisible = !drawingUIVisible;
      document.getElementById('drawUI').style.display = drawingUIVisible ? 'block' : 'none';
    }
    if (e.code === 'Digit0') {
      toggleControlsMenu();  // Show the controls menu when '0' is pressed
    }
  });

  document.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Enter') placingActive = false;
  });

  // Right-click to place blocks
  document.addEventListener('contextmenu', e => {
    e.preventDefault();
    placeBlock();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Create the controls menu (hidden by default)
  createControlsMenu();
}

function animate() {
  requestAnimationFrame(animate);

  const moveSpeed = 0.1;
  const turnSpeed = 0.03;

  if (keys['ArrowRight']) cameraAngle -= turnSpeed;
  if (keys['ArrowLeft']) cameraAngle += turnSpeed;
  cameraElevation = Math.max(0.1, Math.min(Math.PI / 2, cameraElevation + (keys['ArrowDown'] ? -turnSpeed : 0) + (keys['ArrowUp'] ? turnSpeed : 0)));

  if (keys['KeyQ']) cameraRadius -= 0.1;
  if (keys['KeyZ']) cameraRadius += 0.1;

  if (keys['KeyT']) blockDistance = Math.min(blockDistance + 0.1, 10);
  if (keys['KeyB']) blockDistance = Math.max(blockDistance - 0.1, 0.5);

  if (keys['KeyY']) blockHeightOffset = Math.min(blockHeightOffset + 0.1, 10);
  if (keys['KeyN']) blockHeightOffset = Math.max(blockHeightOffset - 0.1, -1);

  const forward = new THREE.Vector3(-Math.sin(cameraAngle), 0, -Math.cos(cameraAngle));
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

  let newPos = cube.position.clone();

  if (keys['KeyW']) newPos.add(forward.clone().multiplyScalar(moveSpeed));
  if (keys['KeyS']) newPos.add(forward.clone().multiplyScalar(-moveSpeed));
  if (keys['KeyA']) newPos.add(right.clone().multiplyScalar(moveSpeed));
  if (keys['KeyD']) newPos.add(right.clone().multiplyScalar(-moveSpeed));

  if (!collidesAt(newPos.x, cube.position.y, newPos.z)) {
    cube.position.x = newPos.x;
    cube.position.z = newPos.z;
  }

  velocityY += gravity;
  cube.position.y += velocityY;
  
  // Check for collision with blocks below
  let isOnGround = false;
  const cubeBox = new THREE.Box3().setFromObject(cube);
  
  for (const block of placedBlocks) {
    const blockBox = new THREE.Box3().setFromObject(block);
    if (cubeBox.intersectsBox(blockBox)) {
      cube.position.y = blockBox.max.y + 0.5;
      velocityY = 0;
      isJumping = false;
      isOnGround = true;
      break;
    }
  }
  
  if (!isOnGround) {
    isJumping = true;
  }

  if (keys['Space'] && !isJumping) {
    velocityY = 0.15;
    isJumping = true;
  }

  for (let i = 1; i <= 9; i++) {
    if (keys[`Digit${i}`]) {
      blockColorIndex = i;
      document.getElementById('selectedBlock').innerText = `Selected Block: ${i}`;
      keys[`Digit${i}`] = false;
    }
  }

  // Remove blocks (R key)
  if (keys['KeyR']) {
    if (keys['ShiftLeft'] || keys['ShiftRight']) {
      placedBlocks = placedBlocks.filter(b => {
        if (b.userData.isPermanent) return true;
        scene.remove(b);
        return false;
      });
    } else {
      for (let i = placedBlocks.length - 1; i >= 0; i--) {
        if (!placedBlocks[i].userData.isPermanent) {
          scene.remove(placedBlocks[i]);
          placedBlocks.splice(i, 1);
          break;
        }
      }
    }
    keys['KeyR'] = false;
  }

  if (placingActive) {
    placeBlock();
  }

  const previewOffset = forward.clone().multiplyScalar(blockDistance).setY(blockHeightOffset);
  previewBlock.position.copy(cube.position).add(previewOffset).setY(cube.position.y + blockHeightOffset);

  const camX = cube.position.x + cameraRadius * Math.sin(cameraAngle) * Math.cos(cameraElevation);
  const camY = cube.position.y + cameraRadius * Math.sin(cameraElevation) + 2;
  const camZ = cube.position.z + cameraRadius * Math.cos(cameraAngle) * Math.cos(cameraElevation);
  camera.position.set(camX, camY, camZ);
  camera.lookAt(cube.position);

  renderer.render(scene, camera);
}

function placeBlock() {
  const forward = new THREE.Vector3(-Math.sin(cameraAngle), 0, -Math.cos(cameraAngle));
  const placeOffset = forward.clone().multiplyScalar(blockDistance).setY(blockHeightOffset);
  const newBlock = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: blockColors[blockColorIndex - 1] })
  );
  newBlock.position.copy(cube.position).add(placeOffset).setY(cube.position.y + blockHeightOffset);
  scene.add(newBlock);
  placedBlocks.push(newBlock);
}

function collidesAt(x, y, z) {
  const half = 0.5;
  for (const block of placedBlocks) {
    const bp = block.position;
    if (Math.abs(x - bp.x) < 1 && Math.abs(y - bp.y) < 1 && Math.abs(z - bp.z) < 1) {
      return true;
    }
  }
  return false;
}

// Create the controls menu and append it to the DOM
function createControlsMenu() {
  controlsMenu = document.createElement('div');
  controlsMenu.style.position = 'absolute';
  controlsMenu.style.top = '20px';
  controlsMenu.style.left = '20px';
  controlsMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  controlsMenu.style.color = 'white';
  controlsMenu.style.padding = '10px';
  controlsMenu.style.display = 'none';
  controlsMenu.innerHTML = `
    <h2>Controls:</h2>
    <ul>
      <li><strong>WASD</strong>: Move</li>
      <li><strong>Arrow Keys</strong>: Turn & Adjust Elevation</li>
      <li><strong>Space</strong>: Jump</li>
      <li><strong>Q, Z</strong>: Zoom In/Out</li>
      <li><strong>T, B</strong>: Adjust Block Distance</li>
      <li><strong>Y, N</strong>: Adjust Block Height</li>
      <li><strong>R</strong>: Remove Blocks</li>
      <li><strong>1-9</strong>: Select Block Color</li>
      <li><strong>0</strong>: Toggle Controls Menu</li>
    </ul>
  `;
  document.body.appendChild(controlsMenu);
}

// Toggle visibility of the controls menu
function toggleControlsMenu() {
  controlsMenu.style.display = controlsMenu.style.display === 'none' ? 'block' : 'none';
}
