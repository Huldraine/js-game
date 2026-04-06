const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

const MAP_COLS = 48;
const MAP_ROWS = 28;
const TILE_WALL = 0;
const TILE_FLOOR = 1;
const TILE_TRAP = 2;
const HUD_HEIGHT = 60;

const COLORS = {
  dark: "#1f2230",
  wall: "#3f4350",
  door: "#5f7ea8",
  white: "#ffffff",
  gold: "#f4d96c",
  red: "#ff5b5b",
  pink: "#ff7092",
  purple: "#9c27b0",
  gray: "#65708a",
  blue: "#58b4ff",
  playerRed: "#ff5f6f",
  darkOverlay: "rgba(10, 12, 20, 0.86)",
  hudOverlay: "rgba(0,0,0,0.6)",
  miniOverlay: "rgba(4, 6, 12, 0.9)",
};

function fillRect(x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

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
  // Sprites desactives - rendu geometrique.
  return false;
}

const SPRITES = {};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
