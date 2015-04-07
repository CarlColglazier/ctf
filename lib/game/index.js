var p2 = require('p2'),// The physics engine.
    players = {},// Server-side storage of each player's attributes.
    x,// Used later for looping.
    y,// Used later for looping.
    TILE_SIZE = 40,
    map = [[1, 1], [1, 1]],// Default map data. Really should not ever be used.
    world = new p2.World({// Create a new world using p2.
        gravity: [0, 0]
    }),
    wall = new p2.Body({
        mass: 0,
        position: [0, 0]
    }),
    TIME_STEP = 1 / 60, // seconds
    callbacks;

callbacks = (function () {
    'use strict';
    var sockets = [];
    return {
        addSocket: function (socket) {
            sockets.push(socket);
        },
        emit: function (type, data) {
            sockets.forEach(function (socket) {
                socket.emit(type, data);
            });
        }
    };
})();

/**
 * Change the value for one of the map tiles.
 * @param {number} x - The tile's x axis coordinate.
 * @param {number} y - The tile's y axis coordinate.
 * @param {number} v - The tile's new value.
 */
function updateMap(x, y, v) {
    'use strict';
    map[x][y] = v;
    console.log(x);
    console.log(y);
    console.log(v);
    callbacks.emit('mapupdate', {
        v: v,
        x: x,
        y: y
    });
}

/**
 * Add a new circle body to the world.
 * @param {number} x - The position on the x axis (grid, not global).
 * @param {number} y - The position on the y axis (grid, not global).
 * @param {number} r - The radius of the circle.
 * @param {string} type - The type of the circle. Used to label it for collisions.
 * @param {boolean} sensor - Is this a sensor?
 * @param {number} map_id - The tile id.
 */
function addCircle(x, y, r, type, sensor, map_id) {
    'use strict';
    var new_body = new p2.Body({
            mass: 0,
            position: [x * TILE_SIZE, y * TILE_SIZE]
        }),
        new_shape = new p2.Circle(r);
    new_shape.sensor = sensor;
    new_body.identity = type;
    new_body.map_id = map_id;
    new_shape.collisionGroup = 7;
    new_body.addShape(new_shape);
    world.addBody(new_body);
}

// Declared here as the wall object is one big body.
wall.identity = 'wall';

/**
 * Add a new wall to the world.
 * @param {number} x - The position on the x axis (grid, not global).
 * @param {number} y - The position on the y axis (grid, not global).
 */
function addWall(x, y) {
    'use strict';
    var new_shape = new p2.Rectangle(TILE_SIZE, TILE_SIZE);
    wall.addShape(new_shape, [x * TILE_SIZE, y * TILE_SIZE]);
}

/**
 * Randomly select and add a powerup.
 * @param {number} x - The position on the x axis (grid, not global).
 * @param {number} y - The position on the y axis (grid, not global).
 */
function createPowerup(x, y) {
    'use strict';
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }
    var new_pup = 6 + getRandomInt(1, 4) / 10;
    addCircle(x, y, 16, 'powerup', true, new_pup);
    updateMap(x, y, new_pup);
}

/**
 * Function called when the world needs to be created.
 */
function constructWorld() {
    'use strict';
    for (x = 0; x < map.length; x++) {
        for (y = 0; y < map[x].length; y++) {
            switch (map[x][y]) {
            case 1:
                addWall(x, y);
                break;
            case 5:
                addCircle(x, y, 16, 'boost', true, map[x][y]);
                break;
            case 6:
                createPowerup(x, y);
                break;
            case 7:
                addCircle(x, y, 12, 'spike', false, map[x][y]);
                break;
            case 10:
                addCircle(x, y, 16, 'bomb', false, map[x][y]);
                break;
            default:
                break;
            }
        }
    }
    world.addBody(wall);
}

/**
 * Spawn a new player and reset physics.
 * @param body - A player.
 */
function spawn(body) {
    'use strict';
    body.position = [550, 550];
    var new_shape = new p2.Circle(19);
    new_shape.collisionGroup = 1;
    body.setZeroForce();
    body.damping = 0.6;
    body.addShape(new_shape);
}

/**
 * Create a new explosion.
 * @param {number} x - The position on the x axis (grid, not global).
 * @param {number} y - The position on the y axis (grid, not global).
 * @param {number} type - What kind of explosion is this?
 */
function explosion(x, y, type) {
    'use strict';
    var force;
    switch (type) {
    case 0:
        force = 3000;
        break;
    case 1:
        force = 8000;
        break;
    case 2:
        force = 15000;
        break;
    default:
        force = 0;
        break;
    }
    Object.keys(players).forEach(function (i) {
        var player = players[i],
            x_distance = player.body.position[0] - x,
            y_distance = player.body.position[1] - y,
            new_force = force /
                Math.pow(Math.pow(Math.abs(x_distance), 2) + Math.pow(Math.abs(y_distance), 2), 1 / 4);
        if (new_force > force) {
            return;
        }
        player.body.applyForce(
            [
                new_force * Math.cos(Math.atan2(y_distance, x_distance)),
                new_force * Math.sin(Math.atan2(y_distance, x_distance))
            ], [
                player.body.position[0],
                player.body.position[1]
            ]
        );
    });
    if (type > 0) {
        callbacks.emit('bomb', {
            x: x,
            y: y,
            type: type
        });
    }
}

/**
 * Create a new player.
 * @returns {*} - The new player's id.
 */
function addPlayer() {
    'use strict';
    var player,
        circleBody = new p2.Body({
            mass: 0.075,
            inertia: 1,
            position: [550 + Object.keys(players).length * 50, 550]
        });
    spawn(circleBody);
    circleBody.identity = 'player';
    world.addBody(circleBody);
    player = players[circleBody.id] = {};
    player.angle = circleBody.angle;
    player.body = circleBody;
    player.up = false;
    player.down = false;
    player.left = false;
    player.right = false;
    player.name = 'Some Ball';
    player.dead = false;
    player.bomb = false;
    return circleBody.id;
}

/**
 * Remove a powerup from a given player.
 * @param {object} player
 * @param {string} type - The powerup being taken away.
 */
function removePowerup(player, type) {
    'use strict';
    player[type] = false;
}

/**
 * Give a powerup to a given player.
 * @param {object} player
 * @param {string} type - The powerup being taken away.
 */
function addPowerup(player, type) {
    'use strict';
    player[type] = true;
    setTimeout(removePowerup, 20 * 1000, player, type);
}

/**
 * Take a power-up off the map.
 * @param other_body - The power-up's p2 body.
 */
function destroyPowerup(other_body) {
    'use strict';
    updateMap(Math.floor(other_body.position[0] / TILE_SIZE), Math.floor(other_body.position[1] / TILE_SIZE), 6);
    world.removeBody(other_body);
    setTimeout(createPowerup, 5 * 1000,
        Math.floor(other_body.position[0] / TILE_SIZE),
        Math.floor(other_body.position[1] / TILE_SIZE)
    );
}

/**
 * Remove a player from the face of the earth.
 * @param {number|string} id - The id of the player to be removed.
 */
function removePlayer(id) {
    'use strict';
    if (players[id]) {
        world.removeBody(players[id].body);
        delete players[id];
    }
}

/**
 * Fetch all information on the players that will be useful to the client.
 * @returns {object}
 */
function getPlayers() {
    'use strict';
    return Object.keys(players).map(function (i) {
        var player = players[i],
            body = player.body,
            player_data = {};
        player_data.team = 1;
        player_data.auth = null;
        player_data.angle = body.angle;
        player_data.bomb = player.bomb;
        player_data.dead = player.dead;
        player_data.degree = 0;
        player_data.draw = true;
        player_data.grip = player.grip;
        player_data.speed = player.speed;
        player_data.tagpro = player.tagpro;
        player_data.id = parseInt(i, 10);
        player_data.name = player.name;
        player_data.x = body.position[0];
        player_data.y = body.position[1];
        return player_data;
    });
}

/**
 * Get the current map.
 * @returns {*[]}
 */
function getMap() {
    'use strict';
    return map;
}

/**
 * Set the current map.
 * @param {*[]} new_map
 */
function setMap(new_map) {
    'use strict';
    map = new_map;
}

/**
 *
 * @param id - The player from whom we are getting key data.
 * @param {string} key - The key being changed.
 * @param {boolean} is_pressed - The new value for the key.
 */
function keyPress(id, key, is_pressed) {
    'use strict';
    var player = players[id];
    if (typeof player[key] !== 'undefined') {
        player[key] = is_pressed;
    }
}

function killPlayer(player_body) {
    'use strict';
    player_body.removeShape(player_body.shapes[0]);
    explosion(player_body.position[0], player_body.position[1], 0);// Send shrapnel.
    player_body.setZeroForce();
    player_body.damping = 1;// Make it really hard to move.
    players[player_body.id].dead = true;
    setTimeout(function (player_body) {
        spawn(player_body);
        players[player_body.id].dead = false;
    }, 3000, player_body);
}

// Called when two objects begin touching.
world.on('beginContact', function (event) {
    'use strict';

    // Ensure that player_body is a player.
    var player_body = event.bodyA.identity === 'player' ? event.bodyA : event.bodyB,
        other_body = event.bodyA.identity === 'player' ? event.bodyB : event.bodyA;
    if (player_body.identity === 'player' && other_body.identity === 'player') {

        // Rolling bomb collision.
        if (players[player_body.id].bomb === true) {
            players[player_body.id].bomb = false;
            explosion(player_body.position[0], player_body.position[1], 1);
        }
        if (players[other_body.id].bomb === true) {
            players[other_body.id].bomb = false;
            explosion(other_body.position[0], other_body.position[1], 1);
        }

        // TagPro collision.
        if (players[player_body.id].tagpro === true) {
            if (!players[other_body.id].bomb) {
                killPlayer(other_body);
            }
        }
        if (players[other_body.id].tagpro === true) {
            if (!players[player_body.id].bomb) {
                killPlayer(player_body);
            }
        }
    }
    if (player_body.identity === 'player' && other_body.identity === 'spike') {
        killPlayer(player_body);
    }
    if (player_body.identity === 'player' && other_body.identity === 'bomb') {
        explosion(other_body.position[0], other_body.position[1], 2);
    }
    if (player_body.identity === 'player' && other_body.identity === 'boost') {
        player_body.force = [
            4000 * Math.cos(
                Math.atan2(
                    player_body.velocity[1],
                    player_body.velocity[0]
                )
            ), 4000 * Math.sin(
                Math.atan2(
                    player_body.velocity[1],
                    player_body.velocity[0]
                )
            )
        ];
    }
    if (player_body.identity === 'player' && other_body.identity === 'powerup') {
        switch (other_body.map_id) {
        case 6.1:
            addPowerup(players[player_body.id], 'grip');
            break;
        case 6.2:
            addPowerup(players[player_body.id], 'bomb');
            break;
        case 6.3:
            addPowerup(players[player_body.id], 'tagpro');
            break;
        case 6.4:
            addPowerup(players[player_body.id], 'speed');
            break;
        default:
            break;
        }
        destroyPowerup(other_body);
    }
});

setInterval(function () {
    'use strict';
    world.step(TIME_STEP);// Render world.
    var FORCE_AMOUNT = 40,
        FORCE_LIMIT = 40;
    Object.keys(players).forEach(function (i) {
        var player = players[i];
        if (player.up) {
            player.body.force[1] -= FORCE_AMOUNT;
        }
        if (player.down) {
            player.body.force[1] += FORCE_AMOUNT;
        }
        if (player.right) {
            player.body.force[0] += FORCE_AMOUNT;
        }
        if (player.left) {
            player.body.force[0] -= FORCE_AMOUNT;
        }
        [0, 1].forEach(function (x) {
            if (Math.abs(player.body.force[x]) > FORCE_LIMIT) {
                player.body.force[x] = (player.body.force[x] >= 0) ? FORCE_LIMIT : -FORCE_LIMIT;
            }
        });

    });
}, TIME_STEP * 1000);

module.exports = function (settings) {
    'use strict';
    if (settings.map) {
        setMap(settings.map);
    }
    constructWorld();
    return {
        world: world,
        getPlayers: getPlayers,
        addPlayer: addPlayer,
        removePlayer: removePlayer,
        keyPress: keyPress,
        getMap: getMap,
        setMap: setMap,
        attach: callbacks.addSocket
    };
};
