import "dotenv/config"
import express from "express"
import cors from "cors"
import routes from "./infrastructure/router"
const port = process.env.PORT || 3001
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('tmp'))
app.use(`/`,routes)

// Only reachable from the same server (Laravel calls http://127.0.0.1:3001): the /lead endpoint sends
// WhatsApp messages without authentication, so it must not be exposed. Set BOT_HOST=0.0.0.0 to override.
const host = process.env.BOT_HOST || "127.0.0.1"
app.listen(Number(port), host, () => console.log(`Ready...${host}:${port}`))