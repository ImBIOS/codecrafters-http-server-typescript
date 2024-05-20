import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

// Type definitions for HTTP request and headers
interface HttpRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body: string;
}

// Function to display help message
function displayHelp(): void {
	console.log(`Usage: bun run main.ts [--directory <directory>] [--help | -h]

Options:
  --directory <directory>  Serve files from the specified directory.
  --help, -h               Show this help message and exit.
`);
	process.exit(0);
}

// Function to parse command line arguments
function parseArguments(args: string[]): string {
	let directory = process.cwd(); // Default directory

	if (args.includes("--help") || args.includes("-h")) {
		displayHelp();
	}

	const directoryFlagIndex = args.indexOf("--directory");
	if (directoryFlagIndex !== -1 && directoryFlagIndex < args.length - 1) {
		directory = args[directoryFlagIndex + 1];
	} else if (directoryFlagIndex !== -1) {
		console.error("Error: --directory flag requires a directory path");
		displayHelp();
	}

	return directory;
}

// Function to parse HTTP request from raw data
function parseHttpRequest(data: string): HttpRequest {
	const requestEnd = data.indexOf("\r\n\r\n");
	const request = data.slice(0, requestEnd);
	const requestBody = data.slice(requestEnd + 4);
	const requestLines = request.split("\r\n");
	const requestLine = requestLines[0];
	const [method, url] = requestLine.split(" ");

	const headers = requestLines.slice(1).reduce(
		(acc, line) => {
			if (line.includes(": ")) {
				const [key, value] = line.split(": ");
				acc[key.toLowerCase()] = value;
			}
			return acc;
		},
		{} as Record<string, string>,
	);

	return { method, url, headers, body: requestBody };
}

// Function to handle HTTP GET requests
function handleGetRequest(
	socket: net.Socket,
	request: HttpRequest,
	directory: string,
): void {
	const { url, headers } = request;
	const acceptEncoding = headers["accept-encoding"] || "";
	const encodings = acceptEncoding.split(",").map((enc) => enc.trim());
	const supportsGzip = encodings.includes("gzip");

	if (url.startsWith("/echo/")) {
		const echoStr = url.slice(6);
		const respond = (body: Buffer) => {
			socket.write("HTTP/1.1 200 OK\r\n");
			if (supportsGzip) {
				socket.write("Content-Encoding: gzip\r\n");
			}
			socket.write("Content-Type: text/plain\r\n");
			socket.write(`Content-Length: ${body.length}\r\n\r\n`);
			socket.write(body);
			socket.end();
		};

		if (supportsGzip) {
			zlib.gzip(echoStr, (err, gzipBuffer) => {
				if (err) {
					console.error("Gzip error:", err);
					socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
					socket.end();
				} else {
					respond(gzipBuffer);
				}
			});
		} else {
			respond(Buffer.from(echoStr));
		}
	} else if (url === "/" || url === "/index.html") {
		const body = "<html><body><h1>Welcome to the home page!</h1></body></html>";
		socket.write("HTTP/1.1 200 OK\r\n");
		socket.write("Content-Type: text/html\r\n");
		socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
		socket.write(body);
		socket.end();
	} else if (url === "/user-agent") {
		const userAgent = headers["user-agent"] || "";
		socket.write("HTTP/1.1 200 OK\r\n");
		socket.write("Content-Type: text/plain\r\n");
		socket.write(`Content-Length: ${Buffer.byteLength(userAgent)}\r\n\r\n`);
		socket.write(userAgent);
		socket.end();
	} else if (url.startsWith("/files/")) {
		const filePath = path.join(directory, url.slice(7));
		fs.readFile(filePath, (err, fileData) => {
			if (err) {
				const body = "404 Not Found";
				socket.write("HTTP/1.1 404 Not Found\r\n");
				socket.write("Content-Type: text/html\r\n");
				socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
				socket.write(body);
			} else {
				socket.write("HTTP/1.1 200 OK\r\n");
				socket.write("Content-Type: application/octet-stream\r\n");
				socket.write(`Content-Length: ${fileData.length}\r\n\r\n`);
				socket.write(fileData);
			}
			socket.end();
		});
	} else {
		const body = "<html><body><h1>404 Not Found</h1></body></html>";
		socket.write("HTTP/1.1 404 Not Found\r\n");
		socket.write("Content-Type: text/html\r\n");
		socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
		socket.write(body);
		socket.end();
	}
}

// Function to handle HTTP POST requests
function handlePostRequest(
	socket: net.Socket,
	request: HttpRequest,
	directory: string,
): void {
	const { url, body } = request;

	if (url.startsWith("/files/")) {
		const filePath = path.join(directory, url.slice(7));
		fs.writeFile(filePath, body, (err) => {
			if (err) {
				console.error("File write error:", err);
				socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
			} else {
				socket.write("HTTP/1.1 201 Created\r\n\r\n");
			}
			socket.end();
		});
	} else {
		socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
		socket.end();
	}
}

// Main server logic
const args = process.argv.slice(2);
const directory = parseArguments(args);

const server = net.createServer((socket) => {
	console.log("Client connected");

	socket.on("end", () => {
		console.log("Client disconnected");
	});

	let dataBuffer = "";

	socket.on("data", (chunk) => {
		dataBuffer += chunk.toString();
		const requestEnd = dataBuffer.indexOf("\r\n\r\n");
		if (requestEnd !== -1) {
			const request = parseHttpRequest(dataBuffer);
			dataBuffer = ""; // Reset buffer for next request

			if (request.method === "GET") {
				handleGetRequest(socket, request, directory);
			} else if (request.method === "POST") {
				handlePostRequest(socket, request, directory);
			} else {
				const body =
					"<html><body><h1>405 Method Not Allowed</h1></body></html>";
				socket.write("HTTP/1.1 405 Method Not Allowed\r\n");
				socket.write("Content-Type: text/html\r\n");
				socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
				socket.write(body);
				socket.end();
			}
		}
	});

	socket.on("error", (err) => {
		console.error("Socket error:", err);
	});
});

server.on("error", (err) => {
	throw err;
});

server.listen(4221, () => {
	console.log("Server is running on port 4221");
});
