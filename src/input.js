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
