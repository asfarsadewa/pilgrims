/**
 * Headless smoke test: loads the built game in Chrome, captures console
 * errors, verifies the WebGL scene built, exercises a move, and saves a
 * screenshot. Usage: node tools/smoke.mjs [url]
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = process.argv[2] ?? "http://localhost:4173/";
const PORT = 9333;
const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("No Chrome/Edge found");
  process.exit(1);
}

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,800",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${resolve(".smoke/profile")}`,
    URL,
  ],
  { stdio: ["ignore", "ignore", "ignore"], cwd: process.cwd() },
);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTargets() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // not ready
    }
    await delay(250);
  }
  throw new Error("Chrome DevTools endpoint not ready");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main() {
  const target = await getTargets();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.enable");

  await delay(3500);

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      return { error: result.exceptionDetails.text };
    }
    return result.result.value;
  };

  const info = await evaluate(`(() => {
    try {
      const canvas = document.querySelector('canvas');
      const hook = window.pilgrims;
      const game = hook.game();
      const gl = hook.renderer.gl;
      const scene = hook.renderer.sceneBuilder.scene;
      const cam = hook.renderer.cameraController.camera;
      const center = cam.position.clone().set(0, 0, 0);
      center.project(cam);
      gl.render(scene, cam);
      const ctx = gl.getContext();
      const w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      let nonDark = 0, lumSum = 0;
      for (let i = 0; i < px.length; i += 4) {
        const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        if (l > 25) nonDark++;
        lumSum += l;
      }
      const board = scene.children.find((c) => c.name === 'Board');
      return {
        hasCanvas: !!canvas,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        hasContext: !!(canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))),
        sceneChildren: scene.children.length,
        boardChildren: board ? board.children.length : 0,
        entityChildren: hook.renderer.entityRenderer.group.children.length,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        glError: ctx.getError(),
        readNonDark: +(nonDark / (w * h)).toFixed(4),
        readLuminance: +(lumSum / (w * h)).toFixed(1),
        cameraPos: cam.position.toArray().map((n) => +n.toFixed(2)),
        frustum: [cam.left, cam.right, cam.top, cam.bottom].map((n) => +n.toFixed(2)),
        centerNdc: center.toArray().map((n) => +n.toFixed(3)),
        level: game.state.levelId,
        levelName: game.state.levelName,
        pilgrims: game.state.pilgrims.length,
        boardTiles: game.state.width * game.state.height,
        status: game.state.status,
        turn: game.state.turn,
      };
    } catch (e) {
      return { error: String((e && e.stack) || e) };
    }
  })()`);

  // The entry ritual must be present, and any gesture must reveal the title.
  const gate = await evaluate(`(() => {
    const node = document.querySelector('.gate-screen');
    return {
      present: !!node,
      action: (node?.querySelector('.gate-begin')?.textContent ?? '').trim() || null,
      hint: (node?.querySelector('.gate-hint')?.textContent ?? '').trim() || null,
      focus: (document.activeElement?.textContent ?? '').trim() || null,
    };
  })()`);
  await evaluate(
    `document.querySelector('.overlay')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`,
  );
  await delay(1500);
  const gateGone = await evaluate(`!document.querySelector('.gate-screen')`);

  // Inspect the opening screen, then dismiss it via the primary action.
  const title = await evaluate(`(() => {
    const overlay = document.getElementById('overlay');
    const scene = window.pilgrims.renderer.titleScene;
    return {
      visible: !overlay.classList.contains('hidden'),
      titleMode: overlay.classList.contains('title-mode'),
      word: document.querySelector('.title-word')?.textContent ?? null,
      glyphVisible: scene ? scene.visible : null,
      hasMark: !!document.querySelector('.title-mark'),
      credit: document.querySelector('.title-credit a')?.getAttribute('href') ?? null,
    };
  })()`);
  // Measure how readable the lone traveller is on the title screen.
  const titleLight = await evaluate(`(() => {
    try {
      const r = window.pilgrims.renderer;
      const scene = r.sceneBuilder.scene;
      const cam = r.cameraController.camera;
      const group = r.titleScene.group;
      const people = group.children.filter(
        (c) => c.name === 'TitleLanternBearer' || c.name === 'TitleTraveller',
      );
      const lantern = group.getObjectByName('Lantern');
      r.gl.render(scene, cam);
      const ctx = r.gl.getContext();
      const W = ctx.drawingBufferWidth, H = ctx.drawingBufferHeight;
      const px = new Uint8Array(W * H * 4);
      ctx.readPixels(0, 0, W, H, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      const sample = (obj, lift) => {
        const v = obj.position.clone();
        v.y += lift;
        v.project(cam);
        const sx = Math.round((v.x * 0.5 + 0.5) * W);
        const sy = Math.round((v.y * 0.5 + 0.5) * H);
        let sum = 0, n = 0, max = 0;
        const R = 40;
        for (let y = sy - R; y < sy + R; y += 2) {
          for (let x = sx - R; x < sx + R; x += 2) {
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = (y * W + x) * 4;
            const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
            sum += l; n++;
            if (l > max) max = l;
          }
        }
        return { name: obj.name, sx, sy, avg: +(sum / n).toFixed(1), max: +max.toFixed(1) };
      };
      return {
        count: people.length,
        hasLantern: !!lantern,
        people: people.map((p) => sample(p, 0.45)),
      };
    } catch (e) {
      return { error: String(e) };
    }
  })()`);

  const titleShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/title.png", Buffer.from(titleShot.data, "base64"));
  await evaluate(
    `document.querySelector('.title-actions button.primary')?.click()`,
  );
  await delay(1000);

  const music = await evaluate(`(() => {
    const a = window.pilgrims.audio;
    const entry = a.music.get(a.currentRequest?.name);
    return {
      request: a.currentRequest?.name ?? null,
      paused: entry ? entry.el.paused : null,
      currentTime: entry ? +entry.el.currentTime.toFixed(2) : null,
      readyState: entry ? entry.el.readyState : null,
      ctx: a.ctx ? a.ctx.state : null,
    };
  })()`);

  // Exercise a real key press through the input layer.
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))`,
  );
  await delay(120);
  const boneExpr = `(() => {
    const r = window.pilgrims.renderer;
    const p = [...r.entityRenderer.pilgrims.values()][0];
    const bone = p && p.root.getObjectByName ? p.root.getObjectByName('ThighL') : null;
    return bone ? bone.quaternion.toArray().map((v) => +v.toFixed(4)) : null;
  })()`;
  const boneA = await evaluate(boneExpr);
  await delay(600);
  const afterMove = await evaluate(`window.pilgrims.game().state.turn`);
  const boneB = await evaluate(boneExpr);
  const boneAnimated =
    Array.isArray(boneA) && Array.isArray(boneB) && JSON.stringify(boneA) !== JSON.stringify(boneB);

  const models = await evaluate(`(() => {
    const r = window.pilgrims.renderer;
    const scene = r.sceneBuilder.scene;
    let skinned = 0, meshes = 0, textured = 0;
    scene.traverse((o) => {
      if (o.isSkinnedMesh) skinned++;
      if (o.isMesh) {
        meshes++;
        if (o.material && o.material.map) textured++;
      }
    });
    const pilgrims = r.entityRenderer.pilgrims;
    const first = pilgrims ? [...pilgrims.values()][0] : null;
    return {
      skinned,
      meshes,
      textured,
      pilgrimMixer: !!(first && first.mixer),
      idleClip: !!(first && first.idleAction),
      walkClip: !!(first && first.walkAction),
    };
  })()`);
  models.boneAnimated = boneAnimated;

  // Undo through the input layer, then verify the snapshot was restored.
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }))`,
  );
  await delay(700);
  const afterUndo = await evaluate(`(() => {
    const game = window.pilgrims.game();
    return { turn: game.state.turn, status: game.state.status };
  })()`);

  // Level 001's known solution is Up, Up, Up. Finish it through real input.
  for (let i = 0; i < 3; i++) {
    await evaluate(
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))`,
    );
    await delay(900);
  }
  const outcome = await evaluate(`(() => {
    const game = window.pilgrims.game();
    const overlay = document.getElementById('overlay');
    return {
      status: game.state.status,
      turn: game.state.turn,
      overlayVisible: !overlay.classList.contains('hidden'),
      panelKicker: document.querySelector('.panel-kicker')?.textContent ?? null,
      moveHud: document.getElementById('move-count')?.textContent ?? null,
    };
  })()`);

  // Regression: Next -> level 2 must accept moves, and menus must work by keyboard.
  await evaluate(
    `document.querySelector('.panel-actions button.primary')?.click()`,
  );
  await delay(1000);
  const level2Id = await evaluate(`window.pilgrims.game().state.levelId`);
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))`,
  );
  await delay(800);
  const level2Turn = await evaluate(`window.pilgrims.game().state.turn`);
  // Bottom control buttons must work after a level transition.
  await evaluate(`document.querySelector('[data-action="restart"]')?.click()`);
  await delay(600);
  const restartTurn = await evaluate(`window.pilgrims.game().state.turn`);
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`,
  );
  await delay(300);
  const pause = await evaluate(`(() => {
    const overlay = document.getElementById('overlay');
    return {
      visible: !overlay.classList.contains('hidden'),
      kicker: document.querySelector('.panel-kicker')?.textContent ?? null,
      focusTag: document.activeElement?.tagName ?? null,
      focusLabel: (document.activeElement?.textContent ?? '').trim().slice(0, 20),
    };
  })()`);

  // The pause menu must be able to change the camera view.
  const camBefore = await evaluate(
    `+window.pilgrims.renderer.cameraController.camera.position.y.toFixed(3)`,
  );
  await evaluate(
    `[...document.querySelectorAll('.camera-option')].find((b) => b.dataset.camera === 'elevated')?.click()`,
  );
  await delay(900);
  const camAfter = await evaluate(
    `+window.pilgrims.renderer.cameraController.camera.position.y.toFixed(3)`,
  );
  const camActive = await evaluate(
    `document.querySelector('.camera-option.active')?.dataset.camera ?? null`,
  );
  await evaluate(
    `[...document.querySelectorAll('.camera-option')].find((b) => b.dataset.camera === 'diorama')?.click()`,
  );
  await delay(300);
  const camera = { before: camBefore, after: camAfter, active: camActive };

  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`,
  );
  await delay(300);
  const pauseClosed = await evaluate(
    `document.getElementById('overlay').classList.contains('hidden')`,
  );
  const navigation = { level2Id, level2Turn, restartTurn, pause, camera, pauseClosed };

  // Failure menu: arrow keys must move focus between the actions.
  await evaluate(`window.pilgrims.ui.showFailed(window.pilgrims.game().state)`);
  await delay(250);
  const focused = () =>
    evaluate(`(document.activeElement?.textContent || '').trim()`);
  const failFocus0 = await focused();
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))`,
  );
  await delay(120);
  const failFocus1 = await focused();
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))`,
  );
  await delay(120);
  const failFocus2 = await focused();
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))`,
  );
  await delay(120);
  const failFocus3 = await focused();
  await evaluate(`window.pilgrims.ui.hideOverlay()`);
  const failureNav = { failFocus0, failFocus1, failFocus2, failFocus3 };

  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/shot.png", Buffer.from(screenshot.data, "base64"));

  // Verify every level is framed on screen and render a screenshot of the last.
  const framing = [];
  for (let i = 0; i < 10; i++) {
    await evaluate(`window.pilgrims.startLevel(${i})`);
    await delay(320);
    const frame = await evaluate(`(() => {
      try {
        const hook = window.pilgrims;
        const game = hook.game();
        const cam = hook.renderer.cameraController.camera;
        hook.renderer.gl.render(hook.renderer.sceneBuilder.scene, cam);
        const hw = game.state.width / 2, hh = game.state.height / 2;
        let minX = 9, maxX = -9, minY = 9, maxY = -9;
        for (const sx of [-hw, hw]) for (const sz of [-hh, hh]) for (const y of [-0.6, 1.8]) {
          const v = cam.position.clone().set(sx, y, sz).project(cam);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
        return {
          id: game.state.levelId,
          bounds: [minX, maxX, minY, maxY].map((n) => +n.toFixed(2)),
          fits: minX > -1.02 && maxX < 1.02 && minY > -1.02 && maxY < 1.02,
        };
      } catch (e) {
        return { error: String(e) };
      }
    })()`);
    framing.push(frame);
  }
  const finalShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/final-level.png", Buffer.from(finalShot.data, "base64"));

  const errors = cdp.events
    .filter(
      (e) =>
        e.method === "Runtime.exceptionThrown" ||
        (e.method === "Log.entryAdded" && e.params.entry.level === "error") ||
        (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"),
    )
    .map((e) => JSON.stringify(e.params).slice(0, 400));

  console.log(
    JSON.stringify(
      {
        info,
        gate,
        gateGone,
        title,
        titleLight,
        music,
        models,
        afterMove,
        afterUndo,
        outcome,
        navigation,
        failureNav,
        framing,
        errors,
      },
      null,
      2,
    ),
  );
  ws.close();
}

main()
  .catch((error) => {
    console.error("SMOKE FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    chrome.kill();
    setTimeout(() => process.exit(process.exitCode ?? 0), 300);
  });
