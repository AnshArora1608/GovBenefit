const express = require("express")
const router = express.Router()
const checking=require("../controllers/static.js")


router.get("/", checking)
   




module.exports = router;