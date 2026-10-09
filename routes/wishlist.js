// routes/wishlist.js
const express = require("express");
const router = express.Router();
const watcher = require("../services/watcher");

router.get("/wishlist", (req, res) => res.render("wishlist"));

router.post("/api/wishlist/status", express.json(), async (req, res) => {
  const urls = Array.isArray(req.body.urls) ? req.body.urls.slice(0, 50) : [];
  res.json(await watcher.getStatus(urls));
});

router.post("/api/wishlist/subscribe", express.json(), (req, res) => {
  const ok = watcher.subscribe(req.body.email, req.body.items);
  res.status(ok ? 200 : 400).json({ ok });
});

watcher.start();
module.exports = router;
