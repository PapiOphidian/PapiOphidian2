const passthrough = require("./passthrough")
const { snow, caches } = passthrough


/** @param {number} index */
const nn1 = (index) => index !== -1
module.exports.nn1 = nn1


/**
 * @param {Array<number>} positions
 * @param {Array<number>} indexes
 */
function buildCase(positions, maxDistance = 10, ...indexes) {
	// allow for short circuiting
	const careAbout = indexes.map(i => positions[i])
	return careAbout.every(i => nn1(i))
		&& (maxDistance !== - 1
			? careAbout.every((i, ind) => {
					if (ind === 0) return true
					const difference = i - careAbout[ind - 1]
					return difference > 0 && difference < maxDistance
				})
			: true)
}
module.exports.buildCase = buildCase


/**
 * @param {import("discord-api-types/v10").GatewayMessageCreateDispatchData} msg
 * @param {Record<string, {
 * 	guild?: string,
 * 	ignoreRoles?: Array<string>,
 * 	matchers: Array<RegExp>,
 * 	test: (positions: Array<number>) => boolean,
 * 	trigger: (message: import("discord-api-types/v10").GatewayMessageCreateDispatchData) => unknown
 * }>} triggerMap
 */
function checkTriggers(msg, triggerMap) {
	for (const entry of Object.values(triggerMap)) {
		if (msg.guild_id && entry.guild && entry.guild !== msg.guild_id) continue
		if (entry.ignoreRoles?.find(r => msg.member?.roles.includes(r))) continue
		const positions = entry.matchers.map(matcher => {
			const match = matcher.exec(msg.content)
			return match?.index ?? -1
		})
		const triggers = entry.test(positions)
		if (triggers) {
			entry.trigger(msg)
			return true
		}
	}

	return false
}
module.exports.checkTriggers = checkTriggers


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
module.exports.checkCrashLog = checkCrashLog


const javaErrorFrameRegex = /[\t ]at ((?:\w+\.)?[\w\.[\]():~? $/\-+<>%!/{},@]+)/
const exceptionHeadRegex = /((?:[\w.]+Exception: .+)|(?:Stacktrace:))/
/** @param {string} str */
function performCrashCheckOn(str) {
	const isMC = str.includes("minecraft")
	if (!isMC) return []
	const split = str.split("\n")
	/** @type {Array<Array<string>>} */
	const errors = []
	let currentErrorsIndex = 0
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


const clientBrandRegex = /Client brand changed to '([^']+)'/
const optifineRegex = /\[optifine]/i
const fabricRegex = /fabric/i
const OOMRegex = /# There is insufficient memory for the Java Runtime Environment to continue/
/**
 * @param {import("discord-api-types/v10").GatewayMessageCreateDispatchData} msg
 * @param {string} log
 * @param {Array<Array<string>>} errors
 */
async function sendCrashLogBreakdown(msg, log, errors) {
	const hasOptifine = optifineRegex.test(log)
	let estimatedBrand = "Other"
	let estimated = true
	const brand = clientBrandRegex.exec(log)
	if (brand) {
		estimatedBrand = brand[1][0].toUpperCase() + brand[1].slice(1).toLowerCase()
		estimated = false
	} else {
		const isFML = log.includes("minecraftforge") && !log.includes("fabricmc")
		const isFabric = fabricRegex.test(log)
		estimatedBrand = isFML ? "Forge" : isFabric ? "Fabric" : estimatedBrand
	}
	/** @type {Array<{ appearances: number, frames: Array<string> }>} */
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
		if (totalModsLength >= 1000 && indexReachingMods === -1) {
			indexReachingMods = i // leaves 24 characters for "and number others"
			break
		}
	}

	const modsString = modsInfo.mods.length
		? `${modsInfo.mods.slice(0, indexReachingMods).map(m => `${m.modid}@${m.version}`).join(", ")}${indexReachingMods !== -1 ? ` and ${modsInfo.mods.length - (indexReachingMods + 1)} others` : ""}`
		: "Unknown"

	const physicsModVersion = modsInfo.mods.find(m => m.modid === "physicsmod")?.version ?? (modsInfo.mods.length ? "Not present" : "Unknown")

	const isOOM = OOMRegex.test(log)
	let suspectedCause = ""
	let hasSuspected = false
	if (isOOM) {
		hasSuspected = true
		suspectedCause = "The suspected cause of crashing is out of memory. You may have a memory leak!"
	}

	await snow.channel.createMessage(msg.channel_id, {
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
						value: `Has OptiFine: ${hasOptifine}\nMod loader: ${estimatedBrand}${estimated ? " (Not always accurate)" : " (Definitely. Client branding changed)"}\nTotal mods: ${modsInfo.totalMods === 0 ? "Unknown" : modsInfo.totalMods}`
					},
					{
						name: "Physics Mod version",
						value: physicsModVersion
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


const easyModListRegex = /Loading (\d+) mods:/
const modAndVersionRegex1 = /([^ ]+) (.+)/
const fabricModsListCrashRegex = /Fabric Mods:/
const forgeModsListCrashRegex = /Mod List:/
const modAndVersionRegex2 = /([^:]+): [^\d]+(.+)/
const modAndVersionRegex3 = /[^|]+\|[^|]+\|([^|]+)\|([^|]+)/
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

/**
 * @template T
 * @param {string} namespace
 * @param {string} key
 * @returns {T | null}
 */
function getCachedObject(namespace, key) {
	/** @type {T | null} */
	const existing = caches[namespace]?.get(key)
	return existing
}
module.exports.getCachedObject = getCachedObject

/**
 * @param {string} namespace
 * @param {string} key
 * @param {any} value
 * @param {number} [expires] When this Object should be deleted in ms
 */
function setCachedObject(namespace, key, value, expires) {
	if (!caches[namespace]) caches[namespace] = new Map()
	caches[namespace].set(key, value)
	if (expires !== undefined) setTimeout(deleteCachedObject, expires, namespace, key)
}
module.exports.setCachedObject = setCachedObject

/**
 * @param {string} namespace
 * @param {string} key
 */
function deleteCachedObject(namespace, key) {
	caches[namespace]?.delete(key)
}
module.exports.deleteCachedObject = deleteCachedObject

/**
 * @template {Array<any>} TArgs
 * @template T
 * @param {(...args: TArgs) => Promise<T>} func
 * @param {string} namespace
 * @param {string} key
 * @param {number | undefined} deleteAfter
 * @param {TArgs} targs
 * @returns {Promise<Awaited<T> | null>}
 */
async function fetchObjectWithCache(func, namespace, key, deleteAfter, ...targs) {
	/** @type {Awaited<T> | null} */
	const existing = getCachedObject(namespace, key)
	if (existing) return existing
	const fetched = await func(...targs).catch(() => null)
	if (!fetched) return null
	setCachedObject(namespace, key, fetched, deleteAfter)
	return fetched
}
module.exports.fetchObjectWithCache = fetchObjectWithCache

/**
 * A function to replace wildcard (%variable) strings with information from runtime
 * @param {string} string The string from lang
 * @param {{[variable: string]: any}} properties example: `{ "username": "PapiOphidian" }`
 * @returns {string}
 */
function replace(string, properties = {}) {
	let value = string.slice(0, string.length)
	Object.keys(properties).forEach(item => {
		let index
		while ((index = value.indexOf(`%${item}`)) !== -1) {
			value = value.slice(0, index) + properties[item] + value.slice(index + item.length + 1)
		}
	})
	return value
}
module.exports.replace = replace

/**
 * @template T
 * @typedef {T extends Array<infer I> ? I : never} UnpackArray
 */
