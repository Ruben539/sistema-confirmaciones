import "dotenv/config"
import express from "express"
import cors from "cors"
import routes from "./infrastructure/router"
const port = process.env.PORT || 3001

// libsignal prints every message it can't decrypt as an 8-line stack trace ("Bad MAC",
// "Over 2000 messages into the future"), burying the useful logs. One line with a counter instead;
// the bot also logs who sent it ("No se pudo descifrar el mensaje de ...").
const originalConsoleError = console.error.bind(console)
let decryptFailures = 0
console.error = (...args: unknown[]) => {
  const first = typeof args[0] === "string" ? args[0] : ""
  if (first.startsWith("Failed to decrypt message")) return
  if (first.startsWith("Session error:")) {
    decryptFailures++
    const reason = first.replace(/^Session error:\s*/, "").split(" SessionError")[0].split(" Error:")[0].slice(0, 120)
    originalConsoleError(`[libsignal] No se pudo descifrar un mensaje entrante: ${reason} (total desde el inicio: ${decryptFailures})`)
    return
  }
  originalConsoleError(...args)
}
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('tmp'))
app.use(`/`,routes)

// Only reachable from the same server (Laravel calls http://127.0.0.1:3001): the /lead endpoint sends
// WhatsApp messages without authentication, so it must not be exposed. Set BOT_HOST=0.0.0.0 to override.
const host = process.env.BOT_HOST || "127.0.0.1"
app.listen(Number(port), host, () => console.log(`Ready...${host}:${port}`))