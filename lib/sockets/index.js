var connections = {},// Store all socket connection.
    TIME_STEP = 1 / 60; // seconds

module.exports = function (socket, game) {
    'use strict';
    var player = connections[socket.id] = {},
        player_id = game.addPlayer(),
        players = {},
        map;

    // Heartbeat
    socket.on('p', function (data) {
        socket.emit('pr', data.id);// Return packet.
    });
    socket.emit('id', player_id);// Set the playerId.
    player.id = player_id;
    map = game.getMap();// Send the current map state.
    socket.emit('map', {
        tiles: map
    });

    // Set the score.
    socket.emit('score', {
        r: 0,
        b: 0
    });

    // TODO: implement time and stopwatch.
    // Set the time.
    socket.emit('time', {
        tile: 0,
        state: 1
    });
    setInterval(function () {
        var player_info = game.getPlayers(),
        new_info = {};
        player_info.forEach(function (i) {
            if (!players[i.id]) {
                players[i.id] = {};
            }
            var player = players[i.id];
            Object.keys(i).forEach(function (x) {
                if (player[x] !== i[x]) {
                    player[x] = i[x];
                    if (!new_info[i.id]) {
                        new_info[i.id] = {};
                        new_info[i.id].id = i.id;
                    }
                    new_info[i.id][x] = i[x];
                }
            });
        });
        socket.emit('p', Object.keys(new_info).map(function (i) {
            return new_info[i];
        }));
    }, TIME_STEP * 1000);
    socket.on('disconnect', function () {
        socket.broadcast.emit('playerLeft', player_id);// Let other clients know the player is no longer with us.
        game.removePlayer(player.id);// The server should know too.
        delete connections[socket.id];
    });

    // Handle keypresses.
    socket.on('keydown', function (key) {
        game.keyPress(player.id, key.k, true);
    });
    socket.on('keyup', function (key) {
        game.keyPress(player.id, key.k, false);
    });

    // Handle chat.
    socket.on('chat', function (chat) {
        chat.from = player_id;
        socket.emit('chat', chat);
    });
};
