const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

const MAP_COLS = 48;
const MAP_ROWS = 28;
const TILE_WALL = 0;
const TILE_FLOOR = 1;
const TILE_TRAP = 2;
const HUD_HEIGHT = 60;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(window.innerWidth);
  const height = Math.floor(window.innerHeight);
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function drawSpriteImage(sprite, x, y, width, height) {
  // Sprites désactivés - retour au rendu géométrique
  return false;
}

const SPRITES = {};

const state = {
  phase: "explore",
  floor: 1,
  rooms: [],
  roomMap: {},
  currentRoomId: null,
  discoveredRooms: new Set(),
  enemies: [],
  battle: null,
  trap: null,
  keysDown: new Set(),
  lastTime: 0,
  player: {
    x: 1,
    y: 1,
    hp: 24,
    maxHp: 24,
    items: 3,
    bonusDamage: 0,
  },
};

function saveGame() {
  const save = {
    floor: state.floor,
    hp: state.player.hp,
    items: state.player.items,
    bonusDamage: state.player.bonusDamage,
  };
  localStorage.setItem("js-dungeon-save", JSON.stringify(save));
}

function loadGame() {
  const saved = localStorage.getItem("js-dungeon-save");
  if (!saved) return;
  const data = JSON.parse(saved);
  state.floor = data.floor || 1;
  state.player.hp = data.hp || 24;
  state.player.items = data.items || 3;
  state.player.bonusDamage = data.bonusDamage || 0;
}

function generateRoomId(x, y) {
  return `${x},${y}`;
}

function getRoomId(room) {
  return generateRoomId(room.gridX, room.gridY);
}

function createRoomGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(TILE_WALL));
}

function carveRoomIntoGrid(grid, offsetX, offsetY, width, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      grid[y][x] = TILE_FLOOR;
    }
  }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS;
}

function createGrid(fill) {
  return Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(fill));
}

function roomCenter(room) {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

function carveRoom(grid, room) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      if (inBounds(x, y)) grid[y][x] = TILE_FLOOR;
    }
  }
}

function roomsOverlap(a, b, margin = 1) {
  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
}

function carveHCorridor(grid, x1, x2, y) {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2);
  for (let x = start; x <= end; x += 1) {
    if (inBounds(x, y)) grid[y][x] = TILE_FLOOR;
  }
}

function carveVCorridor(grid, y1, y2, x) {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2);
  for (let y = start; y <= end; y += 1) {
    if (inBounds(x, y)) grid[y][x] = TILE_FLOOR;
  }
}

function connectRooms(grid, a, b) {
  const ca = roomCenter(a);
  const cb = roomCenter(b);
  if (Math.random() < 0.5) {
    carveHCorridor(grid, ca.x, cb.x, ca.y);
    carveVCorridor(grid, ca.y, cb.y, cb.x);
  } else {
    carveVCorridor(grid, ca.y, cb.y, ca.x);
    carveHCorridor(grid, ca.x, cb.x, cb.y);
  }
}

function generateDungeon() {
  const gridRooms = [];
  const roomObjects = {};
  const targetRooms = randInt(12, 18);
  const GRID_WIDTH = 6;
  const GRID_HEIGHT = 5;

  for (
    let tries = 0;
    tries < 500 && gridRooms.length < targetRooms;
    tries += 1
  ) {
    const gridX = randInt(0, GRID_WIDTH - 1);
    const gridY = randInt(0, GRID_HEIGHT - 1);
    const id = generateRoomId(gridX, gridY);
    if (roomObjects[id]) continue;

    const room = {
      gridX,
      gridY,
      id,
      width: randInt(5, 10),
      height: randInt(4, 8),
      grid: null,
      doors: { up: null, down: null, left: null, right: null },
    };
    room.grid = createRoomGrid(room.width, room.height);
    carveRoomIntoGrid(room.grid, 0, 0, room.width, room.height);
    gridRooms.push(room);
    roomObjects[id] = room;
  }

  if (gridRooms.length === 0) {
    const room = {
      gridX: 0,
      gridY: 0,
      id: "0,0",
      width: 8,
      height: 6,
      grid: null,
      doors: { up: null, down: null, left: null, right: null },
    };
    room.grid = createRoomGrid(room.width, room.height);
    carveRoomIntoGrid(room.grid, 0, 0, room.width, room.height);
    gridRooms.push(room);
    roomObjects[room.id] = room;
  }

  const linked = [gridRooms[0]];
  const unlinked = gridRooms.slice(1);
  while (unlinked.length) {
    let bestA = null;
    let bestB = null;
    let bestDist = Infinity;
    for (const a of linked) {
      for (const b of unlinked) {
        const dist = Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY);
        if (dist < bestDist) {
          bestDist = dist;
          bestA = a;
          bestB = b;
        }
      }
    }

    if (bestB.gridX < bestA.gridX) {
      bestA.doors.left = bestB;
      bestB.doors.right = bestA;
    } else if (bestB.gridX > bestA.gridX) {
      bestA.doors.right = bestB;
      bestB.doors.left = bestA;
    } else if (bestB.gridY < bestA.gridY) {
      bestA.doors.up = bestB;
      bestB.doors.down = bestA;
    } else {
      bestA.doors.down = bestB;
      bestB.doors.up = bestA;
    }

    linked.push(bestB);
    unlinked.splice(unlinked.indexOf(bestB), 1);
  }

  return gridRooms;
}

function getRoomTiles(room) {
  const tiles = [];
  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      if (room.grid[y] && room.grid[y][x] === TILE_FLOOR) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

function findEnemyAt(x, y) {
  return state.enemies.find(
    (enemy) =>
      enemy.x === x && enemy.y === y && enemy.roomId === state.currentRoomId,
  );
}

function pickEnemyPattern() {
  if (state.floor < 4) {
    // return ["pipe"][randInt(0, 1)];
    // return ["enfer"][randInt(0, 1)];
    return ["line", "line", "rain", "burst", "pipe"][randInt(0, 4)];
  }
  if (state.floor < 8) {
    return ["line", "rain", "burst", "pipe", "enfer"][randInt(0, 4)];
  }
  return ["rain", "burst", "line", "spiral", "pipe"][randInt(0, 4)];
}
function pickBossPattern() {
  return ["spiral", "enfer"][randInt(0, 1)];
}

const sounds = {};
function playSound(src, loop = false) {
  if (!sounds[src]) {
    sounds[src] = new Audio(src);
    sounds[src].loop = loop;
  }
  sounds[src].currentTime = 0;
  sounds[src].play().catch(() => {});
}

function resetFloor() {
  if (state.floor > 1) {
    if (Math.random() < 0.5) {
      state.player.maxHp += 2;
    } else {
      state.player.bonusDamage += 1;
    }
  }
  const roomList = generateDungeon();
  state.rooms = roomList;
  state.roomMap = {};
  state.discoveredRooms = new Set();
  state.enemies = [];
  state.battle = null;
  state.trap = null;
  state.phase = "explore";

  playSound("musique de fond.mp3");

  for (const room of roomList) {
    state.roomMap[room.id] = room;
  }

  const startRoom = roomList[0];
  state.currentRoomId = startRoom.id;
  state.discoveredRooms.add(state.currentRoomId);
  state.player.x = Math.floor(startRoom.width / 2);
  state.player.y = Math.floor(startRoom.height / 2);
  state.player.hp = clamp(state.player.hp + 2, 0, state.player.maxHp);

  const occupied = new Set([`${state.player.x},${state.player.y}`]);
  const nonStartRooms = roomList.slice(1);

  for (const room of nonStartRooms) {
    const roomTiles = getRoomTiles(room).filter(
      (tile) => !occupied.has(`${tile.x},${tile.y}`),
    );
    if (!roomTiles.length) continue;
    const mobCount = room.width * room.height >= 42 ? 2 : 1;
    for (let i = 0; i < mobCount; i += 1) {
      const options = roomTiles.filter(
        (tile) => !occupied.has(`${tile.x},${tile.y}`),
      );
      if (!options.length) break;
      const p = options[randInt(0, options.length - 1)];
      occupied.add(`${p.x},${p.y}`);
      state.enemies.push({
        x: p.x,
        y: p.y,
        roomId: room.id,
        hp: 15 + Math.floor(state.floor * 0.8),
        maxHp: 15 + Math.floor(state.floor * 0.8),
        pattern: pickEnemyPattern(),
        isBoss: false,
      });
    }
  }

  if (nonStartRooms.length) {
    const farRoom = nonStartRooms[nonStartRooms.length - 1];
    const tiles = getRoomTiles(farRoom).filter(
      (tile) => !occupied.has(`${tile.x},${tile.y}`),
    );
    if (tiles.length) {
      const p = tiles[randInt(0, tiles.length - 1)];
      occupied.add(`${p.x},${p.y}`);
      state.enemies.push({
        x: p.x,
        y: p.y,
        roomId: farRoom.id,
        hp: 24 + state.floor * 2,
        maxHp: 24 + state.floor * 2,
        pattern: pickBossPattern(),
        isBoss: true,
      });
    }
  }
}

function getCurrentRoom() {
  return state.roomMap[state.currentRoomId] || null;
}

function canWalk(x, y) {
  const room = getCurrentRoom();
  if (!room) return false;
  return (
    x >= 0 &&
    y >= 0 &&
    x < room.width &&
    y < room.height &&
    room.grid[y][x] === TILE_FLOOR
  );
}

function enemyStepTowardPlayer(enemy, occupied) {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 0, y: 0 },
  ];
  let best = { x: enemy.x, y: enemy.y };
  let bestScore = Infinity;
  for (const dir of dirs) {
    const nx = enemy.x + dir.x;
    const ny = enemy.y + dir.y;
    if (!canWalk(nx, ny)) continue;
    if (occupied.has(`${nx},${ny}`)) continue;
    const score = Math.abs(nx - state.player.x) + Math.abs(ny - state.player.y);
    if (score < bestScore || (score === bestScore && Math.random() < 0.35)) {
      bestScore = score;
      best = { x: nx, y: ny };
    }
  }
  enemy.x = best.x;
  enemy.y = best.y;
}

function processEnemyMapTurn() {
  const roomEnemies = state.enemies.filter(
    (e) => e.roomId === state.currentRoomId,
  );
  const occupied = new Set(roomEnemies.map((e) => `${e.x},${e.y}`));
  occupied.add(`${state.player.x},${state.player.y}`);

  for (const enemy of roomEnemies) {
    occupied.delete(`${enemy.x},${enemy.y}`);
    enemyStepTowardPlayer(enemy, occupied);
    if (
      Math.abs(enemy.x - state.player.x) +
        Math.abs(enemy.y - state.player.y) ===
      1
    ) {
      startBattle(enemy);
      return;
    }
    occupied.add(`${enemy.x},${enemy.y}`);
  }
}

function tryMovePlayer(dx, dy) {
  const room = getCurrentRoom();
  if (!room) return;

  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  let newRoomId = null;

  if (nx < 0 && room.doors.left) newRoomId = room.doors.left.id;
  else if (nx >= room.width && room.doors.right)
    newRoomId = room.doors.right.id;
  else if (ny < 0 && room.doors.up) newRoomId = room.doors.up.id;
  else if (ny >= room.height && room.doors.down) newRoomId = room.doors.down.id;

  if (newRoomId) {
    state.currentRoomId = newRoomId;
    state.discoveredRooms.add(newRoomId);
    if (nx < 0) state.player.x = state.roomMap[newRoomId].width - 1;
    else if (nx >= room.width) state.player.x = 0;
    else if (ny < 0) state.player.y = state.roomMap[newRoomId].height - 1;
    else if (ny >= room.height) state.player.y = 0;
    processEnemyMapTurn();
    return;
  }

  if (!canWalk(nx, ny)) return;

  if (state.trap && nx === state.trap.x && ny === state.trap.y) {
    state.floor += 1;
    state.player.items += 1;
    state.player.hp = clamp(state.player.hp + 2, 0, state.player.maxHp);
    saveGame();
    resetFloor();
    return;
  }

  const enemy = findEnemyAt(nx, ny);
  if (enemy) {
    startBattle(enemy);
    return;
  }

  state.player.x = nx;
  state.player.y = ny;
  processEnemyMapTurn();
}

function startBattle(enemy) {
  state.phase = "battleChoice";
  state.battle = {
    enemy,
    message: "Choisis: [A] Attack / [I] Item",
    skill: {
      markerX: 90,
      speed: 360,
      dir: 1,
      zoneX: randInt(180, 430),
      zoneW: 62,
    },
    dodge: {
      timer: 0,
      duration: Math.max(2.4, 3.9 - Math.floor(state.floor / 3) * 0.15),
      soul: { x: 0.5, y: 0.75, size: 9 },
      projectiles: [],
      spawnTimer: 0,
      pattern: enemy.pattern,
      movedThisFrame: false,
      iFrame: 0,
      speed: Math.min(1.05, 0.75 + state.floor * 0.015),
      speedMult: Math.min(2.0, 1 + state.floor * 0.05),
    },
  };
}

function removeEnemy(enemyRef) {
  state.enemies = state.enemies.filter((enemy) => enemy !== enemyRef);
}

function spawnTrap() {
  if (!state.rooms.length) return;
  const farRoom = state.rooms[state.rooms.length - 1];
  const tiles = getRoomTiles(farRoom);
  if (tiles.length) {
    const p = tiles[Math.floor(Math.random() * tiles.length)];
    state.trap = { x: p.x, y: p.y, roomId: farRoom.id };
  }
}

function resolveEnemyDefeat(enemy) {
  removeEnemy(enemy);
  state.battle = null;
  if (enemy.isBoss) {
    spawnTrap();
    state.phase = "explore";
    return;
  }
  state.phase = "explore";
}

function resolveSkillCheck() {
  const skill = state.battle.skill;
  const center = skill.zoneX + skill.zoneW / 2;
  const distance = Math.abs(skill.markerX - center);
  const ratio = clamp(1 - distance / 260, 0.08, 1);
  const damage = Math.round(3 + ratio * 7 + state.player.bonusDamage);

  state.battle.enemy.hp -= damage;
  if (state.battle.enemy.hp <= 0) {
    resolveEnemyDefeat(state.battle.enemy);
    return;
  }

  startEnemyDodge();
}

function startEnemyDodge() {
  const dodge = state.battle.dodge;
  dodge.timer = 0;
  dodge.spawnTimer = 0;
  dodge.projectiles = [];
  dodge.iFrame = 0;
  dodge.pipeZone = null;
  dodge.soul.x = 0.5;
  dodge.soul.y = 0.75;
  if (!dodge.pattern) dodge.pattern = "line";
  state.phase = "battleDodge";
  state.battle.message = `Tour ennemi: pattern ${dodge.pattern}`;
}

function useItem() {
  if (state.player.items <= 0) {
    state.battle.message = "Aucun objet.";
    return;
  }
  state.player.items -= 1;
  state.player.hp = clamp(state.player.hp + 7, 0, state.player.maxHp);
  startEnemyDodge();
}

function spawnProjectile(mode, x, y, vx, vy, radius = 0.018) {
  state.battle.dodge.projectiles.push({ x, y, vx, vy, radius, mode });
}

function randomMode() {
  const modes = ["white", "red", "blue"];
  return modes[randInt(0, modes.length - 1)];
}

function spawnPatternProjectiles() {
  const dodge = state.battle.dodge;
  const speedMult = dodge.speedMult;
  const pattern = dodge.pattern;

  if (pattern === "line") {
    const left = Math.random() < 0.5;
    const y = clamp(dodge.soul.y + (Math.random() - 0.5) * 0.35, 0.05, 0.95);
    const speed = (0.5 + Math.random() * 0.35) * speedMult;
    spawnProjectile(randomMode(), left ? 0 : 1, y, left ? speed : -speed, 0);
    return;
  }

  if (pattern === "rain") {
    for (let i = 0; i < 2; i += 1) {
      const x = Math.random();
      const vy = (0.52 + Math.random() * 0.38) * speedMult;
      const vx = (Math.random() - 0.5) * 0.08 * speedMult;
      spawnProjectile(randomMode(), x, 0, vx, vy);
    }
    return;
  }

  if (pattern === "burst") {
    const count = 6;
    const cx = Math.random() < 0.5 ? 0.16 : 0.84;
    const cy = 0.12 + Math.random() * 0.76;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = (0.34 + Math.random() * 0.2) * speedMult;
      spawnProjectile(
        randomMode(),
        cx,
        cy,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      );
    }
    return;
  }

  if (pattern === "pipe") {
    if (!dodge.pipeZone) {
      if (Math.random() < 0.5) {
        dodge.pipeZone = [0.1, 0.9]; // gauche et droite
      } else {
        dodge.pipeZone = [0.5]; // centre
      }
    }

    for (const col of dodge.pipeZone) {
      for (let i = 0; i < 2; i += 1) {
        const x = col + (Math.random() - 0.5) * 0.3;
        const vy = (0.52 + Math.random() * 0.38) * speedMult;
        const vx = (Math.random() - 0.5) * 0.02;
        spawnProjectile("white", x, 0, vx, vy);
      }
    }
    return;
  }

  if (pattern === "enfer") {
    const count = 25;
    const cx = 0.5;
    const cy = 0.5;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 0.45 * speedMult;
      spawnProjectile(
        randomMode(),
        cx,
        cy,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.02,
      );
    }
    return;
  }
  if (pattern === "spiral") {
    const arms = 3;
    const rot = dodge.timer * 5;
    for (let i = 0; i < arms; i += 1) {
      const angle = rot + (Math.PI * 2 * i) / arms;
      const speed = 0.45 * speedMult;
      spawnProjectile(
        randomMode(),
        0.5,
        0.5,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.02,
      );
    }
    return;
  }

  const arms = 3;
  const rot = dodge.timer * 5;
  for (let i = 0; i < arms; i += 1) {
    const angle = rot + (Math.PI * 2 * i) / arms;
    const speed = 0.45 * speedMult;
    spawnProjectile(
      randomMode(),
      0.5,
      0.5,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      0.02,
    );
  }
}

function updateSkillCheck(dt) {
  const skill = state.battle.skill;
  skill.markerX += skill.speed * skill.dir * dt;
  if (skill.markerX > 540) {
    skill.markerX = 540;
    skill.dir = -1;
  }
  if (skill.markerX < 90) {
    skill.markerX = 90;
    skill.dir = 1;
  }
}

function updateEnemyDodge(dt) {
  const dodge = state.battle.dodge;
  dodge.timer += dt;
  dodge.spawnTimer += dt;
  dodge.iFrame = Math.max(0, dodge.iFrame - dt);
  dodge.movedThisFrame = false;

  let dx = 0;
  let dy = 0;
  if (state.keysDown.has("arrowleft") || state.keysDown.has("q"))
    dx -= dodge.speed * dt;
  if (state.keysDown.has("arrowright") || state.keysDown.has("d"))
    dx += dodge.speed * dt;
  if (state.keysDown.has("arrowup") || state.keysDown.has("z"))
    dy -= dodge.speed * dt;
  if (state.keysDown.has("arrowdown") || state.keysDown.has("s"))
    dy += dodge.speed * dt;
  if (Math.abs(dx) > 0 || Math.abs(dy) > 0) dodge.movedThisFrame = true;

  dodge.soul.x = clamp(dodge.soul.x + dx, 0.05, 0.95);
  dodge.soul.y = clamp(dodge.soul.y + dy, 0.1, 0.95);

  const baseSpawnRate =
    dodge.pattern === "rain"
      ? 0.22
      : dodge.pattern === "burst"
        ? 0.78
        : dodge.pattern === "spiral"
          ? 0.2
          : dodge.pattern === "pipe"
            ? 0.00000001
            : dodge.pattern === "enfer"
              ? 0.35
              : 0.33;
  if (dodge.spawnTimer > baseSpawnRate / dodge.speedMult) {
    dodge.spawnTimer = 0;
    spawnPatternProjectiles();
  }

  dodge.projectiles = dodge.projectiles.filter((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return p.x > -0.2 && p.x < 1.2 && p.y > -0.2 && p.y < 1.2;
  });

  for (const p of dodge.projectiles) {
    const dist = Math.hypot(p.x - dodge.soul.x, p.y - dodge.soul.y);
    if (dist >= p.radius + dodge.soul.size / 600 || dodge.iFrame > 0) continue;
    const hurtsWhite = p.mode === "white";
    const hurtsRed = p.mode === "red" && dodge.movedThisFrame;
    const hurtsBlue = p.mode === "blue" && !dodge.movedThisFrame;
    if (hurtsWhite || hurtsRed || hurtsBlue) {
      state.player.hp -= 2;
      dodge.iFrame = 0.42;
      if (state.player.hp <= 0) {
        state.phase = "gameOver";
        state.battle = null;
        return;
      }
    }
  }

  if (dodge.timer >= dodge.duration) {
    state.phase = "battleChoice";
    state.battle.message = "Ton tour: [A] Attack / [I] Item";
  }
}

function drawMap() {
  const room = getCurrentRoom();
  if (!room) return;

  const availableWidth = Math.max(200, window.innerWidth - 190);
  const availableHeight = Math.max(200, window.innerHeight - HUD_HEIGHT - 24);
  const roomDisplayWidth = room.width + 2;
  const roomDisplayHeight = room.height + 2;
  const TILE = Math.max(
    1,
    Math.floor(
      Math.min(
        availableWidth / roomDisplayWidth,
        availableHeight / roomDisplayHeight,
      ),
    ),
  );
  const OFFSET_X = Math.floor((availableWidth - roomDisplayWidth * TILE) / 2);
  const OFFSET_Y =
    HUD_HEIGHT + Math.floor((availableHeight - roomDisplayHeight * TILE) / 2);
  const INNER_X = OFFSET_X + TILE;
  const INNER_Y = OFFSET_Y + TILE;

  for (let y = 0; y < roomDisplayHeight; y += 1) {
    for (let x = 0; x < roomDisplayWidth; x += 1) {
      const drawX = OFFSET_X + x * TILE;
      const drawY = OFFSET_Y + y * TILE;
      const isBorder =
        x === 0 ||
        y === 0 ||
        x === roomDisplayWidth - 1 ||
        y === roomDisplayHeight - 1;

      if (isBorder) {
        const topDoorX = 1 + Math.floor(room.width / 2);
        const sideDoorY = 1 + Math.floor(room.height / 2);
        const isDoor =
          (y === 0 && room.doors.up && x === topDoorX) ||
          (y === roomDisplayHeight - 1 && room.doors.down && x === topDoorX) ||
          (x === 0 && room.doors.left && y === sideDoorY) ||
          (x === roomDisplayWidth - 1 && room.doors.right && y === sideDoorY);
        let borderSprite = SPRITES.roomWallTop;
        if (x === 0 && y === 0) borderSprite = SPRITES.roomCornerTopLeft;
        else if (x === roomDisplayWidth - 1 && y === 0)
          borderSprite = SPRITES.roomCornerTopRight;
        else if (x === 0 && y === roomDisplayHeight - 1)
          borderSprite = SPRITES.roomCornerBottomLeft;
        else if (x === roomDisplayWidth - 1 && y === roomDisplayHeight - 1) {
          borderSprite = SPRITES.roomCornerBottomRight;
        } else if (y === 0) borderSprite = SPRITES.roomWallTop;
        else if (y === roomDisplayHeight - 1)
          borderSprite = SPRITES.roomWallBottom;
        else if (x === 0) borderSprite = SPRITES.roomWallLeft;
        else borderSprite = SPRITES.roomWallRight;

        if (
          !drawSpriteImage(
            isDoor ? SPRITES.roomDoor : borderSprite,
            drawX,
            drawY,
            TILE,
            TILE,
          )
        ) {
          c.fillStyle = isDoor ? "#5f7ea8" : "#3f4350";
          c.fillRect(drawX, drawY, TILE, TILE);
        }
      } else {
        const rx = x - 1;
        const ry = y - 1;
        const isFloor = room.grid[ry] && room.grid[ry][rx] === TILE_FLOOR;
        if (
          !drawSpriteImage(
            isFloor ? SPRITES.roomFloor : SPRITES.roomWallTop,
            drawX,
            drawY,
            TILE,
            TILE,
          )
        ) {
          c.fillStyle = isFloor ? "#1f2230" : "#3f4350";
          c.fillRect(drawX, drawY, TILE, TILE);
        }
      }
    }
  }

  window.currentRoomDisplay = { room, TILE, INNER_X, INNER_Y };
}

function drawEntities() {
  const display = window.currentRoomDisplay;
  if (!display) return;
  const { TILE, INNER_X, INNER_Y } = display;

  const drawActor = (sprite, x, y, fallbackColor, inset) => {
    if (drawSpriteImage(sprite, x, y, TILE, TILE)) return;
    c.fillStyle = fallbackColor;
    c.fillRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2);
  };

  drawActor(
    SPRITES.player,
    INNER_X + state.player.x * TILE,
    INNER_Y + state.player.y * TILE,
    "#5ce38f",
    3,
  );

  const roomEnemies = state.enemies.filter(
    (e) => e.roomId === state.currentRoomId,
  );
  for (const enemy of roomEnemies) {
    drawActor(
      enemy.isBoss ? SPRITES.boss : SPRITES.enemy,
      INNER_X + enemy.x * TILE,
      INNER_Y + enemy.y * TILE,
      enemy.isBoss ? "#ff1744" : "#ff5f6f",
      4,
    );
  }

  if (state.trap && state.trap.roomId === state.currentRoomId) {
    drawActor(
      SPRITES.trap,
      INNER_X + state.trap.x * TILE,
      INNER_Y + state.trap.y * TILE,
      "#ffd700",
      2,
    );
  }
}

function drawMiniMap() {
  const miniX = window.innerWidth - 150;
  const miniY = 70;
  const miniW = 140;
  const miniH = 140;

  c.fillStyle = "rgba(4, 6, 12, 0.9)";
  c.fillRect(miniX, miniY, miniW, miniH);
  c.strokeStyle = "rgba(255, 255, 255, 0.12)";
  c.lineWidth = 1;
  c.strokeRect(miniX, miniY, miniW, miniH);

  const GRID_WIDTH = 6;
  const GRID_HEIGHT = 5;
  const padding = 12;
  const cellW = (miniW - padding * 2) / GRID_WIDTH;
  const cellH = (miniH - padding * 2) / GRID_HEIGHT;

  const roomCenter = (room) => ({
    x: miniX + padding + room.gridX * cellW + cellW / 2,
    y: miniY + padding + room.gridY * cellH + cellH / 2,
  });

  const edgeKey = (a, b) =>
    a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  const drawnEdges = new Set();

  for (const room of state.rooms) {
    if (!state.discoveredRooms.has(room.id)) continue;

    const center = roomCenter(room);
    for (const direction of ["up", "down", "left", "right"]) {
      const neighbor = room.doors[direction];
      if (!neighbor || !state.discoveredRooms.has(neighbor.id)) continue;
      const key = edgeKey(room, neighbor);
      if (drawnEdges.has(key)) continue;
      drawnEdges.add(key);

      const neighborCenter = roomCenter(neighbor);
      c.strokeStyle =
        neighbor.id === state.currentRoomId || room.id === state.currentRoomId
          ? "rgba(255, 235, 120, 0.95)"
          : "rgba(140, 255, 140, 0.6)";
      c.lineWidth =
        neighbor.id === state.currentRoomId || room.id === state.currentRoomId
          ? 3
          : 2;
      c.beginPath();
      c.moveTo(center.x, center.y);
      c.lineTo(neighborCenter.x, neighborCenter.y);
      c.stroke();
    }
  }

  for (const room of state.rooms) {
    if (!state.discoveredRooms.has(room.id)) continue;

    const isCurrent = room.id === state.currentRoomId;
    const x = miniX + padding + room.gridX * cellW + 3;
    const y = miniY + padding + room.gridY * cellH + 3;
    const w = cellW - 6;
    const h = cellH - 6;

    c.fillStyle = isCurrent ? "#fff3a3" : "#a8ffbf";
    c.fillRect(x, y, w, h);
    c.strokeStyle = isCurrent ? "#ffffff" : "#6bd97f";
    c.lineWidth = isCurrent ? 2 : 1;
    c.strokeRect(x, y, w, h);
  }
}

function drawHud() {
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(0, 0, window.innerWidth, HUD_HEIGHT);
  c.fillStyle = "#ffffff";
  c.font = "16px monospace";
  c.fillText(`HP ${state.player.hp}/${state.player.maxHp}`, 12, 24);
  c.fillText(`Potions ${state.player.items}`, 12, 46);
  c.fillText(`Etage ${state.floor}`, 210, 24);
  const roomEnemyCount = state.enemies.filter(
    (e) => e.roomId === state.currentRoomId,
  ).length;
  c.fillText(`Ennemis salle ${roomEnemyCount}`, 210, 46);
  if (state.phase === "explore")
    c.fillText("ZQSD/Fleches: deplacement", 370, 24);
  if (state.phase === "explore" && state.trap)
    c.fillText("Trappe: contact avec circle jaune", 370, 46);
  if (state.phase === "explore" && !state.trap)
    c.fillText("Bat le boss pour delocker la trappe", 370, 46);
}

function drawBattle() {
  if (!state.battle) return;

  c.fillStyle = "rgba(10, 12, 20, 0.86)";
  c.fillRect(80, 80, window.innerWidth - 160, window.innerHeight - 160);
  c.strokeStyle = "#ffffff";
  c.strokeRect(80, 80, window.innerWidth - 160, window.innerHeight - 160);

  c.fillStyle = "#ffffff";
  c.font = "18px monospace";
  c.fillText(`Player HP: ${state.player.hp}/${state.player.maxHp}`, 110, 120);
  c.fillText(
    `Enemy HP: ${state.battle.enemy.hp}/${state.battle.enemy.maxHp}`,
    110,
    148,
  );
  c.fillText(state.battle.message, 110, 180);

  if (state.phase === "battleChoice") {
    c.fillText("[A] Attack", 110, 220);
    c.fillText("[I] Item (+7 HP)", 270, 220);
  }

  if (state.phase === "battleSkill") {
    const skill = state.battle.skill;
    c.fillStyle = "#65708a";
    c.fillRect(90, 260, 460, 14);
    c.fillStyle = "#f4d96c";
    c.fillRect(skill.zoneX, 257, skill.zoneW, 20);
    c.fillStyle = "#ff5b5b";
    c.fillRect(skill.markerX - 3, 252, 6, 30);
    c.fillStyle = "#ffffff";
    c.fillText("Espace/Entree pour frapper", 110, 305);
  }

  if (state.phase === "battleDodge") {
    const dodge = state.battle.dodge;
    const box = { x: 130, y: 240, w: 460, h: 250 };
    c.strokeStyle = "#ffffff";
    c.strokeRect(box.x, box.y, box.w, box.h);
    c.fillStyle = "#ffffff";
    c.fillText(`Pattern: ${dodge.pattern.toUpperCase()}`, 110, 220);

    const sx = box.x + dodge.soul.x * box.w;
    const sy = box.y + dodge.soul.y * box.h;
    c.fillStyle = "#ff7092";
    c.beginPath();
    c.arc(sx, sy, dodge.soul.size, 0, Math.PI * 2);
    c.fill();

    for (const p of dodge.projectiles) {
      c.fillStyle =
        p.mode === "white"
          ? "#ffffff"
          : p.mode === "orange"
            ? "#ff8f34"
            : "#58b4ff";
      c.beginPath();
      c.arc(
        box.x + p.x * box.w,
        box.y + p.y * box.h,
        p.radius * box.w,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.fillStyle = "#ffffff";
    c.fillText("Blanc: toujours | Orange: bouger | Bleu: immobile", 110, 520);
  }
}

function drawEndOverlay(text, subtext) {
  c.fillStyle = "rgba(0,0,0,0.72)";
  c.fillRect(0, 0, window.innerWidth, window.innerHeight);
  c.fillStyle = "#ffffff";
  c.font = "36px monospace";
  c.fillText(
    text,
    Math.floor(window.innerWidth * 0.33),
    Math.floor(window.innerHeight * 0.45),
  );
  c.font = "20px monospace";
  c.fillText(
    subtext,
    Math.floor(window.innerWidth * 0.28),
    Math.floor(window.innerHeight * 0.52),
  );
}

function render() {
  c.fillStyle = "#0f1320";
  c.fillRect(0, 0, window.innerWidth, window.innerHeight);

  drawMap();
  drawEntities();
  drawHud();
  drawMiniMap();

  if (
    state.phase === "battleChoice" ||
    state.phase === "battleSkill" ||
    state.phase === "battleDodge"
  ) {
    drawBattle();
  }
  if (state.phase === "gameOver") {
    drawEndOverlay("Game Over", "Appuie sur R pour recommencer");
  }
}

function handleExploreInput(key) {
  if (key === "z" || key === "arrowup") tryMovePlayer(0, -1);
  if (key === "s" || key === "arrowdown") tryMovePlayer(0, 1);
  if (key === "q" || key === "arrowleft") tryMovePlayer(-1, 0);
  if (key === "d" || key === "arrowright") tryMovePlayer(1, 0);
}

function handleBattleInput(key) {
  if (!state.battle) return;
  if (state.phase === "battleChoice") {
    if (key === "a") {
      state.phase = "battleSkill";
      state.battle.skill.markerX = 90;
      state.battle.skill.dir = 1;
      state.battle.skill.zoneX = randInt(180, 430);
      state.battle.message = "Stoppe la barre dans la zone";
    }
    if (key === "i") useItem();
    return;
  }
  if (state.phase === "battleSkill" && (key === " " || key === "enter")) {
    resolveSkillCheck();
  }
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  state.keysDown.add(key);

  if (state.phase === "gameOver") {
    if (key === "r") {
      state.floor = 1;
      state.player.hp = state.player.maxHp;
      state.player.items = 3;
      state.player.bonusDamage = 0;
      localStorage.removeItem("js-dungeon-save");
      resetFloor();
    }
    return;
  }

  if (state.phase === "explore") {
    handleExploreInput(key);
  } else {
    handleBattleInput(key);
  }
});

document.addEventListener("keyup", (event) => {
  state.keysDown.delete(event.key.toLowerCase());
});

function update(dt) {
  if (state.phase === "battleSkill") updateSkillCheck(dt);
  if (state.phase === "battleDodge") updateEnemyDodge(dt);
}

function gameLoop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.033);
  state.lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

loadGame();
resetFloor();
requestAnimationFrame(gameLoop);
