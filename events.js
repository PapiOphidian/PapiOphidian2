const passthrough = require("./passthrough")

const { sync, snow, cloud } = passthrough

/** @type {typeof import("./utils")} */
const utils = sync.require("./utils")

sync.addTemporaryListener(sync.events, "any", file => console.log(`${file} reloaded`))
sync.addTemporaryListener(snow.requestHandler, "requestError", console.error)
sync.addTemporaryListener(
	cloud,
	"dispatch",
	/** @param {import("cloudstorm").IGatewayDispatch} data */
	async data => {
		switch (data.t) {

			case "INTERACTION_CREATE": {
				// @ts-ignore
				if (data.d.type === 2) passthrough.commands.handle(data.d, passthrough.snow)
				break
			}

			case "MESSAGE_CREATE": {
				if (data.d.author.bot) return

				if (utils.checkTriggers(data.d)) return
				if (await utils.checkCrashLog(data.d)) return
				break
			}

			default: break
		}
	}
)
