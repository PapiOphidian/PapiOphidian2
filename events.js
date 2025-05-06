const fs = require("fs")
const path = require("path")

const {
	ComponentType,
	MessageFlags
} = require("discord-api-types/v10")

const passthrough = require("./passthrough")

const { sync, snow, cloud, db } = passthrough

/** @type {typeof import("./utils")} */
const utils = sync.require("./utils")

/** @type {typeof snow.channel.getChannelMessage} */
const getChannelMessage = snow.channel.getChannelMessage.bind(snow.channel)

const starboardContentFormat = "%emoji %reactions %jump"

// [Mod, Admin, Helper]
const physModGoodRoles = ["947414444550549515", "673969281444216834", "1062898572686798960"]
module.exports.physModGoodRoles = physModGoodRoles
// [Staff]
const mumsHouseGoodRoles = ["297202820162125824"]
module.exports.mumsHouseGoodRoles = mumsHouseGoodRoles
const physModGuildID = "231062298008092673"
module.exports.physModGuildID = physModGuildID
const mumsHouseGuildID = "214249708711837696"
module.exports.mumsHouseGuildId = mumsHouseGuildID
/** @type {Record<string, string>} */
const reportChannelMap = {
	// Physics Mod: admin-messages
	[physModGuildID]: "934909491613421598",
	// Mum's House: 4k_cctv
	[mumsHouseGuildID]: "300752762973585418"
}
module.exports.reportChannelMap = reportChannelMap
const mimetypeRegex = /\.(\w+)$/
const imageMimes = new Set(["png", "gif", "jpg", "jpeg", "webp"])
const videoMimes = new Set(["mp4", "mov", "webm"])
/** @type {Set<string>} */
const timingOutSetIgnoreSpam = new Set()
/** @type {Map<string, Array<string>>} */
const userRecentMessages = new Map()

const physModGeneralID = "882927654007881778"
const physModGameDevTalkID = "231062298008092673"

const downloadProMessage = "Here's a video on how to download physics mod pro! The downloads are only through [Patreon](<https://patreon.com/Haubna>) and [Ko-Fi](<https://ko-fi.com/haubna>), but you don't *have* to pay.\nSupport is always appreciated however!"

/** @type {Parameters<typeof utils.checkTriggers>["1"]} */
const triggerMap = {
	"scams": {
		ignoreRoles: [...physModGoodRoles, ...mumsHouseGoodRoles],
		matchers: [
			/20/,
			/50/,
			/steam/i,
			/gift/i,
			/(?:https?:\/\/)?discord\.gg\/\w+/,
			/https?:\/\/t.me/,
			/\[steam/i,
			/(?:(?:i will)|(?:i[^l]?ll)) (?:(?:teach)|(?:help)(?: the first))? \d+/i
		],
		test(positions) {
			return utils.buildCase(positions, 10, 0, 2) // 20 steam
				|| utils.buildCase(positions, 10, 0, 3) // 20 gift
				|| utils.buildCase(positions, 10, 1, 2) // 50 steam
				|| utils.buildCase(positions, 10, 1, 3) // 50 gift
				|| utils.buildCase(positions, 10, 3, 1) // gift 50
				|| utils.buildCase(positions, -1, 4) // discord link (possibly nsfw)
				|| utils.buildCase(positions, -1, 5) // telegram short link
				|| utils.buildCase(positions, 15, 3, 6) // gift ... [steam (using a masked link)
				|| utils.buildCase(positions, 10, 7) // I'll help the first 20...
		},
		async trigger(msg) {
			if (!msg.guild_id) return

			const timeoutAndReport = !timingOutSetIgnoreSpam.has(msg.author.id)
			timingOutSetIgnoreSpam.add(msg.author.id)
			setTimeout(() => timingOutSetIgnoreSpam.delete(msg.author.id), 10000)

			/** @type {Array<Promise<any>>} */
			const promises = [snow.channel.deleteMessage(msg.channel_id, msg.id, "scamming")]

			if (timeoutAndReport) {
				const timeout = new Date()
				timeout.setDate(timeout.getDate() + 7) // 1 week timeout
				promises.push(
					snow.guild.updateGuildMember(msg.guild_id, msg.author.id, {
						communication_disabled_until: timeout.toISOString()
					})
				)
			}

			const cont = await Promise.all(promises).then(() => true).catch(() => false)
			if (!cont) return console.log(`Failed to timeout user ${msg.author.username} (${msg.author.id}) for possible scam\n\n${msg.content}`)

			if (!timeoutAndReport) return

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
			const file = {
				name: "pysiksmodtutorial.mp4",
				file: fs.createReadStream(path.join(__dirname, "./assets/download-pro.mp4"))
			}
			if (msg.channel_id === physModGameDevTalkID) {
				snow.channel.deleteMessage(msg.channel_id, msg.id)
				snow.channel.createMessage(physModGeneralID, {
					content: `<@${msg.author.id}> this is the channel you should ask for support about physics mod in. To answer your question:\n${downloadProMessage}`,
					files: [file]
				})
			}	else {
				snow.channel.createMessage(msg.channel_id, {
					content: downloadProMessage,
					files: [file],
					message_reference: {
						message_id: msg.id,
						channel_id: msg.channel_id,
						guild_id: msg.guild_id
					}
				})
			}
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
	},
	"phys_bump": {
		guild: physModGuildID,
		matchers: [/^(?:[^ ]+)?bump(?:[^ ]+)?$/i],
		test(positions) {
			return positions[0] !== -1
		},
		trigger(msg) {
			snow.channel.deleteMessage(msg.channel_id, msg.id)
		}
	}
}
module.exports.triggerMap = triggerMap

sync.addTemporaryListener(snow.requestHandler, "requestError", (_reqID, info) => console.error(info, info.request.data))
sync.addTemporaryListener(snow.requestHandler, "rateLimit", console.error)
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

				if (timingOutSetIgnoreSpam.has(data.d.author.id)) return snow.channel.deleteMessage(data.d.channel_id, data.d.id, "Likely spam scamming").catch(() => void 0)

				utils.setCachedObject("message", data.d.id, data.d, 1000 * 60 * 60) // cache messages for 1h for starboard

				const previousMessageIDs = userRecentMessages.get(data.d.author.id) ?? [] // spamming accross channels scam detection
				userRecentMessages.set(data.d.author.id, previousMessageIDs)
				const previousMessagesIncludesThisMessage = previousMessageIDs
					.map(id => {
						/** @type {import("discord-api-types/v10").APIMessage | null} */
						const m = utils.getCachedObject("message", id)
						return m
					})
					.filter(m => !!m)
					.filter(msg => msg.content === data.d.content && msg.channel_id !== data.d.channel_id)

				previousMessageIDs.push(data.d.id)
				setTimeout(() => userRecentMessages.delete(data.d.author.id), 10000)

				if (previousMessagesIncludesThisMessage.length) {
					triggerMap["scams"].trigger(data.d)
					for (const msg of previousMessagesIncludesThisMessage) {
						snow.channel.deleteMessage(msg.channel_id, msg.id, "Likely spam scamming").catch(() => void 0)
					}
					return
				}


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

/** @type {Set<string>} */
const deferedChanges = new Set()

/**
 * For some reason keyof <RecordHere> doesn't work so this is necessary
 * @template T
 * @typedef {T extends Record<infer R, any> ? R : never} RKeys
 */

/**
 * @typedef {{
 * 	"update": import("discord-api-types/v10").GatewayMessageUpdateDispatchData,
 * 	"add": import("discord-api-types/v10").GatewayMessageReactionAddDispatchData,
 * 	"remove": import("discord-api-types/v10").GatewayMessageReactionRemoveDispatchData
 * }} StarboardHandlerDataMap
 */

/**
 * @template {RKeys<StarboardHandlerDataMap>} D
 * @param {D} mode
 * @param {StarboardHandlerDataMap[RKeys<StarboardHandlerDataMap>]} data
 */
async function starboardMessageHandler(mode, data) {
	/** @type {StarboardHandlerDataMap["update"]} */ // @ts-ignore
	const update = data,
	/** @type {StarboardHandlerDataMap["add"]} */ // @ts-ignore
	add = data,
	/** @type {StarboardHandlerDataMap["remove"]} */ // @ts-ignore
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
			// @ts-expect-error
			guildID = update.guild_id; channelID = update.channel_id; messageID = update.id; userID = update.member?.user?.id ?? update.author?.id
			break
		default: throw new Error("No")
	}

	if (!guildID) return

	/** @type {DBStarboards | undefined} */
	const sb = await db.get("SELECT * FROM starboards WHERE guild_id =?", guildID)
	if (!sb) return

	if (sb.ignore_channel_ids?.split(",").includes(channelID)) return

	/** @type {import("discord-api-types/v10").APIMessage | null} */
	const cached = utils.getCachedObject("message", messageID)

	if (mode === "update" && cached) Object.assign(cached, update)

	const message = cached ?? await utils.fetchObjectWithCache(getChannelMessage, "message", messageID, 1000 * 60 * 60 * 6, channelID, messageID).catch(() => void 0)
	if (!message) return
	if (!message.reactions) message.reactions = []


	if (mode === "add" || mode === "remove") {
		if (sb.emoji !== (add ?? remove).emoji.name) return
	}

	if (mode === "add" && message.author.id === userID) snow.channel.createMessage(channelID, { content: `🚨🚨 <@${userID}> IS A THOT AND SELF-STARRED THEIR MEME 🚨🚨` }).catch(() => void 0)
	if (mode === "add" || mode === "remove") {
		const existingReaction = message.reactions.find(r => r.emoji.name === (add ?? remove).emoji.name) // add ?? remove for type safety
		if (!existingReaction && mode === "add") message.reactions.push({ count: 1, count_details: { burst: 0, normal: 0 }, me: false, me_burst: false, emoji: add.emoji, burst_colors: [] })

		if (existingReaction && !!cached) { // the message was fetched after the fact. Don't modify
			if (mode === "add") existingReaction.count++
			else existingReaction.count--
		}
	}

	if (deferedChanges.has(messageID)) return

	const reaction = message.reactions.find(r => r.emoji.name === sb.emoji)
	if (!reaction) return

	const embeddedContentToUse = message.attachments.length
		? message.attachments[0].url
		: message.embeds.find(e => e.thumbnail?.url)?.thumbnail?.url
			?? message.embeds.find(e => e.video?.url)?.video?.url

	/** @type {"image" | "video" | undefined} */
	let key

	if (embeddedContentToUse) {
		const url = new URL(embeddedContentToUse)
		const mimeMatch = mimetypeRegex.exec(url.pathname)
		if (mimeMatch) {
			const mime = mimeMatch[1].toLowerCase()
			if (imageMimes.has(mime)) key = "image"
			else if (videoMimes.has(mime)) key = "video"
		}
	}

	/** @type {Array<import("discord-api-types/v10").APIMessageTopLevelComponent>} */
	const extra = message.content.length
			? [{ type: ComponentType.TextDisplay, content: message.content.slice(0, 1899) }]
			: []

	if (key && embeddedContentToUse) {
		extra.push({
			type: ComponentType.MediaGallery,
			items: [
				{
					media: {
						url: embeddedContentToUse
					}
				}
			]
		})
	}

	/** @type {Array<import("discord-api-types/v10").APIMessageTopLevelComponent>} */
	const components = [
		{
			type: ComponentType.TextDisplay,
			content: message.author.username
		},
		...extra
	]

	/* if (key && embeddedContentToUse) {
		if (key === "video") embed.image = { url: "https://b.catgirlsare.sexy/4W4iqLSlAOWw.png" } // Discord doesn't allow video embeds
		else embed[key] = { url: embeddedContentToUse }
	}*/

	/** @type {DBStarboardMap | undefined} */
	const existingPost = await db.get("SELECT * FROM starboard_map WHERE message_id =?", [messageID])

	if (!existingPost) {
		const instantPromote = !!sb.instant_promote_role_ids?.split(",").find(r => add.member?.roles.includes(r))
		if (reaction.count >= sb.min || instantPromote) {
			components.unshift({ type: ComponentType.TextDisplay, content: utils.replace(starboardContentFormat, { "emoji": sb.emoji, "reactions": reaction.count, "jump": `https://discord.com/channels/${guildID}/${channelID}/${messageID}` }) })
			const result = await snow.channel.createMessage(sb.channel_id, { flags: MessageFlags.IsComponentsV2, components })
			db.all("INSERT INTO starboard_map (message_id, sb_message_id) VALUES (?, ?)", [message.id, result.id])
		}
	} else {
		deferedChanges.add(messageID)
		setTimeout(() => {
			const reactionUpToDate = message.reactions?.find(r => r.emoji.name === sb.emoji)
			if (reactionUpToDate) {
				components.unshift({ type: ComponentType.TextDisplay, content: utils.replace(starboardContentFormat, { "emoji": sb.emoji, "reactions": reactionUpToDate.count, "jump": `https://discord.com/channels/${guildID}/${channelID}/${messageID}` }) })
				snow.channel.editMessage(sb.channel_id, existingPost.sb_message_id, { content: null, embeds: null, flags: MessageFlags.IsComponentsV2, components }).catch(() => void 0)
			}
			deferedChanges.delete(messageID)
		}, 5000)
	}
}

/**
 * @typedef {{ guild_id: string, channel_id: string, ignore_channel_ids: string | null, emoji: string, min: number, instant_promote_role_ids: string | null }} DBStarboards
 */

/**
 * @typedef {{ message_id: string, sb_message_id: string }} DBStarboardMap
 */
