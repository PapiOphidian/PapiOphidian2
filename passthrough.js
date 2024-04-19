const { SnowTransfer } = require("snowtransfer")
const { Client } = require("cloudstorm")
const Sync = require("heatsync")

const { PresenceUpdateStatus } = require("discord-api-types/v10")

const { CommandManager, ChatInputCommand } = require("./packages/commands")

/** @type {InstanceType<typeof import("heatsync").default>} */
// @ts-ignore
const sync = new Sync()

/** @type {import("./config")} */
const config = sync.require("./config.js")

const snow = new SnowTransfer(config.token, {
	disableEveryone: true
})

module.exports = {
	commands: new CommandManager(cmd => [new ChatInputCommand(cmd)]),
	snow,
	config,
	cloud: new Client(config.token, {
		snowtransferInstance: snow,
		intents: ["GUILD_MESSAGES", "MESSAGE_CONTENT", "GUILD_MESSAGE_REACTIONS"],
		ws: {
			compress: true,
			encoding: "etf"
		},
		initialPresence: {
			status: PresenceUpdateStatus?.Online ?? "online",
			since: null,
			afk: false,
			activities: [
				{
					name: "Minecraft",
					type: 0
				}
			]
		}
	}),
	sync,
	/** @type {import("sqlite").Database} */
	// @ts-expect-error
	db: null,
	/** @type {Record<string, Map<string, any>>} */
	caches: {}
}
