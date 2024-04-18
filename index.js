const sqlite = require("sqlite")
const { Database } = require("sqlite3")

const passthrough = require("./passthrough")

passthrough.cloud.on("error", console.error)

;(async () => {
	const db = await sqlite.open({
		filename: "./database.sqlite",
		driver: Database
	})
	passthrough.db = db

	await passthrough.cloud.connect()
	console.log("Gateway connected")

	passthrough.sync.require([
		"./commands.js",
		"./events.js",
		"./utils.js"
	])
})()

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)
