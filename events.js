const passthrough = require("./passthrough")

const { sync, snow, cloud, db } = passthrough

/** @type {typeof import("./utils")} */
const utils = sync.require("./utils")

/** @type {typeof snow.channel.getChannelMessage} */
const getChannelMessage = snow.channel.getChannelMessage.bind(snow.channel)

const starboardContentFormat = "%emoji %reactions %jump"

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

				if (!data.d.guild_id) return
				/** @type {DBStarboards | undefined} */
				const sb = await db.get("SELECT * FROM starboards WHERE guild_id =?", [data.d.guild_id])
				if (sb && !sb.ignore_channel_ids?.split(",").includes(data.d.channel_id)) utils.setCachedObject("message", data.d.id, data.d, 1000 * 60 * 60 * 2)

				if (utils.checkTriggers(data.d)) return
				if (await utils.checkCrashLog(data.d)) return
				break
			}

			case "MESSAGE_REACTION_ADD": {
				/** @type {import("discord-api-types/v10").APIMessage | null} */
				const cached = utils.getCachedObject("message", data.d.message_id)
				if (cached) {
					if (cached.author.id === data.d.user_id) return snow.channel.createMessage(data.d.channel_id, { content: `🚨🚨 <@${data.d.user_id}> IS A THOT AND SELF-STARRED THEIR MEME 🚨🚨` })

					const existingReaction = cached.reactions?.find(r => r.emoji.name === data.d.emoji.name)
					if (!existingReaction) {
						if (!cached.reactions) cached.reactions = []
						cached.reactions.push({ count: 1, count_details: { burst: 0, normal: 0 }, me: false, me_burst: false, emoji: data.d.emoji, burst_colors: [] })
					} else existingReaction.count++
				}

				if (!data.d.member?.user) return
				if (data.d.member.user.bot) return

				/** @type {DBStarboards | undefined} */
				const sb = await db.get("SELECT * FROM starboards WHERE guild_id =?", [data.d.guild_id])
				if (!sb) return

				if (sb.emoji !== data.d.emoji.name) return
				const ignored = sb.ignore_channel_ids?.split(",") ?? []
				if (ignored.includes(data.d.channel_id)) return

				const message = cached ?? await utils.fetchObjectWithCache(getChannelMessage, "message", data.d.message_id, 1000 * 60 * 60 * 12, data.d.channel_id, data.d.message_id)
				if (!message?.reactions) return
				if (message.author.bot) return

				const reaction = message.reactions.find(r => r.emoji.name === data.d.emoji.name)
				if (!reaction) return

				const instantPromote = !!(sb.instant_promote_role_ids?.split(",") ?? []).find(r => data.d.member?.roles.includes(r))

				/** @type {DBStarboardMap | undefined} */
				const existingPost = await db.get("SELECT * FROM starboard_map WHERE message_id =?", [data.d.message_id])
				const content = utils.replace(starboardContentFormat, { "emoji": sb.emoji, "reactions": reaction.count, "jump": `https://discord.com/channels/${data.d.guild_id}/${data.d.channel_id}/${data.d.message_id}` })
				if (existingPost) snow.channel.editMessage(sb.channel_id, existingPost.sb_message_id, { content })
				else if (reaction.count >= sb.min || instantPromote) {
					const result = await snow.channel.createMessage(sb.channel_id, {
						content,
						embeds: [
							{
								author: {
									name: message.author.username
								},
								description: message.content.length ? message.content : undefined,
								image: message.attachments.length ? { url: message.attachments[0].url, proxy_url: message.attachments[0].proxy_url } : undefined
							}
						]
					})
					db.all("INSERT INTO starboard_map (message_id, sb_message_id) VALUES (?, ?)", [message.id, result.id])
				}
				break
			}

			case "MESSAGE_REACTION_REMOVE": {
				/** @type {import("discord-api-types/v10").APIMessage | null} */
				const cached = utils.getCachedObject("message", data.d.message_id)
				if (cached) {
					if (cached.author.id === data.d.user_id) return
					const existingReaction = cached.reactions?.find(r => r.emoji.name === data.d.emoji.name)
					if (existingReaction) existingReaction.count--
				}

				/** @type {DBStarboards | undefined} */
				const sb = await db.get("SELECT * FROM starboards WHERE guild_id =?", [data.d.guild_id])
				if (!sb) return

				if (sb.emoji !== data.d.emoji.name) return
				const ignored = sb.ignore_channel_ids?.split(",") ?? []
				if (ignored.includes(data.d.channel_id)) return

				/** @type {DBStarboardMap | undefined} */
				const existingPost = await db.get("SELECT * FROM starboard_map WHERE message_id =?", [data.d.message_id])

				if (existingPost) {
					const message = cached ?? await utils.fetchObjectWithCache(getChannelMessage, "message", data.d.message_id, 1000 * 60 * 60 * 12, data.d.channel_id, data.d.message_id)
					if (!message?.reactions) return

					const reaction = message.reactions.find(r => r.emoji.name === data.d.emoji.name)
					if (!reaction) return

					const content = utils.replace(starboardContentFormat, { "emoji": sb.emoji, "reactions": reaction.count, "jump": `https://discord.com/channels/${data.d.guild_id}/${data.d.channel_id}/${data.d.message_id}` })
					snow.channel.editMessage(sb.channel_id, existingPost.message_id, { content })
				}
				break
			}

			default: break
		}
	}
)

/**
 * @typedef {{ guild_id: string, channel_id: string, ignore_channel_ids: string | null, emoji: string, min: number, instant_promote_role_ids: string | null }} DBStarboards
 */

/**
 * @typedef {{ message_id: string, sb_message_id: string }} DBStarboardMap
 */
