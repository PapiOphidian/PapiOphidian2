// @ts-check

const passthrough = require("./passthrough")
const { snow, commands, config } = passthrough

const extraContext = {
	nameRegex: /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u,
	async refreshcommands() {
		const payload = Array.from(commands.commands.values()).map(c => {
			if (!extraContext.nameRegex.test(c.name)) throw new Error(`${c.name} doesn't match name regex`)
			return {
				name: c.name,
				type: c.type ?? 1,
				description: c.description,
				guild_ids: c.guild_ids,
				integration_types: c.integration_types,
				contexts: c.contexts,
				options: c.options,
				default_member_permissions: null
			}
		})

		const globalCommands = payload.filter(c => !c.guild_ids?.length)
		if (globalCommands.length) {
			const response = await snow.interaction.bulkOverwriteApplicationCommands(config.client_id, globalCommands).catch(console.error)
			console.log(response)
		}

		const guildedCommands = payload.filter(c => c.guild_ids?.length)
		if (guildedCommands.length) {
			/** @type {Array<string>} */
			// @ts-expect-error
			const uniqueGuildIds = guildedCommands.map(c => c.guild_ids).flat().filter((id, ind, arr) => arr.indexOf(id) === ind)
			for (const guildID of uniqueGuildIds) {
				const forGuild = guildedCommands.filter(c => c.guild_ids?.includes(guildID))
				const response = await snow.interaction.bulkOverwriteGuildApplicationCommands(config.client_id, guildID, forGuild).catch(console.error)
				console.log(response)
			}
		}
	}
}

module.exports = extraContext;
