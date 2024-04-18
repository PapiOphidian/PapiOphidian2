const passthrough = require("./passthrough")

passthrough.cloud.on("error", console.error)

;(async () => {
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
