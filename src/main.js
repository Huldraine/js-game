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
