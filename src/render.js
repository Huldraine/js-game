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
          fillRect(drawX, drawY, TILE, TILE, isDoor ? COLORS.door : COLORS.wall);
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
          fillRect(drawX, drawY, TILE, TILE, isFloor ? COLORS.dark : COLORS.wall);
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
    fillRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2, fallbackColor);
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
      enemy.isBoss ? COLORS.purple : COLORS.playerRed,
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

  fillRect(miniX, miniY, miniW, miniH, COLORS.miniOverlay);
  c.strokeStyle = "rgba(255, 255, 255, 0.12)";
  c.lineWidth = 1;
  c.strokeRect(miniX, miniY, miniW, miniH);

  const GRID_WIDTH = 6;
  const GRID_HEIGHT = 5;
  const padding = 12;
  const cellW = (miniW - padding * 2) / GRID_WIDTH;
  const cellH = (miniH - padding * 2) / GRID_HEIGHT;

  const miniRoomCenter = (room) => ({
    x: miniX + padding + room.gridX * cellW + cellW / 2,
    y: miniY + padding + room.gridY * cellH + cellH / 2,
  });

  const edgeKey = (a, b) =>
    a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  const drawnEdges = new Set();

  for (const room of state.rooms) {
    if (!state.discoveredRooms.has(room.id)) continue;

    const center = miniRoomCenter(room);
    for (const direction of ["up", "down", "left", "right"]) {
      const neighbor = room.doors[direction];
      if (!neighbor || !state.discoveredRooms.has(neighbor.id)) continue;
      const key = edgeKey(room, neighbor);
      if (drawnEdges.has(key)) continue;
      drawnEdges.add(key);

      const neighborCenter = miniRoomCenter(neighbor);
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

    fillRect(x, y, w, h, isCurrent ? "#fff3a3" : "#a8ffbf");
    c.strokeStyle = isCurrent ? "#ffffff" : "#6bd97f";
    c.lineWidth = isCurrent ? 2 : 1;
    c.strokeRect(x, y, w, h);
  }
}

function drawHud() {
  fillRect(0, 0, window.innerWidth, HUD_HEIGHT, COLORS.hudOverlay);
  c.fillStyle = COLORS.white;
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

  fillRect(
    80,
    80,
    window.innerWidth - 160,
    window.innerHeight - 160,
    COLORS.darkOverlay,
  );
  c.strokeStyle = COLORS.white;
  c.strokeRect(80, 80, window.innerWidth - 160, window.innerHeight - 160);

  c.fillStyle = COLORS.white;
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
    fillRect(90, 260, 460, 14, COLORS.gray);
    fillRect(skill.zoneX, 257, skill.zoneW, 20, COLORS.gold);
    fillRect(skill.markerX - 3, 252, 6, 30, COLORS.red);
    c.fillStyle = COLORS.white;
    c.fillText("Espace/Entree pour frapper", 110, 305);
  }

  if (state.phase === "battleDodge") {
    const dodge = state.battle.dodge;
    const box = { x: 130, y: 240, w: 460, h: 250 };
    c.strokeStyle = COLORS.white;
    c.strokeRect(box.x, box.y, box.w, box.h);
    c.fillStyle = COLORS.white;
    c.fillText(`Pattern: ${dodge.pattern.toUpperCase()}`, 110, 220);

    const sx = box.x + dodge.soul.x * box.w;
    const sy = box.y + dodge.soul.y * box.h;
    c.fillStyle = COLORS.pink;
    c.beginPath();
    c.arc(sx, sy, dodge.soul.size, 0, Math.PI * 2);
    c.fill();

    for (const p of dodge.projectiles) {
      c.fillStyle =
        p.mode === "white"
          ? COLORS.white
          : p.mode === "red"
            ? COLORS.red
            : COLORS.blue;
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
    c.fillStyle = COLORS.white;
    c.fillText("Blanc: toujours | Rouge: bouger | Bleu: immobile", 110, 520);
  }
}

function drawEndOverlay(text, subtext) {
  fillRect(0, 0, window.innerWidth, window.innerHeight, "rgba(0,0,0,0.72)");
  c.fillStyle = COLORS.white;
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
  fillRect(0, 0, window.innerWidth, window.innerHeight, "#0f1320");

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
