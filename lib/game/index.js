var p2 = require('p2'),// The physics engine.
    players = {},// Server-side storage of each player's attributes.
    x,// Used later for looping.
    y,// Used later for looping.
    TILE_SIZE = 40,
    map = [[1, 1], [1, 1]],// Default map data. Really should not ever be used.
    world = new p2.World({// Create a new world using p2.
        gravity: [0, 0]
    }),
    TIME_STEP = 1 / 60; // seconds

/**
 * Add a new circle body to the world.
 * @param {number} x - The position on the x axis (grid, not global).
 * @param {number} y - The position on the y axis (grid, not global).
 * @param {number} r - The radius of the circle.
 * @param {string} type - The type of the circle. Used to label it for collisions.
 * @param {boolean} sensor - Is this a sensor?
 */
function addCircle(x, y, r, type, sensor) {
    'use strict';
    var new_body = new p2.Body({
        mass: 0,
        position: [x * TILE_SIZE, y * TILE_SIZE]
    }),
        new_shape = new p2.Circle(r);
    new_shape.sensor = sensor;
    new_body.identity = type;
    new_shape.collisionGroup = 7;
    new_body.addShape(new_shape);
    world.addBody(new_body);
}

/**
 * Add a new wall to the world.
 * @param {number} x - The position on the x axis (grid, not global).
 * @param {number} y - The position on the y axis (grid, not global).
 */
function addWall(x, y) {
    'use strict';
    var new_body = new p2.Body({
        mass: 0,
        position: [x * TILE_SIZE, y * TILE_SIZE]
    }),
         new_shape = new p2.Rectangle(TILE_SIZE, TILE_SIZE);
    new_body.identity = 'wall';
    new_body.addShape(new_shape);
    world.addBody(new_body);
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
    console.log(x);
    console.log(new_pup);
    map[x][y] = new_pup;
    addCircle(x, y, 16, 'powerup', true);
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
                addCircle(x, y, 16, 'boost', true);
                break;
            case 6:
                createPowerup(x, y);
                break;
            case 7:
                addCircle(x, y, 12, 'spike', false);
                break;
            case 10:
                addCircle(x, y, 16, 'bomb', false);
                break;
            default:
                break;
            }
        }
    }
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
 * @param {number} force - The force of the explosion. Higher number equal more force.
 */
function explosion(x, y, force) {
    'use strict';
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
        player_data.bomb = player.bomb;
        player_data.dead = player.dead;
        player_data.degree = 0;
        player_data.draw = true;
        player_data.grip = false;
        player_data.speed = false;
        player_data.tagpro = false;
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
 * Handle keypresses.
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

// Called when two objects begin touching.
world.on('beginContact', function (event) {
    'use strict';

    // Ensure that player_body is a player.
    var player_body = event.bodyA.identity === 'player' ? event.bodyA : event.bodyB,
        other_body = event.bodyA.identity === 'player' ? event.bodyB : event.bodyA;
    if (player_body.identity === 'player' && other_body.identity === 'spike') {
        event.bodyA.removeShape(event.shapeA);// Kill the player.
        explosion(event.bodyA.position[0], event.bodyA.position[1], 10000);// Send shrapnel.
        player_body.setZeroForce();// Remove any force from the player.
        player_body.damping = 1;// Make is really hard to move.
        players[player_body.id].dead = true;// Make sure everyone knows the player died.
        setTimeout(function (player_body) {
            spawn(player_body);// Revive the player.
            players[player_body.id].dead = false;// Make sure everyone know the player is back in town.
        }, 3000, player_body);// 3 seconds before spwan.
    }
    if (player_body.identity === 'player' && other_body.identity === 'bomb') {
        explosion(other_body.position[0], other_body.position[1], 40000);
    }
    if (player_body.identity === 'player' && other_body.identity === 'boost') {
        player_body.applyForce(
            [
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
            ], [
                2 * player_body.position[0] - other_body.position[0],
                2 * player_body.position[1] - other_body.position[1]
            ]
        );
    }
    if (player_body.identity === 'player' && other_body.identity === 'powerup') {
        // TODO: Add other powerups.
        addPowerup(players[player_body.id], 'bomb');
    }
});

setInterval(function () {
    'use strict';
    world.step(TIME_STEP);// Render world.
    var FORCE_AMOUNT = 40;

    // Add force based on keypresses.
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
        setMap: setMap
    };
};
