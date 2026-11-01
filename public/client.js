const socket = io();
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const peopleCount = document.getElementById("peopleCount");
const messages = document.getElementById("messages");
const nameInput = document.getElementById("playerName");
const chatInput = document.getElementById("chatInput");

let selfId = null;
let world = { width: 1800, height: 1200 };
let gameScene = null;
const sprites = new Map();
const playerData = new Map();
let lastSent = 0;

function addMessage(name, text, system = false) {
  const div = document.createElement("div");
  div.className = system ? "system-message" : "message";
  if (system) div.textContent = text;
  else {
    const strong = document.createElement("strong");
    strong.textContent = name;
    const span = document.createElement("span");
    span.textContent = text;
    div.append(strong, span);
  }
  messages.appendChild(div);
  while (messages.children.length > 80) messages.removeChild(messages.firstChild);
  messages.scrollTop = messages.scrollHeight;
}

function updatePeopleCount() {
  peopleCount.textContent = `접속자 ${playerData.size}명`;
}

function createPlayer(p) {
  playerData.set(p.id, p);
  if (gameScene) gameScene.addPlayer(p);
  updatePeopleCount();
}
function removePlayer(id) {
  playerData.delete(id);
  if (gameScene) gameScene.removePlayer(id);
  updatePeopleCount();
}

socket.on("connect", () => {
  connectionDot.classList.add("connected");
  connectionText.textContent = "서버 연결됨";
});
socket.on("disconnect", () => {
  connectionDot.classList.remove("connected");
  connectionText.textContent = "연결 끊김 · 재연결 중";
});
socket.on("welcome", (data) => {
  selfId = data.selfId;
  world = data.world || world;
  data.players.forEach(createPlayer);
  addMessage("시스템", "월드에 접속했습니다.", false);
});
socket.on("playerJoined", (p) => {
  createPlayer(p);
  if (p.id !== selfId) addMessage("시스템", `${p.name}님이 접속했습니다.`, true);
});
socket.on("playerUpdated", (p) => {
  playerData.set(p.id, p);
  if (gameScene) gameScene.updatePlayer(p);
});
socket.on("playerMoved", (p) => {
  const old = playerData.get(p.id);
  if (!old) return;
  old.x = p.x; old.y = p.y;
  playerData.set(p.id, old);
  if (gameScene) gameScene.movePlayer(p.id, p.x, p.y);
});
socket.on("playerLeft", (id) => {
  const p = playerData.get(id);
  removePlayer(id);
  if (p && id !== selfId) addMessage("시스템", `${p.name}님이 나갔습니다.`, true);
});
socket.on("chat", (m) => addMessage(m.name, m.text));

document.getElementById("saveName").addEventListener("click", () => {
  socket.emit("setName", nameInput.value);
  nameInput.blur();
});
nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("saveName").click();
});
document.getElementById("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat", text);
  chatInput.value = "";
  chatInput.focus();
});

class WorldScene extends Phaser.Scene {
  constructor() { super("World"); }
  create() {
    gameScene = this;
    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.physics.world.setBounds(0, 0, world.width, world.height);
    this.drawWorld();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT");
    this.cursors = this.input.keyboard.createCursorKeys();
    playerData.forEach(p => this.addPlayer(p));
    this.cameras.main.setZoom(Math.min(1, (this.scale.width - 20) / 850));
    this.scale.on("resize", () => this.cameras.main.setZoom(Math.min(1, (this.scale.width - 20) / 850)));
  }
  drawWorld() {
    const g = this.add.graphics();
    g.fillStyle(0x83c879, 1); g.fillRect(0, 0, world.width, world.height);
    // subtle grass pattern
    g.lineStyle(1, 0x72b96e, 0.45);
    for (let x = 0; x < world.width; x += 60) for (let y = 0; y < world.height; y += 60) {
      g.lineBetween(x + 8, y + 15, x + 12, y + 22);
      g.lineBetween(x + 35, y + 40, x + 39, y + 46);
    }
    // pond
    g.fillStyle(0x56b8d4, 1); g.fillEllipse(560, 360, 330, 220);
    g.lineStyle(8, 0x9de0df, 0.8); g.strokeEllipse(560, 360, 330, 220);
    // path
    g.lineStyle(72, 0xdcc99a, 1);
    g.beginPath(); g.moveTo(0, 760); g.lineTo(500, 690); g.lineTo(900, 820); g.lineTo(1300, 700); g.lineTo(1800, 770); g.strokePath();
    // trees
    for (let i = 0; i < 68; i++) {
      const x = 50 + ((i * 193 + 71) % (world.width - 100));
      const y = 50 + ((i * 127 + 39) % (world.height - 100));
      if (Math.abs(x - 560) < 210 && Math.abs(y - 360) < 145) continue;
      this.add.ellipse(x, y + 15, 34, 13, 0x4e8e4c, 0.45);
      this.add.rectangle(x, y + 8, 9, 27, 0x8d6543);
      this.add.circle(x, y - 9, 22, 0x2f8c5b);
      this.add.circle(x - 10, y - 16, 14, 0x45a968);
    }
    // small plaza
    g.fillStyle(0xf0d8a5, 1); g.fillCircle(900, 520, 76);
    g.lineStyle(5, 0xc3a875, 1); g.strokeCircle(900, 520, 76);
    this.add.text(900, 520, "만남의 광장", { fontFamily: "sans-serif", fontSize: "17px", color: "#664b2b", fontStyle: "bold" }).setOrigin(0.5);
    // border
    g.lineStyle(12, 0x477f4d, 1); g.strokeRect(0, 0, world.width, world.height);
  }
  addPlayer(p) {
    if (this.children.list.length === 0 || this.sprites?.has(p.id)) return;
    if (!this.sprites) this.sprites = new Map();
    const color = p.id === selfId ? 0x5e79ff : (p.color || 0xffbb66);
    const container = this.add.container(p.x, p.y);
    const shadow = this.add.ellipse(0, 15, 32, 12, 0x25462d, 0.35);
    const body = this.add.circle(0, 0, 15, color).setStrokeStyle(3, 0xffffff, 0.95);
    const face = this.add.circle(0, -3, 5, 0xffe4c5);
    const label = this.add.text(0, -34, p.name || "탐험가", {
      fontFamily: "sans-serif", fontSize: "13px", color: "#ffffff",
      stroke: "#25452f", strokeThickness: 4, fontStyle: "bold"
    }).setOrigin(0.5);
    container.add([shadow, body, face, label]);
    container.setDepth(p.y);
    this.sprites.set(p.id, { container, label });
    if (p.id === selfId) this.cameras.main.startFollow(container, true, 0.12, 0.12);
  }
  updatePlayer(p) {
    const s = this.sprites?.get(p.id);
    if (s) s.label.setText(p.name || "탐험가");
  }
  movePlayer(id, x, y) {
    const s = this.sprites?.get(id);
    if (s) { s.container.setPosition(x, y); s.container.setDepth(y); }
  }
  removePlayer(id) {
    const s = this.sprites?.get(id);
    if (s) { s.container.destroy(); this.sprites.delete(id); }
  }
  update(time) {
    if (!selfId) return;
    const me = playerData.get(selfId);
    if (!me) return;
    let dx = 0, dy = 0;
    if (this.keys.A.isDown || this.cursors.left.isDown) dx -= 1;
    if (this.keys.D.isDown || this.cursors.right.isDown) dx += 1;
    if (this.keys.W.isDown || this.cursors.up.isDown) dy -= 1;
    if (this.keys.S.isDown || this.cursors.down.isDown) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      me.x = Phaser.Math.Clamp(me.x + (dx / len) * 220 * (this.game.loop.delta / 1000), 24, world.width - 24);
      me.y = Phaser.Math.Clamp(me.y + (dy / len) * 220 * (this.game.loop.delta / 1000), 24, world.height - 24);
      this.movePlayer(selfId, me.x, me.y);
      if (time - lastSent > 45) {
        socket.emit("move", { x: me.x, y: me.y });
        lastSent = time;
      }
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1100,
  height: 620,
  backgroundColor: "#83c879",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [WorldScene]
});