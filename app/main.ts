import * as net from "net";

const server = net.createServer((socket) => {
	console.log("client connected");

	socket.on("end", () => {
		console.log("client disconnected");
	});

	socket.on("data", (data) => {
		const request = data.toString();
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

		if (method === "GET") {
			if (url === "/" || url === "/index.html") {
				const body =
					"<html><body><h1>Welcome to the home page!</h1></body></html>";
				socket.write("HTTP/1.1 200 OK\r\n");
				socket.write("Content-Type: text/html\r\n");
				socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
				socket.write(body);
			} else if (url.startsWith("/echo/")) {
				const echoStr = url.slice(6);
				socket.write("HTTP/1.1 200 OK\r\n");
				socket.write("Content-Type: text/plain\r\n");
				socket.write(`Content-Length: ${Buffer.byteLength(echoStr)}\r\n\r\n`);
				socket.write(echoStr);
			} else if (url === "/user-agent") {
				const userAgent = headers["user-agent"] || "";
				socket.write("HTTP/1.1 200 OK\r\n");
				socket.write("Content-Type: text/plain\r\n");
				socket.write(`Content-Length: ${Buffer.byteLength(userAgent)}\r\n\r\n`);
				socket.write(userAgent);
			} else {
				const body = "<html><body><h1>404 Not Found</h1></body></html>";
				socket.write("HTTP/1.1 404 Not Found\r\n");
				socket.write("Content-Type: text/html\r\n");
				socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
				socket.write(body);
			}
		} else {
			const body = "<html><body><h1>405 Method Not Allowed</h1></body></html>";
			socket.write("HTTP/1.1 405 Method Not Allowed\r\n");
			socket.write("Content-Type: text/html\r\n");
			socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
			socket.write(body);
		}
		socket.end();
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
