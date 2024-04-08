const passthrough = require("./passthrough")

const keywords = [/how /, / get /, / download /, / ?physics/, / pro/]
const steamScamKeywords = ["50", "gift"]
const serverLinkRegex = /(?:https?:\/\/)?discord\.gg\/\w+/

const excludedRoles = ["947414444550549515", "673969281444216834", "1062898572686798960"]

const javaErrorFrameRegex = /[\t ]at ((?:\w+\.)[\w.\[\]\(\):~\? \$\/\-\+<>]+)/
const exceptionHeadRegex = /((?:[\w.]+Exception: .+)|(?:Stacktrace:))/
const optifineRegex = /\[optifine]/i
const fabricRegex = /fabric/i
const easyModListRegex = /Loading (\d+) mods:/
const fabricModsListCrashRegex = /Fabric Mods:/
const forgeModsListCrashRegex = /Mod List:/
const modAndVersionRegex1 = /([^ ]+) (.+)/
const modAndVersionRegex2 = /([^:]+): [^\d]+(.+)/
const modAndVersionRegex3 = /[^|]+\|[^|]+\|([^|]+)\|([^|]+)/
const OOMRegex = /# There is insufficient memory for the Java Runtime Environment to continue/

/** @param {number} index */
const nn1 = (index) => index !== -1
/**
 * @param {Array<number>} positions
 * @param {Array<number>} indexes
 */
const buildCase = (positions, ...indexes) => {
	const everyIsntNull = indexes.every(i => nn1(positions[i]))
	const isCloseInDistanceAndSequential = positions.filter(nn1).every((i, ind, arr) => {
		const difference = i - arr[ind - 1]
		return ind !== 0 ? (difference > 0 && difference < 10) : true
	})
	return everyIsntNull && isCloseInDistanceAndSequential
}

/**
 *
 * @param {import("cloudstorm").IGatewayDispatch} data
 */
module.exports.onGatewayDispatch = async function onGatewayDispatch(data) {
	switch (data.t) {

		case "INTERACTION_CREATE": {
			// @ts-ignore
			if (data.d.type === 2) passthrough.commands.handle(data.d, passthrough.snow)
			break
		}

		case "MESSAGE_CREATE": {
			if (data.d.author.bot) return

			if (checkHowDownloadPro(data.d)) return
			if (await checkCrashLog(data.d)) return

			if (data.d.member?.roles.some(r => excludedRoles.includes(r))) return // dont bonk admins, mods or helpers

			if (await checkScams(data.d)) return
			break
		}

		default: break
	}
}

/** @param {import("discord-api-types/v10").GatewayMessageCreateDispatchData} msg */
function checkHowDownloadPro(msg) {
	const content = msg.content.toLowerCase()
	const positions = keywords.map(word => {
		const match = word.exec(content)
		return match?.index ?? -1
	})

	const cases = [
		buildCase(positions, 0, 1, 3), // how get physics
		buildCase(positions, 0, 1, 4), // how get pro
		buildCase(positions, 0, 2, 3), // how download physics
		buildCase(positions, 0, 2, 4), // how download pro
		buildCase(positions, 1, 4), // get pro
		buildCase(positions, 2, 4) // download pro
	]

	if (cases.includes(true)) {
		passthrough.snow.channel.createMessage(msg.channel_id, {
			content: "https://discord.com/channels/231062298008092673/882927654007881778/1223817625365254174",
			message_reference: {
				message_id: msg.id,
				channel_id: msg.channel_id,
				guild_id: msg.guild_id
			}
		})
		return true
	}

	return false
}

/** @param {import("discord-api-types/v10").GatewayMessageCreateDispatchData} msg */
async function checkScams(msg) {
	if (!msg.guild_id) return false
	const content = msg.content.toLowerCase()
	const isSteamScam = steamScamKeywords.every(i => content.includes(i))
	const isServerLink = serverLinkRegex.test(content)

	if (isSteamScam || isServerLink) {
		const reason = isServerLink ? "posting a server link" : "scamming"
		const timeout = new Date()
		timeout.setDate(timeout.getDate() + 7) // 1 week timeout
		const cont = await Promise.all([
			passthrough.snow.channel.deleteMessage(msg.channel_id, msg.id, reason),
			passthrough.snow.guild.updateGuildMember(msg.guild_id, msg.author.id, {
				communication_disabled_until: timeout.toISOString()
			})
		]).then(() => true).catch(() => false)

		if (!cont) {
			console.log(`Failed to timeout user ${msg.author.username} (${msg.author.id}) for possible scam\n\n${msg.content}`)
			return true
		}

		passthrough.snow.channel.createMessage("934909491613421598", { content: `Timed out <@${msg.author.id}> for ${reason}.\n\`\`\`\n${msg.content}\`\`\`` })
		return true
	}

	return false
}

const crashLogTypes = [".txt", ".log"]

/** @param {import("discord-api-types/v10").GatewayMessageCreateDispatchData} msg */
async function checkCrashLog(msg) {
	if (crashLogTypes.find(type => msg.attachments[0]?.filename.endsWith(type))) {
		const attachment = await fetch(msg.attachments[0].url).then(r => r.text()).catch(() => "")
		const onAttachment = performCrashCheckOn(attachment)
		if (onAttachment.length) {
			sendCrashLogBreakdown(msg, attachment, onAttachment)
			return true
		}
	}

	return false
}
/** @param {string} str */
function performCrashCheckOn(str) {
	const isMC = str.includes("minecraft")
	if (!isMC) return []
	const split = str.split("\n")
	/** @type {Array<Array<string>>} */
	const errors = []
	let currentErrorsIndex = 0;
	let expectingFrame = false
	for (const element of split) {
		const head = exceptionHeadRegex.exec(element)
		if (head) {
			errors[currentErrorsIndex] = [head[1].trim()]
			expectingFrame = true
		} else {
			const match = javaErrorFrameRegex.exec(element)
			if (match) {
				if (expectingFrame) errors[currentErrorsIndex].push(match[0].trim()) // for cases where it matches regardless of being a real error
			} else {
				if (expectingFrame) currentErrorsIndex++
				expectingFrame = false
			}
		}
	}

	return errors
}
/**
 * @param {import("discord-api-types/v10").GatewayMessageCreateDispatchData} msg
 * @param {string} log
 * @param {Array<Array<string>>} errors
 */
async function sendCrashLogBreakdown(msg, log, errors) {
	const hasOptifine = optifineRegex.test(log)
	const isFML = log.includes("minecraftforge") && !log.includes("fabricmc")
	const isFabric = fabricRegex.test(log)
	/** @type {Array<{ appearances: number; frames: Array<string> }>} */
	const deduped = []
	for (const e of errors) {
		const existing = deduped.find(ex => ex.frames[0] === e[0])

		if (existing && !e[0].startsWith("Stacktrace:")) existing.appearances++
		else {
			deduped.push({ appearances: 1, frames: e })
		}
	}

	const mapped = deduped
		.slice(-4) // get last few errors
		.map(e => e.frames
			.slice(0, 4) // get first few frames including the error
			.map((i, ind) => `${ind > 0 ? "\t" : ""}${i}`)
			.join("\n")
			+ `${e.appearances > 1 ? `\n+ ${e.appearances - 1} more instance(s) of similar errors` : ""}`
		)
		.join("\n\n")
	const shouldSliceErrors = mapped.length > 1800

	const modsInfo = getModList(log)
	let totalModsLength = 0
	let indexReachingMods = -1
	for (let i = 0; i < modsInfo.mods.length; i++) {
		totalModsLength += modsInfo.mods[i].modid.length + modsInfo.mods[i].version.length + 3 // modid@version, and a space
		if (totalModsLength >= 1000 && indexReachingMods === -1) indexReachingMods = i // leaves 24 characters for "and number others"
	}

	const modsString = modsInfo.mods.length
		? `${modsInfo.mods.slice(0, indexReachingMods).map(m => `${m.modid}@${m.version}`).join(", ")}${indexReachingMods !== -1 ? ` and ${modsInfo.mods.length - (indexReachingMods + 1)} others` : ""}`
		: "Unknown"

		const isOOM = OOMRegex.test(log)
		let suspectedCause = ""
		let hasSuspected = false
		if (isOOM) {
			hasSuspected = true
			suspectedCause = "The suspected cause of crashing is out of memory. You may have a memory leak!"
		}

	await passthrough.snow.channel.createMessage(msg.channel_id, {
		content: "For ease of readability (especially on mobile), your log has been shortened to this quick breakdown (You should still send the full log in the future!)"
			+ `\`\`\`\n${shouldSliceErrors ? mapped.slice(0, 1800) + "..." : mapped}\n\`\`\``,
		embeds: [
			{
				fields: [
					...(hasSuspected ? [{
						name: "Suspected cause",
						value: suspectedCause
					}] : []),
					{
						name: "Environment info:",
						value: `Has OptiFine: ${hasOptifine}\nMod loader: ${isFML ? "Forge" : isFabric ? "Fabric" : "Other"} (Not always accurate)\nTotal mods: ${modsInfo.totalMods === 0 ? "Unknown" : modsInfo.totalMods}`
					},
					{
						name: "Mods:",
						value: modsString
					}
				]
			}
		],
		message_reference: {
			channel_id: msg.channel_id,
			message_id: msg.id,
			guild_id: msg.guild_id
		}
	})
}

/** @param {string} log */
function getModList(log) {
	/** @type {Array<{ modid: string, version: string }>} */
	const mods = [] // doesnt include bundled deps
	let totalMods = 0


	const modlistMatch1 = easyModListRegex.exec(log)
	if (modlistMatch1) {
		totalMods = Number(modlistMatch1[1])
		const afterDeclaration = log.slice(modlistMatch1.index)
		const indexOfNextOpenBracket = afterDeclaration.indexOf("[")
		const section = afterDeclaration.slice(0, indexOfNextOpenBracket === -1 ? afterDeclaration.length : indexOfNextOpenBracket)
		for (const line of section.split("\n")) {
			const trimmed = line.trim()
			if (!trimmed.startsWith("-")) continue
			const modInfo = modAndVersionRegex1.exec(trimmed.slice(2))
			if (modInfo) mods.push({ modid: modInfo[1], version: modInfo[2] })
		}
	}

	if (!mods.length) {
		mods.push(...getModsByTabWalking(log, fabricModsListCrashRegex, modAndVersionRegex2, 1, 2))
		totalMods = mods.length
	}

	if (!mods.length) {
		mods.push(...getModsByTabWalking(log, forgeModsListCrashRegex, modAndVersionRegex3, 1, 2))
		totalMods = mods.length
	}

	return { mods, totalMods }
}
/**
 * @param {string} log
 * @param {RegExp} headerRegex
 * @param {RegExp} entryRegex
 * @param {number} modIDIndex
 * @param {number} modVersionIndex
 */
function getModsByTabWalking(log, headerRegex, entryRegex, modIDIndex, modVersionIndex) {
	/** @type {Array<{ modid: string, version: string }>} */
	const mods = []
	const modslistMatch = headerRegex.exec(log)
	if (modslistMatch) {
		let numberOfTabs = 0
		let walking = true
		let index = modslistMatch.index - 1
		while (walking) {
			if (log[index] === "\t") numberOfTabs++
			else walking = false
			index--
		}
		if (numberOfTabs !== 0) {
			const split = log.split("\n")
			let foundIndex = -1
			let currentLength = 0
			for (let i = 0; i < split.length; i++) {
				currentLength += split[i].length + 1
				if (currentLength >= modslistMatch.index) {
					foundIndex = modslistMatch.index === currentLength ? i + 1 : i
					break
				}
			}
			if (foundIndex !== -1) {
				const sliced = split.slice(foundIndex + 1)
				for (const element of sliced) {
					let walking2 = true
					let amountWalked = 0
					while (walking2) {
						if (element[amountWalked] === "\t") amountWalked++
						else walking2 = false
					}
					if (amountWalked <= numberOfTabs) break
					else if (amountWalked === numberOfTabs + 1) {
						const modInfo = entryRegex.exec(element)
						if (modInfo) mods.push({ modid: modInfo[modIDIndex].trim(), version: modInfo[modVersionIndex].trim() })
					}
				}
			}
		}
	}
	return mods
}
