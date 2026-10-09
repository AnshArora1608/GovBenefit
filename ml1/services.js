// services.js - Node bridge to the Python scheme recommender
const { spawn } = require("child_process");
const path = require("path");

const PYTHON = process.env.PYTHON_BIN || "python3"; // "python" on Windows
const SCRIPT = path.join(__dirname, "recommend_cli.py");
const TIMEOUT_MS = 60000; // first call loads CSV + models + fits TF-IDF

function getRecommendations(profile) {
  return new Promise((resolve, reject) => {
    if (!profile || !profile.state) {
      return reject(new Error("state is required"));
    }

    const proc = spawn(PYTHON, [SCRIPT], { cwd: __dirname });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("Recommender timed out"));
    }, TIMEOUT_MS);

    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        return reject(new Error(stderr.trim() || `Python exited with code ${code}`));
      }
      if (parsed && parsed.error) return reject(new Error(parsed.error));
      resolve(parsed); // array of { scheme_name, level, state, benefit_type, app_mode, score, why, source_url }
    });

    proc.stdin.write(JSON.stringify(profile));
    proc.stdin.end();
  });
}

module.exports = { getRecommendations };

/* Express usage:
const express = require("express");
const { getRecommendations } = require("./services");
const app = express();
app.use(express.json());
app.post("/api/recommend", async (req, res) => {
  try { res.json(await getRecommendations(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.listen(3000);
*/
