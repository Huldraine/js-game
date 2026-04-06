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

  const doorXTop = Math.floor(room.width / 2);
  const doorYSide = Math.floor(room.height / 2);

  if (nx < 0 && room.doors.left && ny === doorYSide) newRoomId = room.doors.left.id;
  else if (nx >= room.width && room.doors.right && ny === doorYSide)
    newRoomId = room.doors.right.id;
  else if (ny < 0 && room.doors.up && nx === doorXTop) newRoomId = room.doors.up.id;
  else if (ny >= room.height && room.doors.down && nx === doorXTop) newRoomId = room.doors.down.id;

  if (newRoomId) {
    const nextRoom = state.roomMap[newRoomId];
    const nextDoorXTop = Math.floor(nextRoom.width / 2);
    const nextDoorYSide = Math.floor(nextRoom.height / 2);

    state.currentRoomId = newRoomId;
    state.discoveredRooms.add(newRoomId);

    if (nx < 0) {
      state.player.x = nextRoom.width - 1;
      state.player.y = nextDoorYSide;
    } else if (nx >= room.width) {
      state.player.x = 0;
      state.player.y = nextDoorYSide;
    } else if (ny < 0) {
      state.player.x = nextDoorXTop;
      state.player.y = nextRoom.height - 1;
    } else if (ny >= room.height) {
      state.player.x = nextDoorXTop;
      state.player.y = 0;
    }

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
