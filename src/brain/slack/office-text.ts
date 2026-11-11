// Turns Excel, Word and CSV files from Slack into plain text the model can read.
// .xlsx and .docx are zip files of XML, so a small unzip + tag strip is enough.

export const MAX_FILE_TEXT_CHARS = 60_000

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export type TextFileKind = "xlsx" | "docx" | "text"

export function textFileKind(name: string, mimetype?: string): TextFileKind | undefined {
	const type = (mimetype ?? "").toLowerCase()
	const ext = name.toLowerCase().split(".").pop() ?? ""
	if (type === XLSX || ext === "xlsx") return "xlsx"
	if (type === DOCX || ext === "docx") return "docx"
	if (["csv", "tsv", "txt", "md", "json"].includes(ext) || type.startsWith("text/")) return "text"
	return undefined
}

export async function fileToText(kind: TextFileKind, bytes: Uint8Array): Promise<string> {
	const text =
		kind === "text"
			? new TextDecoder().decode(bytes)
			: kind === "docx"
				? docxText(await unzip(bytes))
				: xlsxText(await unzip(bytes))
	return text.length > MAX_FILE_TEXT_CHARS
		? `${text.slice(0, MAX_FILE_TEXT_CHARS)}\n[cut: file is longer than ${MAX_FILE_TEXT_CHARS} characters]`
		: text
}

// Reads every entry of a zip through its central directory.
async function unzip(b: Uint8Array): Promise<Map<string, string>> {
	const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
	let end = b.byteLength - 22
	while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--
	if (end < 0) throw new Error("not a zip file")
	const count = view.getUint16(end + 10, true)
	let at = view.getUint32(end + 16, true)
	const files = new Map<string, string>()
	for (let i = 0; i < count; i++) {
		if (view.getUint32(at, true) !== 0x02014b50) break
		const method = view.getUint16(at + 10, true)
		const size = view.getUint32(at + 20, true)
		const nameLen = view.getUint16(at + 28, true)
		const skip = nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
		const local = view.getUint32(at + 42, true)
		const name = new TextDecoder().decode(b.subarray(at + 46, at + 46 + nameLen))
		at += 46 + skip
		if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
		const raw = b.subarray(start, start + size)
		const data =
			method === 0
				? raw
				: new Uint8Array(
						await new Response(
							new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
						).arrayBuffer(),
					)
		files.set(name, new TextDecoder().decode(data))
	}
	return files
}

function decodeXml(s: string): string {
	return s
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&")
}

function docxText(files: Map<string, string>): string {
	const xml = files.get("word/document.xml") ?? ""
	return decodeXml(
		xml
			.replace(/<w:tab\/>/g, "\t")
			.replace(/<w:br\/>/g, "\n")
			.replace(/<\/w:tc>/g, " | ")
			.replace(/<\/w:p>/g, "\n")
			.replace(/<[^>]+>/g, ""),
	)
		.replace(/\n{3,}/g, "\n\n")
		.trim()
}

function columnIndex(ref: string): number {
	let n = 0
	for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64)
	return n - 1
}

function xlsxText(files: Map<string, string>): string {
	const shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
		(m) => decodeXml([...(m[1] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
	)
	const targets = new Map(
		[...(files.get("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship[^>]*>/g)].map((m) => [
			/Id="([^"]+)"/.exec(m[0])?.[1],
			/Target="([^"]+)"/.exec(m[0])?.[1]?.replace(/^\/?(xl\/)?/, "xl/"),
		]),
	)
	const out: string[] = []
	for (const m of (files.get("xl/workbook.xml") ?? "").matchAll(/<sheet [^>]*>/g)) {
		const name = decodeXml(/name="([^"]*)"/.exec(m[0])?.[1] ?? "")
		const path = targets.get(/r:id="([^"]+)"/.exec(m[0])?.[1])
		const xml = path ? files.get(path) : undefined
		if (!xml) continue
		out.push(`## Sheet: ${name}`)
		for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
			const cells: string[] = []
			for (const c of (row[1] ?? "").matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
				const attrs = c[1] ?? ""
				const body = c[2] ?? ""
				const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]
				const type = /t="([^"]+)"/.exec(attrs)?.[1]
				const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
				const value =
					type === "s"
						? (shared[Number(v)] ?? "")
						: type === "inlineStr"
							? decodeXml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""))
							: decodeXml(v ?? "")
				cells[ref ? columnIndex(ref) : cells.length] = value
			}
			const line = Array.from(cells, (x) => x ?? "").join(" | ")
			if (line.replace(/[ |]/g, "")) out.push(line)
		}
	}
	return out.join("\n")
}
