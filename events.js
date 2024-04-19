const fs = require("fs")
const path = require("path")

const passthrough = require("./passthrough")

const { sync, snow, cloud, db } = passthrough

/** @type {typeof import("./utils")} */
const utils = sync.require("./utils")

/** @type {typeof snow.channel.getChannelMessage} */
const getChannelMessage = snow.channel.getChannelMessage.bind(snow.channel)

const starboardContentFormat = "%emoji %reactions %jump"

// [Mod, Admin, Helper]
const physModGoodRoles = ["947414444550549515", "673969281444216834", "1062898572686798960"]
// [Staff]
const mumsHouseGoodRoles = ["297202820162125824"]
const physModGuildID = "231062298008092673"
const mumsHouseGuildID = "214249708711837696"
/** @type {Record<string, string>} */
const reportChannelMap = {
	// Physics Mod: admin-messages
	[physModGuildID]: "934909491613421598",
	// Mum's House: 4k_cctv
	[mumsHouseGuildID]: "300752762973585418"
}

/** @type {Parameters<typeof utils.checkTriggers>["1"]} */
const triggerMap = {
	"scams": {
		ignoreRoles: [...physModGoodRoles, ...mumsHouseGoodRoles],
		matchers: [/50/, /gift/i, /(?:https?:\/\/)?discord\.gg\/\w+/],
		test(positions) {
			return utils.buildCase(positions, -1, 0, 1) // steam scam
				|| utils.buildCase(positions, -1, 2) // discord link (possibly nsfw)
		},
		async trigger(msg) {
			if (!msg.guild_id) return
			const timeout = new Date()
			timeout.setDate(timeout.getDate() + 7) // 1 week timeout
			const cont = await Promise.all([
				snow.channel.deleteMessage(msg.channel_id, msg.id, "scamming"),
				snow.guild.updateGuildMember(msg.guild_id, msg.author.id, {
					communication_disabled_until: timeout.toISOString()
				})
			]).then(() => true).catch(() => false)

			if (!cont) {
				console.log(`Failed to timeout user ${msg.author.username} (${msg.author.id}) for possible scam\n\n${msg.content}`)
				return true
			}

			const channel = reportChannelMap[msg.guild_id]
			if (!channel) return

			snow.channel.createMessage(channel, { content: `Timed out <@${msg.author.id}> for scamming.\n\`\`\`\n${msg.content}\`\`\`` })
		}
	},
	"phys_download": {
		guild: physModGuildID,
		matchers: [/how /i, / get /i, / download /i, / ?physics/i, / pro/i, /buy/i, /patreon /i, / tier/i],
		test(positions) {
			return utils.buildCase(positions, 15, 0, 1, 3) // how get physics
				|| utils.buildCase(positions, 15, 0, 1, 4) // how get pro
				|| utils.buildCase(positions, 15, 0, 2, 3) // how download physics
				|| utils.buildCase(positions, 15, 0, 2, 4) // how download pro
				|| utils.buildCase(positions, 15, 1, 4) // get pro
				|| utils.buildCase(positions, 15, 2, 4) // download pro
				|| utils.buildCase(positions, 15, 5, 4) // buy pro
				|| utils.buildCase(positions, 10, 6, 7) // patreon tier
				|| utils.buildCase(positions, 10, 0, 5) // how buy
		},
		trigger(msg) {
			snow.channel.createMessage(msg.channel_id, {
				content: "Here's a video on how to download physics mod pro! The downloads are only through patreon and Ko-Fi, but you don't *have* to pay.\nSupport is always appreciated however!",
				files: [{
					name: "pysiksmodtutorial.mp4",
					file: fs.createReadStream(path.join(__dirname, "./videos/download.mp4"))
				}],
				message_reference: {
					message_id: msg.id,
					channel_id: msg.channel_id,
					guild_id: msg.guild_id
				}
			})
		}
	},
	"phys_pojav": {
		guild: physModGuildID,
		matchers: [/work/i, / with /i, / ?pojav/i],
		test(positions) {
			return utils.buildCase(positions, 15, 0, 1, 2) // work with pojav
				|| utils.buildCase(positions, 15, 2, 0) // pojav work
		},
		trigger(msg) {
			snow.channel.createMessage(msg.channel_id, {
				content: "Physics Mod does not work with Pojav. No efforts are currently being made to make Physics Mod work with Pojav or any other launcher made for ARM based CPUs. If your platform supports x86 instruction emulation/translation, use that.",
				message_reference: {
					message_id: msg.id,
					channel_id: msg.channel_id,
					guild_id: msg.guild_id
				}
			})
		}
	}
}

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

				starboardMessageHandler("create", data.d)

				if (utils.checkTriggers(data.d, triggerMap)) return
				if (await utils.checkCrashLog(data.d)) return
				break
			}

			case "MESSAGE_UPDATE": {
				starboardMessageHandler("update", data.d)
				break
			}

			case "MESSAGE_DELETE": {
				utils.deleteCachedObject("message", data.d.id)
				db.all("DELETE FROM starboard_map WHERE message_id =?", [data.d.id])
				break
			}

			case "MESSAGE_REACTION_ADD": {
				starboardMessageHandler("add", data.d)
				break
			}

			case "MESSAGE_REACTION_REMOVE": {
				starboardMessageHandler("remove", data.d)
				break
			}

			default: break
		}
	}
)

/**
 * For some reason keyof <RecordHere> doesn't work so this is necessary
 * @template T
 * @typedef {T extends Record<infer R, any> ? R : never} RKeys
 */

/**
 * @template {{
 * 	"create": import("discord-api-types/v10").GatewayMessageCreateDispatchData,
 * 	"update": import("discord-api-types/v10").GatewayMessageUpdateDispatchData,
 * 	"add": import("discord-api-types/v10").GatewayMessageReactionAddDispatchData,
 * 	"remove": import("discord-api-types/v10").GatewayMessageReactionRemoveDispatchData
 * }} T
 * @template {RKeys<T>} D
 * @param {D} mode
 * @param {T[RKeys<T>]} data
 */
async function starboardMessageHandler(mode, data) {
	/** @type {T["create"]} */ // @ts-ignore
	const create = data,
	/** @type {T["update"]} */ // @ts-ignore
	update = data,
	/** @type {T["add"]} */ // @ts-ignore
	add = data,
	/** @type {T["remove"]} */ // @ts-ignore
	remove = data // yes this is necessary. Type narrowing wouldn't work

	let guildID, channelID, messageID, userID

	switch (mode) {
		case "add":
			guildID = add.guild_id; channelID = add.channel_id; messageID = add.message_id; userID = add.user_id
			break
		case "remove":
			guildID = remove.guild_id; channelID = remove.channel_id; messageID = remove.message_id; userID = remove.user_id
			break
		case "update":
			guildID = update.guild_id; channelID = update.channel_id; messageID = update.id; userID = update.member?.user?.id ?? update.author?.id
			break
		case "create":
			guildID = create.guild_id; channelID = create.channel_id; messageID = create.id; userID = create.author.id
			break
		default: throw new Error("No")
	}

	if (!guildID) return

	/** @type {DBStarboards | undefined} */
	const sb = await db.get("SELECT * FROM starboards WHERE guild_id =?", guildID)
	if (!sb) return

	if (sb.ignore_channel_ids?.split(",").includes(channelID)) return

	if (mode === "create") return utils.setCachedObject("message", create.id, create, 1000 * 60 * 60 * 6)

	/** @type {import("discord-api-types/v10").APIMessage | null} */
	const cached = utils.getCachedObject("message", messageID)

	if (mode === "update" && cached) Object.assign(cached, update)

	const message = cached ?? await utils.fetchObjectWithCache(getChannelMessage, "message", messageID, 1000 * 60 * 60 * 6, channelID, messageID)
	if (!message) return
	if (!message.reactions) message.reactions = []


	if (mode === "add" || mode === "remove") {
		if (sb.emoji !== (add ?? remove).emoji.name) return
	}

	if (mode === "add" && message.author.id === userID) snow.channel.createMessage(channelID, { content: `🚨🚨 <@${userID}> IS A THOT AND SELF-STARRED THEIR MEME 🚨🚨` })
	if (mode === "add" || mode === "remove") {
		const existingReaction = message.reactions.find(r => r.emoji.name === (add ?? remove).emoji.name) // add ?? remove for type safety
		if (!existingReaction && mode === "add") message.reactions.push({ count: 1, count_details: { burst: 0, normal: 0 }, me: false, me_burst: false, emoji: add.emoji, burst_colors: [] })

		if (existingReaction) {
			if (mode === "add") existingReaction.count++
			else existingReaction.count--
		}
	}

	const reaction = message.reactions.find(r => r.emoji.name === sb.emoji)
	if (!reaction) return

	const existingEmbedFromMessage = message.embeds.find(e => !!e.image?.url)

	/** @type {import("discord-api-types/v10").APIEmbed} */
	const embed = {
		author: {
			name: message.author.username
		},
		description: message.content.length
			? message.content.slice(0, 1999)
			: undefined,
		image: message.attachments.length
			? { url: message.attachments[0].url, proxy_url: message.attachments[0].proxy_url }
			: existingEmbedFromMessage?.image
				? { url: existingEmbedFromMessage.image.url, proxy_url: existingEmbedFromMessage.image.proxy_url } // in the case of message updates with embeds from users
				: undefined
	}

	/** @type {DBStarboardMap | undefined} */
	const existingPost = await db.get("SELECT * FROM starboard_map WHERE message_id =?", [messageID])
	const content = utils.replace(starboardContentFormat, { "emoji": sb.emoji, "reactions": reaction.count, "jump": `https://discord.com/channels/${guildID}/${channelID}/${messageID}` })

	if (!existingPost) {
		const instantPromote = !!sb.instant_promote_role_ids?.split(",").find(r => add.member?.roles.includes(r))
		if (reaction.count >= sb.min || instantPromote) {
			const result = await snow.channel.createMessage(sb.channel_id, { content, embeds: [embed] })
			db.all("INSERT INTO starboard_map (message_id, sb_message_id) VALUES (?, ?)", [message.id, result.id])
			return
		}
	} else snow.channel.editMessage(sb.channel_id, existingPost.sb_message_id, { content, embeds: [embed] })
}

/**
 * @typedef {{ guild_id: string, channel_id: string, ignore_channel_ids: string | null, emoji: string, min: number, instant_promote_role_ids: string | null }} DBStarboards
 */

/**
 * @typedef {{ message_id: string, sb_message_id: string }} DBStarboardMap
 */
