import * as net from "net";

const server = net.createServer((socket) => {
	console.log("client connected");

	socket.on("end", () => {
		console.log("client disconnected");
	});

	socket.on("data", (data) => {
		const request = data.toString();
		const requestLine = request.split("\r\n")[0];
		const [method, url] = requestLine.split(" ");

		if (method === "GET") {
			if (url === "/" || url === "/index.html") {
				socket.write("HTTP/1.1 200 OK\r\n\r\n");
				socket.write(
					"<html><body><h1>Welcome to the home page!</h1></body></html>",
				);
			} else {
				socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
				socket.write("<html><body><h1>404 Not Found</h1></body></html>");
			}
		} else {
			socket.write("HTTP/1.1 405 Method Not Allowed\r\n\r\n");
			socket.write("<html><body><h1>405 Method Not Allowed</h1></body></html>");
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
