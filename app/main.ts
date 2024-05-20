import * as fs from "fs";
import * as net from "net";
import * as path from "path";

// Function to display help message
function displayHelp() {
	console.log(`Usage: node main.js [--directory <directory>] [--help | -h]

Options:
  --directory <directory>  Serve files from the specified directory.
  --help, -h               Show this help message and exit.
`);
	process.exit(0);
}

// Parse command line arguments
const args = process.argv.slice(2);
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

const server = net.createServer((socket) => {
	console.log("client connected");

	socket.on("end", () => {
		console.log("client disconnected");
	});

	let dataBuffer = "";

	socket.on("data", (chunk) => {
		dataBuffer += chunk.toString();
		const requestEnd = dataBuffer.indexOf("\r\n\r\n");
		if (requestEnd !== -1) {
			const request = dataBuffer.slice(0, requestEnd);
			const requestBody = dataBuffer.slice(requestEnd + 4);
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

			const acceptEncoding = headers["accept-encoding"] || "";
			const encodings = acceptEncoding.split(",").map((enc) => enc.trim());
			const supportsGzip = encodings.includes("gzip");

			if (method === "GET") {
				if (url.startsWith("/echo/")) {
					const echoStr = url.slice(6);
					socket.write("HTTP/1.1 200 OK\r\n");
					if (supportsGzip) {
						socket.write("Content-Encoding: gzip\r\n");
					}
					socket.write("Content-Type: text/plain\r\n");
					socket.write(`Content-Length: ${Buffer.byteLength(echoStr)}\r\n\r\n`);
					socket.write(echoStr);
				} else if (url === "/" || url === "/index.html") {
					const body =
						"<html><body><h1>Welcome to the home page!</h1></body></html>";
					socket.write("HTTP/1.1 200 OK\r\n");
					socket.write("Content-Type: text/html\r\n");
					socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
					socket.write(body);
				} else if (url === "/user-agent") {
					const userAgent = headers["user-agent"] || "";
					socket.write("HTTP/1.1 200 OK\r\n");
					socket.write("Content-Type: text/plain\r\n");
					socket.write(
						`Content-Length: ${Buffer.byteLength(userAgent)}\r\n\r\n`,
					);
					socket.write(userAgent);
				} else if (url.startsWith("/files/")) {
					const filePath = path.join(directory, url.slice(7));
					fs.readFile(filePath, (err, fileData) => {
						if (err) {
							const body = "404 Not Found";
							socket.write("HTTP/1.1 404 Not Found\r\n");
							socket.write("Content-Type: text/html\r\n");
							socket.write(
								`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`,
							);
							socket.write(body);
						} else {
							socket.write("HTTP/1.1 200 OK\r\n");
							socket.write("Content-Type: application/octet-stream\r\n");
							socket.write(`Content-Length: ${fileData.length}\r\n\r\n`);
							socket.write(fileData);
						}
						socket.end();
					});
					return;
				} else {
					const body = "<html><body><h1>404 Not Found</h1></body></html>";
					socket.write("HTTP/1.1 404 Not Found\r\n");
					socket.write("Content-Type: text/html\r\n");
					socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
					socket.write(body);
				}
			} else if (method === "POST") {
				if (url.startsWith("/files/")) {
					const filePath = path.join(directory, url.slice(7));
					fs.writeFile(filePath, requestBody, (err) => {
						if (err) {
							console.error("File write error:", err);
							socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
						} else {
							socket.write("HTTP/1.1 201 Created\r\n\r\n");
						}
						socket.end();
					});
					return;
				}

				socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
				socket.end();
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
