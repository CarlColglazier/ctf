# ctf

ctf is a "capture the flag" implementation designed to be used with [socket.io](http://socket.io/).

## Installation

To install, simply declare `ctf` as a dependency through command line.

`npm install ctf --save`

## Usage

Here is an example of ctf in action using [Hapi](http://hapijs.com) and socket.io:

```
var Hapi = require('hapi'),
    sockets = require('socket.io'),
    ctf = require('ctf'),
    io,
    settings,
    server;

settings = {
    map: [[1, 1,], [1, 1]]// Create the map
};

server = new Hapi.Server();// Create the server.
server.connection({ port: 8000});// Add a connection on port 8000.
io = sockets(server.listener);// Pass the server into socket.io.
io.on('connection', function (socket) {// When a client connects
    ctf(socket, settings);// Pass the socket to ctf.
});
```
