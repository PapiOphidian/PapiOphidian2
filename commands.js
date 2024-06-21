const passthrough = require("./passthrough")

const { commands, snow, sync } = passthrough

/** @type {import("./events")} */
const events = sync.require("./events")

commands.assign([
	{
		name: "trigger-get-pro",
		description: "",
		category: "triggers",
		type: 3,
		guild_ids: [events.physModGuildID],
		/** @param {import("./packages/commands").ContextMenuCommand} cmd */
		async process(cmd) {
			await snow.interaction.deleteOriginalInteractionResponse(cmd.application_id, cmd.token)
			/** @type {import("discord-api-types/v10").APIMessage} */
			// @ts-expect-error
			const message = cmd.data.messages.get(cmd.target)
			events.triggerMap["phys_download"].trigger(message)
		}
	},
	{
		name: "trigger-pojav",
		description: "",
		category: "triggers",
		type: 3,
		guild_ids: [events.physModGuildID],
		/** @param {import("./packages/commands").ContextMenuCommand} cmd */
		async process(cmd) {
			await snow.interaction.deleteOriginalInteractionResponse(cmd.application_id, cmd.token)
			/** @type {import("discord-api-types/v10").APIMessage} */
			// @ts-expect-error
			const message = cmd.data.messages.get(cmd.target)
			events.triggerMap["phys_pojav"].trigger(message)
		}
	}
])
