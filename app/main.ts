import * as net from "net";

const server = net.createServer((c) => {
	// 'connection' listener.
	console.log("client connected");

	c.on("end", () => {
		console.log("client disconnected");
	});
	c.write("HTTP/1.1 200 OK\r\n\r\n");
	c.pipe(c);
});

server.on("error", (err) => {
	throw err;
});

server.listen(4221, () => {
	console.log("Server is running on port 4221");
});
