const passthrough = require("./passthrough")

/** @type {import("./utils")} */
const utils = passthrough.sync.require("./utils.js")

passthrough.cloud.on("error", console.error)

;(async () => {
	await passthrough.cloud.connect()
	console.log("Gateway connected")

	passthrough.cloud.on("dispatch", payload => utils.onGatewayDispatch(payload))
	passthrough.sync.require("./commands.js")
})()

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)
