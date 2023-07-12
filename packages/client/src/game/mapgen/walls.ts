import {rand} from "../../utils/rnd.js";
import {WORLD_BOUNDS_SIZE_PX} from "../../assets/params.js";
import {TILE_MAP_STRIDE, TILE_SIZE_BITS} from "../tilemap.js";

interface Agent {
    _x: number;
    _y: number;
    _vx: number;
    _vy: number;
    _floors: number;
}

const randRotation = () => {
    const t = rand(100);
    if (t < 10) return 1;
    if (t < 20) return 2;
    if (t < 25) return 3;
    return 0;
};

const rotate = (agent: Agent, t: number): void => {
    const vx = agent._vx;
    const vy = agent._vy;
    switch (t) {
        case 1:
            agent._vx = vy;
            agent._vy = -vx;
            break;
        case 2:
            agent._vx = -vy;
            agent._vy = vx;
            break;
        case 3:
            agent._vx = -vx;
            agent._vy = -vy;
            break;
    }
};

let floorBlocksNum = 0;
let blocksNum = 0;
const clearBlock = (blocks: number[], x: number, y: number): number => {
    const ci = x + y * TILE_MAP_STRIDE;
    if (blocks[ci]) {
        blocks[ci] = 0;
        ++floorBlocksNum;
        return 1;
    }
    return 0;
};

const getBlock = (blocks: number[], x: number, y: number): number => {
    if (x < 0 || y < 0 || x > TILE_MAP_STRIDE - 1 || y > TILE_MAP_STRIDE - 1) {
        return 1;
    }
    const ci = x + y * TILE_MAP_STRIDE;
    return blocks[ci];
};

const clearRectBlock = (blocks: number[], x: number, y: number, sx: number, sy: number) => {
    let x0 = x - sx;
    let x1 = x + sx;
    let y0 = y - sy;
    let y1 = y + sy;
    if (x0 < 0) {
        x0 = 0;
    }
    if (y0 < 0) {
        y0 = 0;
    }
    if (x1 > TILE_MAP_STRIDE - 1) {
        x1 = TILE_MAP_STRIDE - 1;
    }
    if (y1 > TILE_MAP_STRIDE - 1) {
        y1 = TILE_MAP_STRIDE - 1;
    }
    for (let cy = y0; cy < y1; ++cy) {
        for (let cx = x0; cx < x1; ++cx) {
            clearBlock(blocks, cx, cy);
        }
    }
};

export interface MapSlot {
    _x: number;
    _y: number;
    _type: number;
}

const addSpawnMapSlot = (agent: Agent, mapSlots: Map<number, MapSlot>) => {
    const x = agent._x + 1;
    const y = agent._y + 1;
    mapSlots.set(x + y * TILE_MAP_STRIDE, {_x: x, _y: y, _type: 2});
};

const addItemMapSlot = (agent: Agent, mapSlots: Map<number, MapSlot>) => {
    const x = agent._x + 1;
    const y = agent._y + 1;
    mapSlots.set(x + y * TILE_MAP_STRIDE, {_x: x, _y: y, _type: 1});
};

const addTreeMapSlot = (x: number, y: number, mapSlots: Map<number, MapSlot>) => {
    mapSlots.set(x + y * TILE_MAP_STRIDE, {_x: x, _y: y, _type: 0});
};

export const generateBlocks = (blocks: number[], outSlots: Map<number, MapSlot>) => {
    // blocks.length = 0;
    // for (let i = 0; i < GAME_CFG.walls.initCount; ++i) {
    //     const x = rand(WORLD_BOUNDS_SIZE_PX);
    //     const y = rand(WORLD_BOUNDS_SIZE_PX);
    //     const ci = (x >> TILE_SIZE_BITS) + (y >> TILE_SIZE_BITS) * TILE_MAP_STRIDE;
    //     blocks[ci] = 1;
    // }
    const floorsFillGoal = 0.8;
    const iterationsMax = 10000;
    const defaultAgentFloorsCount = 110;

    blocks.length = TILE_MAP_STRIDE * TILE_MAP_STRIDE;
    blocks.fill(1);
    blocksNum = blocks.length;
    floorBlocksNum = 0;
    const startX = (WORLD_BOUNDS_SIZE_PX >> 1) >> TILE_SIZE_BITS;
    const startY = (WORLD_BOUNDS_SIZE_PX >> 1) >> TILE_SIZE_BITS;
    const agents: Agent[] = [];
    agents.push({_x: startX, _y: startY, _vx: 1, _vy: 0, _floors: defaultAgentFloorsCount});
    agents.push({_x: startX, _y: startY, _vx: -1, _vy: 0, _floors: defaultAgentFloorsCount});
    agents.push({_x: startX, _y: startY, _vx: 0, _vy: 1, _floors: defaultAgentFloorsCount});
    agents.push({_x: startX, _y: startY, _vx: 0, _vy: -1, _floors: defaultAgentFloorsCount});
    clearRectBlock(blocks, startX, startY, 7, 5);
    clearRectBlock(blocks, startX, startY, 6, 6);
    clearRectBlock(blocks, startX, startY, 5, 7);
    // clearRectBlock(blocks, startX, startY, 6, 4);
    // clearRectBlock(blocks, startX, startY, 5, 5);
    // clearRectBlock(blocks, startX, startY, 4, 6);
    let iterations = iterationsMax;
    while (--iterations > 0 && floorBlocksNum / blocksNum < floorsFillGoal) {
        for (let i = 0; i < agents.length; ++i) {
            const agent = agents[i];
            const alterDir = randRotation();
            rotate(agent, alterDir);
            if (alterDir === 2) {
                addItemMapSlot(agent, outSlots);
            }
            agent._x += agent._vx;
            agent._y += agent._vy;
            if (agent._x < 0) {
                agent._x = 0;
                agent._vx = 1;
            } else if (agent._x > TILE_MAP_STRIDE - 2) {
                agent._x = TILE_MAP_STRIDE - 2;
                agent._vx = -1;
            }
            if (agent._y < 0) {
                agent._y = 0;
                agent._vy = 1;
            } else if (agent._y > TILE_MAP_STRIDE - 2) {
                agent._y = TILE_MAP_STRIDE - 2;
                agent._vy = -1;
            }
            const createdFloors =
                clearBlock(blocks, agent._x + 1, agent._y + 1) +
                clearBlock(blocks, agent._x, agent._y) +
                clearBlock(blocks, agent._x + 1, agent._y) +
                clearBlock(blocks, agent._x, agent._y + 1);
            agent._floors -= createdFloors;
            if (createdFloors && alterDir && alterDir !== 2) {
                addSpawnMapSlot(agent, outSlots);
            }
        }
    }

    for (let cy = 0; cy < TILE_MAP_STRIDE; ++cy) {
        for (let cx = 0; cx < TILE_MAP_STRIDE; ++cx) {
            if (blocks[cx + cy * TILE_MAP_STRIDE]) {
                const s =
                    getBlock(blocks, cx - 1, cy - 1) +
                    getBlock(blocks, cx, cy - 1) +
                    getBlock(blocks, cx + 1, cy - 1) +
                    getBlock(blocks, cx - 1, cy) +
                    getBlock(blocks, cx + 1, cy) +
                    getBlock(blocks, cx - 1, cy + 1) +
                    getBlock(blocks, cx, cy + 1) +
                    getBlock(blocks, cx + 1, cy + 1);
                if (s === 0) {
                    addTreeMapSlot(cx, cy, outSlots);
                    blocks[cx + cy * TILE_MAP_STRIDE] = 0;
                }
            }
        }
    }

    for (let cy = 0; cy < TILE_MAP_STRIDE; ++cy) {
        for (let cx = 0; cx < TILE_MAP_STRIDE; ++cx) {
            if (blocks[cx + cy * TILE_MAP_STRIDE]) {
                if (cy === TILE_MAP_STRIDE - 1 || !blocks[cx + (cy + 1) * TILE_MAP_STRIDE]) {
                    blocks[cx + cy * TILE_MAP_STRIDE] = 3;
                }
            }
        }
    }

    console.info("map generation result:", floorBlocksNum / blocksNum, iterations);
};
