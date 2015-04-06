var sockets = require('./lib/sockets'),
    game = require('./lib/game');

module.exports = function (socket, settings) {
    'use strict';
    var current_game = game(settings);// Prepare the game.
    sockets(socket, current_game);// Connect socket.io to the game.
};
