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
        dodge.pipeZone = [0.1, 0.9];
      } else {
        dodge.pipeZone = [0.5];
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
