"use strict";

function forObj(obj, fn) {
    Object.keys(obj).forEach(function (key) {
        fn(obj[key], key);
    })
}

let abs = Math.abs;
const map_height = 5000;
const map_width = 5000;
const required_players = 1;
const tick_rate = 30;
let serverTime = 0;

class Entity {
    constructor(x, y, height, width, _screen, map) {
        this.nonce = null;
        this.map = map;
        this.namespace = null;
        this.x = x;
        this.y = y;
        this.height = height;
        this.width = width;
        this.hovered = false;
        this.isOnScreen = function () {
            return this._screen === screen
        };
        this._screen = _screen;
        this._sethover = function () {
            this.hovered = this.isOnScreen() && mouseInBounds(this.x, this.y, this.height, this.width)
        };
        this._anyclick = function () {
            if (this.isOnScreen() && this.onAnyClick) this.onAnyClick();
        };
        this._click = function () {
            if (this.hovered && this.onClick) this.onClick();
        };
        this._render = function () {
            if (this.isOnScreen()) this.render();
        };
        this._mousemove = function () {
            if (this.isOnScreen() && this.onMouseMove) this.onMouseMove();
        };
        this._tick = function (delta) {
            if (this.isOnScreen() && this.onTick) this.onTick(delta);
        };
        this._resize = function () {
            if (this.onResize) this.onResize();
        };
        this.destroy = function () {
            delete entities[this.namespace || this.nonce];
        };
    }
}

function entitiesCollide(a, b) {
    return (abs(a.x - b.x) * 2 < (a.width + b.width)) && (abs(a.y - b.y) * 2 < (a.height + b.height));
}

function randomIntFromInterval(min, max) {
    return Math.random() * (max - min + 1) + min;
}

class Environment {
    constructor(nonce) {
        this.nonce = nonce;
        this.actors = new Map();
        this.projectiles = new Map();
        this.destroyedProjectiles = [];
        this.walls = new Map();
        this.floors = new Map();
    }

    environmentTick() {
        this.projectiles.forEach((value, key) => {
            value.onTick();
            let hitPlayers = this.getPlayerColliding(value);
            let destroyProjectile = value.isOutOfBounds() || hitPlayers.length > 0;

            if (hitPlayers.length > 0) {
                this.destroyedProjectiles.push({playerNonce: hitPlayers[0].nonce, nonce: value.nonce});
            }

            if (destroyProjectile) {
                this.projectiles.delete(key);
            }
            hitPlayers.forEach((player, index) => {
                this.hurtPlayer(player, index)
            })
        });
    }

    hurtPlayer(player) {
        player.health--;
        if (player.health <= 0) {
            this.actors.delete(player.nonce);
        }
    }

    addPlayer(player) {
        if (player && player.nonce) {
            this.actors.set(player.nonce, player);
        }
    }

    addProjectile(projectile) {
        if (projectile && projectile.nonce) {
            this.projectiles.set(projectile.nonce, projectile);
        }
    }

    addWall(wall) {
        if (wall && wall.nonce) {
            this.walls.set(wall.nonce, wall);
        }
    }

    getPlayerColliding(projectile) {
        let playersColliding = [];
        this.actors.forEach((val, key) => {
            if (projectile.playerNonce !== key && entitiesCollide(val, projectile)) {
                playersColliding.push(val);
            }
        });
        return playersColliding;
    }
}


class Actor extends Entity {
    constructor(x, y, color) {
        super(x, y, 20, 20, 1);
        this.health = 100;
        this.rotationDegrees = 0;
        this.color = color;
        this.velocity = .1;
        this.render = function () {
            ctx.fillStyle = this.color;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotationDegrees * Math.PI / 180);
            ctx.fillRect(this.width / this.x - 10, this.height / this.y - 10, this.width, this.height);
            ctx.fillStyle = 'salmon';
            ctx.beginPath();
            ctx.moveTo(-(this.width / 2), this.height / 2);
            ctx.lineTo(-(this.width / 2), -(this.height / 2));
            ctx.lineTo(this.width / 2, 0);
            ctx.fill();
            ctx.restore();
        };
    }
}

class Projectile extends Entity {
    constructor(nonce, x, y, rotationDegrees, fireTime, playerNonce, map) {
        super(x, y, 5, 5, 1, map);
        this.halflife = 15;
        this.nonce = nonce;
        this._startingX = x;
        this._startingY = y;
        this.playerNonce = playerNonce;
        this.rotationDegrees = rotationDegrees;
        this.wobbleRotation = (randomIntFromInterval(-8, 8)) + this.rotationDegrees;
        this.speed = randomIntFromInterval(5, 8);
        this.fireTime = fireTime;
        this.render = function () {
            ctx.beginPath();
            ctx.fillStyle = this.color || 'orange';
            ctx.font = "12px Arial";
            ctx.fillRect(this.x, this.y, this.height, this.width);
            ctx.stroke();
        };
        this.isOutOfBounds = function () {
            return this.x > map_width || this.x < 0 || this.y > map_height || this.y < 0;
        };

        this._getDeltaTime = function () {
            return ((serverTime - this.fireTime) / tick_rate);
        };
        this.onTick = function () {
            this.x = this._startingX + (this.speed * Math.cos(this.wobbleRotation * Math.PI / 180) * this._getDeltaTime());
            this.y = this._startingY + (this.speed * Math.sin(this.wobbleRotation * Math.PI / 180) * this._getDeltaTime());
        };
    }
}

class Contrail extends Entity {
    constructor(x, y, height, width) {
        super(x, y, height, width, 1);
        this.halflife = 1;
        this.render = function () {
            ctx.globalAlpha = 1 / this.halflife;
            ctx.fillStyle = 'yellow';
            ctx.strokeStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.height * this.halflife / 2, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            ctx.globalAlpha = 1;
        };
        this.onTick = function () {
            this.halflife++;
            if (this.halflife === 10) this.destroy();
        }
    }
}