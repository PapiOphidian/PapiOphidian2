const fs = require("fs")
const path = require("path")

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
			const message = cmd.data.messages.get(cmd.target)
			if (!message) throw new Error("PANICK!")
			if (cmd.channel.id === events.physModGameDevTalkID) {
				snow.channel.createMessage(events.reportChannelMap[events.physModGuildID], {
					content: `<@${cmd.author.id}> used trigger get pro in <#${events.physModGameDevTalkID}> deleting message to redirect:\n\`\`\`${message.content.slice(0, 1900)}${message.content.length > 1900 ? "..." : ""}\n\`\`\``
				})
			}
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
			const message = cmd.data.messages.get(cmd.target)
			if (!message) throw new Error("PANICK!")
			events.triggerMap["phys_pojav"].trigger(message)
		}
	},
	{
		name: "read-guidelines",
		description: "Tell someone to read the before you post guidelines",
		category: "triggers",
		type: 1,
		guild_ids: [events.physModGuildID],
		options: [
			{
				name: "user",
				type: 6,
				description: "A user to mention along with the message",
				required: false
			}
		],
		/** @param {import("./packages/commands").ChatInputCommand} cmd */
		process(cmd) {
			const user = cmd.data.users.get(cmd.data.options.get("user")?.asString() ?? "") ?? null

			snow.interaction.editOriginalInteractionResponse(cmd.application_id, cmd.token, {
				content: `${user ? `<@${user.id}>, s` : "S"}omeone thinks you should read this: https://discord.com/channels/231062298008092673/1115343312417718323/1115343312417718323`
			})
		}
	},
	{
		name: "trigger-optifine",
		description: "",
		category: "triggers",
		type: 3,
		guild_ids: [events.physModGuildID],
		/** @param {import("./packages/commands").ContextMenuCommand} cmd */
		async process(cmd) {
			await snow.interaction.deleteOriginalInteractionResponse(cmd.application_id, cmd.token)
			const message = cmd.data.messages.get(cmd.target)
			if (!message) throw new Error("PANICK!")
			snow.channel.createMessage(cmd.channel.id, {
				content: "Using Optifine is not recommended under any circumstances.\nIf you're using Forge, consider using Embeddium as a faster renderer and Oculus for shaders (depends on Embeddium)\nIf you're using Fabric/Quilt/NeoForge, consider using Sodium as a faster renderer and Iris for shaders (depends on Sodium)\n\nAs a disclaimer; Physics Mod does have some support for Optifine, but this support could break. Optifine is very invasive and is horrible with mod support.",
				message_reference: {
					channel_id: cmd.channel.id,
					guild_id: cmd.guild_id || void 0,
					message_id: message.id
				}
			})
		}
	},
	{
		name: "trigger-thanos",
		description: "",
		category: "triggers",
		type: 3,
		guild_ids: [events.physModGuildID],
		/** @param {import("./packages/commands").ContextMenuCommand} cmd */
		async process(cmd) {
			await snow.interaction.deleteOriginalInteractionResponse(cmd.application_id, cmd.token)
			const message = cmd.data.messages.get(cmd.target)
			if (!message) throw new Error("PANICK!")
			const file = {
				name: "thanos-method.gif",
				file: fs.createReadStream(path.join(__dirname, "./assets/binary-search.gif"))
			}
			snow.channel.createMessage(cmd.channel.id, {
				content: "What is The Thanos Method?\nThe Thanos Method™️ (more accurately known as a binary search) is a debugging technique used to find the mod or mods that are causing the issues you are experiencing. The method is simple: to find the conflicting mods, split your mods folder into 2 groups. Remove one group, and test in-game. Keep the group that has the problem, and repeat until no more mods can be removed without the issue disappearing. Thanks to The Thanos Method™️, you can now enjoy an issue free modded Minecraft!\n\n-# \"The Thanos Method\" is not actually trademarked or even remotely considered an official name. Please don't sue, it was just considered funny.",
				files: [file],
				message_reference: {
					channel_id: cmd.channel.id,
					guild_id: cmd.guild_id || void 0,
					message_id: message.id
				}
			})
		}
	}
])
