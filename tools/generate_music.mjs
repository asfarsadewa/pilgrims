/**
 * Generate the game's BGM with Lyria 3.5 via the Gemini Interactions API.
 *
 *   node tools/generate_music.mjs            # generate missing tracks
 *   node tools/generate_music.mjs --force    # regenerate everything
 *
 * Requires GEMINI_API_KEY. Output: public/audio/<name>.mp3
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public", "audio");
mkdirSync(outDir, { recursive: true });

const API = "https://generativelanguage.googleapis.com/v1beta/interactions";
const FORCE = process.argv.includes("--force");
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

const TRACKS = [
  {
    name: "title",
    prompt:
      "Cinematic mystical opening theme for a quiet puzzle game about pilgrims following a shrine through an ancient land. Deep sustained drone, a lonely rising wooden flute, a single distant bell, soft wind, vast negative space. Instrumental only, absolutely no vocals and no lyrics. Slow, ancient, melancholic, loopable. About 90 seconds.",
  },
  {
    name: "pilgrimage",
    prompt:
      "Warm sparse instrumental ambient for a slow journey at dawn. Gentle fingerpicked acoustic guitar, low sustained strings, soft wooden flute, faint distant birds, warm hum. Hopeful but tinged with melancholy. Instrumental only, absolutely no vocals and no lyrics, no percussion. Very sparse and loopable. About two minutes.",
  },
  {
    name: "night",
    prompt:
      "Dark quiet instrumental night pilgrimage. Low cello drone, breathy wooden flute, one faint high bell, wind moving through cold ruins, immense spacious silence. Instrumental only, absolutely no vocals and no lyrics, no drums. Slow, cold, loopable. About two minutes.",
  },
];

async function generate(track) {
  const target = resolve(outDir, `${track.name}.mp3`);
  if (!FORCE && existsSync(target)) {
    const kb = Math.round(statSync(target).size / 1024);
    console.log(`· ${track.name}: exists (${kb} KB), skipping`);
    return;
  }

  console.log(`… generating "${track.name}" with lyria-3.5`);
  const started = Date.now();
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": KEY,
    },
    body: JSON.stringify({
      model: "lyria-3.5",
      input: track.prompt,
      response_format: { type: "audio" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  }

  const data = await response.json();
  const audio = (data.steps ?? [])
    .flatMap((step) => step.content ?? [])
    .find((block) => block.type === "audio" && block.data);
  if (!audio) {
    throw new Error(`no audio block in response: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const buffer = Buffer.from(audio.data, "base64");
  writeFileSync(target, buffer);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `✔ ${track.name}.mp3  ${(buffer.length / 1024 / 1024).toFixed(2)} MB  in ${seconds}s`,
  );
}

for (const track of TRACKS) {
  try {
    await generate(track);
  } catch (error) {
    console.error(`✘ ${track.name}:`, error.message);
    process.exitCode = 1;
  }
}

console.log("done");
