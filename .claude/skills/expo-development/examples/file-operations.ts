import { Directory, File, Paths } from "expo-file-system";
import { PDFDocument } from "pdf-lib";

// Reading files as bytes (NO base64!)
async function readFileAsBytes(filePath: string): Promise<Uint8Array> {
	const file = new File(filePath);
	const buffer = await file.arrayBuffer();
	return new Uint8Array(buffer);
}

// Reading files as text
async function readFileAsText(filePath: string): Promise<string> {
	const file = new File(filePath);
	return await file.text();
}

// Synchronous byte reading (when async isn't possible)
function readFileBytesSync(filePath: string): Uint8Array {
	const file = new File(filePath);
	return file.bytesSync();
}

// Writing bytes directly (NO base64!)
function writeBytes(outputPath: string, data: Uint8Array): void {
	const file = new File(outputPath);
	file.create({ intermediates: true });
	file.write(data);
}

// Writing text
function writeText(outputPath: string, text: string): void {
	const file = new File(outputPath);
	file.create({ intermediates: true });
	file.write(text);
}

// Large file handling with FileHandle
async function writeLargeFile(
	outputPath: string,
	chunks: Uint8Array[],
): Promise<void> {
	const file = new File(outputPath);
	file.create({ intermediates: true });

	const handle = file.open();
	handle.offset = 0;

	for (const chunk of chunks) {
		handle.writeBytes(chunk);
	}

	handle.close();
}

// PDF processing example
async function processPDF(pdfPath: string): Promise<Uint8Array> {
	const pdfFile = new File(pdfPath);
	const buffer = await pdfFile.arrayBuffer();
	const pdfBytes = new Uint8Array(buffer);

	const pdfDoc = await PDFDocument.load(pdfBytes);
	const pageCount = pdfDoc.getPageCount();
	console.log(`PDF has ${pageCount} pages`);

	const modifiedBytes = await pdfDoc.save();
	return modifiedBytes;
}

// Directory operations
function createDirectory(dirName: string): void {
	const dir = new Directory(Paths.document, dirName);
	dir.create();
}

async function listDirectory(dirPath: string): Promise<string[]> {
	const dir = new Directory(dirPath);
	return await dir.list();
}

// File metadata
function getFileInfo(filePath: string): {
	size: number;
	exists: boolean;
	uri: string;
} {
	const file = new File(filePath);
	return {
		size: file.size,
		exists: file.exists,
		uri: file.uri,
	};
}

export {
	readFileAsBytes,
	readFileAsText,
	readFileBytesSync,
	writeBytes,
	writeText,
	writeLargeFile,
	processPDF,
	createDirectory,
	listDirectory,
	getFileInfo,
};
