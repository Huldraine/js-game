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
