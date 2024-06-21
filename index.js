// @ts-check

const sqlite = require("sqlite")
const { Database } = require("sqlite3")
const REPLProvider = require("./packages/repl")

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

	/** @type {typeof import("./replfunctions")} */
	const replfunctions = passthrough.sync.require("./replfunctions")

	void new REPLProvider({ passthrough, replfunctions })
})()

passthrough.sync.events.on("any", file => console.log(`${file} reloaded`))

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)
