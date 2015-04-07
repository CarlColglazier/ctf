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
    callbacks,
    score = {
        r: 0,
        b: 0
    };

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
    callbacks.emit('mapupdate', {
        v: v,
        x: x,
        y: y
    });
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
    addCircle(x, y, 15, 'powerup', true, new_pup);
    updateMap(x, y, new_pup);
}

/**
 * Create a new bomb and add it to the map.
 * @param {number} x - The position on the x axis (grid, not global).
 * @param {number} y - The position on the y axis (grid, not global).
 */
function addBomb(x, y) {
    'use strict';
    addCircle(x, y, 15, 'bomb', false, 10);
    updateMap(x, y, 10);
}

/**
 * Take a bomb off the map.
 * @param other_body - The bomb's p2 body.
 */
function removeBomb(other_body) {
    'use strict';
    var x = Math.floor(other_body.position[0] / TILE_SIZE),
        y = Math.floor(other_body.position[1] / TILE_SIZE);
    explosion(other_body.position[0], other_body.position[1], 2);
    updateMap(x, y, 10.1);
    world.removeBody(other_body);
    setTimeout(addBomb, 30 * 1000,
        x, y
    );
}

/**
 * Create a new flag and add it to the map.
 * @param {number} x
 * @param {number} y
 * @param {number} team
 */
function addFlag(x, y, team) {
    'use strict';
    updateMap(x, y, (team === 1) ? 3 : 4);
    addCircle(x, y, 15, 'flag', true, map[x][y]);
}

/**
 * Grab a flag.
 * @param {number} player_id
 * @param {object} flag_object
 */
function playerGrab(player_id, flag_object) {
    'use strict';
    players[player_id].flag = flag_object.map_id - 2;
    players[player_id].flag_object = flag_object;
    updateMap(Math.floor(flag_object.position[0] / TILE_SIZE),
        Math.floor(flag_object.position[1] / TILE_SIZE),
        flag_object.map_id + 0.1);
}

/**
 * Drop the flag.
 * @param {number} player_id
 */
function removePlayerFlag(player_id) {
    'use strict';
    players[player_id].flag = null;
    updateMap(Math.floor(players[player_id].flag_object.position[0] / TILE_SIZE),
        Math.floor(players[player_id].flag_object.position[1] / TILE_SIZE),
        players[player_id].flag_object.map_id);
    delete players[player_id].flag_object;
}

/**
 * Score a point and return the flag.
 * @param {number} player_id
 */
function playerCapture(player_id) {
    'use strict';
    removePlayerFlag(player_id);
    players[player_id]['s-captures'] += 1;
    if (players[player_id].team === 1) {
        score.r += 1;
    } else if (players[player_id].team === 2) {
        score.b += 1;
    }
    callbacks.emit('score', score);
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
            case 3:
                addFlag(x, y, 1);
                break;
            case 4:
                addFlag(x, y, 2);
                break;
            case 5:
                addCircle(x, y, 16, 'boost', true, map[x][y]);
                break;
            case 6:
                createPowerup(x, y);
                break;
            case 7:
                addCircle(x, y, 14, 'spike', false, map[x][y]);
                break;
            case 10:
                addBomb(x, y);
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
    player.flag = null;
    player.team = 1;
    player['s-captures'] = 0;
    player['s-drops'] = 0;
    player['s-grabs'] = 0;
    player['s-hold'] = 0;
    player['s-pops'] = 0;
    player['s-prevent'] = 0;
    player['s-returns'] = 0;
    player['s-support'] = 0;
    player['s-tags'] = 0;
    player.score = 0;
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
    setTimeout(createPowerup, 60 * 1000,
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
        player_data.team = player.team;
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
        player_data.flag = player.flag;
        player_data['s-captures'] = player['s-captures'];
        player_data['s-drops'] = player['s-drops'];
        player_data['s-grabs'] = player['s-grabs'];
        player_data['s-hold'] = Math.floor(player['s-hold']);
        player_data['s-pops'] = player['s-pops'];
        player_data['s-prevent'] = Math.floor(player['s-prevent']);
        player_data['s-returns'] = player['s-returns'];
        player_data['s-support'] = player['s-support'];
        player_data['s-tags'] = player['s-tags'];
        player_data.score = player.score;
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

/**
 * Kill and respawn a player.
 * @param {object} player_body
 */
function killPlayer(player_body) {
    'use strict';
    var player = players[player_body.id];
    player_body.removeShape(player_body.shapes[0]);
    explosion(player_body.position[0], player_body.position[1], 0);// Send shrapnel.
    player_body.setZeroForce();
    player_body.damping = 1;// Make it really hard to move.
    player.dead = true;
    if (player.flag) {
        removePlayerFlag(player_body.id);
    }
    setTimeout(function (player_body) {
        spawn(player_body);
        player.dead = false;
    }, 3000, player_body);
}

// Called when two objects begin touching.
world.on('beginContact', function (event) {
    'use strict';

    // Ensure that player_body is a player.
    var player_body = event.bodyA.identity === 'player' ? event.bodyA : event.bodyB,
        other_body = event.bodyA.identity === 'player' ? event.bodyB : event.bodyA;
    if (player_body.identity === 'player' && other_body.identity === 'player') {
        if (players[player_body.id].team !== players[other_body.id].team) {

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
                    players[player_body.id]['s-tags'] += 1;
                    killPlayer(other_body);
                }
            }
            if (players[other_body.id].tagpro === true) {
                if (!players[player_body.id].bomb) {
                    killPlayer(player_body);
                }
            }
        }
    }
    if (player_body.identity === 'player' && other_body.identity === 'spike') {
        killPlayer(player_body);
    }
    if (player_body.identity === 'player' && other_body.identity === 'bomb') {
        removeBomb(other_body);
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
    if (player_body.identity === 'player' && other_body.identity === 'flag') {
        if (players[player_body.id].team + 2 !== other_body.map_id) {
            playerGrab(player_body.id, other_body);
        } else if (players[player_body.id].flag) {
            playerCapture(player_body.id);
        }
    }
});

setInterval(function () {
    'use strict';
    world.step(TIME_STEP);// Render world.
    var FORCE_AMOUNT = 60,
        FORCE_LIMIT = 40,
        top_speed;
    Object.keys(players).forEach(function (i) {
        var player = players[i];
        top_speed = (player.grip) ? FORCE_LIMIT * 1.5 : FORCE_LIMIT;
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
            if (Math.abs(player.body.force[x]) > top_speed) {
                player.body.force[x] = (player.body.force[x] >= 0) ? top_speed : -top_speed;
            }
        });
        if (player.flag) {
            player['s-hold'] += TIME_STEP;
        }
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
