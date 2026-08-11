import { world } from "@minecraft/server";

const STAIR_SHAPE_STATE = "dorios_atelier:stair_shape";
const HALF_STATE = "minecraft:vertical_half";
const FACING_STATE = "minecraft:cardinal_direction";

const STAIR_IDS = new Set([
    "dorios_atelier:andesite_bricks_stairs",
    "dorios_atelier:andesite_bricks_three_steps_stairs",
    "dorios_atelier:andesite_stairs",
    "dorios_atelier:andesite_three_steps_stairs",
    "dorios_atelier:andesite_tiles_stairs",
    "dorios_atelier:andesite_tiles_three_steps_stairs",
    "dorios_atelier:basalt_bricks_stairs",
    "dorios_atelier:basalt_bricks_three_steps_stairs",
    "dorios_atelier:basalt_tiles_stairs",
    "dorios_atelier:basalt_tiles_three_steps_stairs",
    "dorios_atelier:blackstone_tiles_stairs",
    "dorios_atelier:blackstone_tiles_three_steps_stairs",
    "dorios_atelier:calcite_bricks_stairs",
    "dorios_atelier:calcite_bricks_three_steps_stairs",
    "dorios_atelier:calcite_stairs",
    "dorios_atelier:calcite_three_steps_stairs",
    "dorios_atelier:calcite_tiles_stairs",
    "dorios_atelier:calcite_tiles_three_steps_stairs",
    "dorios_atelier:chiseled_deepslate_stairs",
    "dorios_atelier:chiseled_deepslate_three_steps_stairs",
    "dorios_atelier:chiseled_nether_bricks_stairs",
    "dorios_atelier:chiseled_nether_bricks_three_steps_stairs",
    "dorios_atelier:chiseled_polished_blackstone_stairs",
    "dorios_atelier:chiseled_polished_blackstone_three_steps_stairs",
    "dorios_atelier:chiseled_stone_bricks_stairs",
    "dorios_atelier:chiseled_stone_bricks_three_steps_stairs",
    "dorios_atelier:cobbled_deepslate_stairs",
    "dorios_atelier:cobbled_deepslate_three_steps_stairs",
    "dorios_atelier:cobblestone_stairs",
    "dorios_atelier:cobblestone_three_steps_stairs",
    "dorios_atelier:cracked_andesite_bricks_stairs",
    "dorios_atelier:cracked_andesite_bricks_three_steps_stairs",
    "dorios_atelier:cracked_andesite_tiles_stairs",
    "dorios_atelier:cracked_andesite_tiles_three_steps_stairs",
    "dorios_atelier:cracked_basalt_bricks_stairs",
    "dorios_atelier:cracked_basalt_bricks_three_steps_stairs",
    "dorios_atelier:cracked_basalt_tiles_stairs",
    "dorios_atelier:cracked_basalt_tiles_three_steps_stairs",
    "dorios_atelier:cracked_blackstone_tiles_stairs",
    "dorios_atelier:cracked_blackstone_tiles_three_steps_stairs",
    "dorios_atelier:cracked_calcite_bricks_stairs",
    "dorios_atelier:cracked_calcite_bricks_three_steps_stairs",
    "dorios_atelier:cracked_calcite_tiles_stairs",
    "dorios_atelier:cracked_calcite_tiles_three_steps_stairs",
    "dorios_atelier:cracked_deepslate_bricks_stairs",
    "dorios_atelier:cracked_deepslate_bricks_three_steps_stairs",
    "dorios_atelier:cracked_deepslate_tiles_stairs",
    "dorios_atelier:cracked_deepslate_tiles_three_steps_stairs",
    "dorios_atelier:cracked_diorite_bricks_stairs",
    "dorios_atelier:cracked_diorite_bricks_three_steps_stairs",
    "dorios_atelier:cracked_diorite_tiles_stairs",
    "dorios_atelier:cracked_diorite_tiles_three_steps_stairs",
    "dorios_atelier:cracked_dripstone_bricks_stairs",
    "dorios_atelier:cracked_dripstone_bricks_three_steps_stairs",
    "dorios_atelier:cracked_dripstone_tiles_stairs",
    "dorios_atelier:cracked_dripstone_tiles_three_steps_stairs",
    "dorios_atelier:cracked_granite_bricks_stairs",
    "dorios_atelier:cracked_granite_bricks_three_steps_stairs",
    "dorios_atelier:cracked_granite_tiles_stairs",
    "dorios_atelier:cracked_granite_tiles_three_steps_stairs",
    "dorios_atelier:cracked_nether_bricks_stairs",
    "dorios_atelier:cracked_nether_bricks_three_steps_stairs",
    "dorios_atelier:cracked_polished_blackstone_bricks_stairs",
    "dorios_atelier:cracked_polished_blackstone_bricks_three_steps_stairs",
    "dorios_atelier:cracked_stone_bricks_stairs",
    "dorios_atelier:cracked_stone_bricks_three_steps_stairs",
    "dorios_atelier:cracked_tuff_bricks_stairs",
    "dorios_atelier:cracked_tuff_bricks_three_steps_stairs",
    "dorios_atelier:cracked_tuff_tiles_stairs",
    "dorios_atelier:cracked_tuff_tiles_three_steps_stairs",
    "dorios_atelier:dark_prismarine_stairs",
    "dorios_atelier:dark_prismarine_three_steps_stairs",
    "dorios_atelier:deepslate_bricks_stairs",
    "dorios_atelier:deepslate_bricks_three_steps_stairs",
    "dorios_atelier:deepslate_tiles_stairs",
    "dorios_atelier:deepslate_tiles_three_steps_stairs",
    "dorios_atelier:diorite_bricks_stairs",
    "dorios_atelier:diorite_bricks_three_steps_stairs",
    "dorios_atelier:diorite_stairs",
    "dorios_atelier:diorite_three_steps_stairs",
    "dorios_atelier:diorite_tiles_stairs",
    "dorios_atelier:diorite_tiles_three_steps_stairs",
    "dorios_atelier:dripstone_bricks_stairs",
    "dorios_atelier:dripstone_bricks_three_steps_stairs",
    "dorios_atelier:dripstone_tiles_stairs",
    "dorios_atelier:dripstone_tiles_three_steps_stairs",
    "dorios_atelier:gilded_blackstone_stairs",
    "dorios_atelier:gilded_blackstone_three_steps_stairs",
    "dorios_atelier:glowing_obsidian_stairs",
    "dorios_atelier:glowing_obsidian_three_steps_stairs",
    "dorios_atelier:granite_bricks_stairs",
    "dorios_atelier:granite_bricks_three_steps_stairs",
    "dorios_atelier:granite_stairs",
    "dorios_atelier:granite_three_steps_stairs",
    "dorios_atelier:granite_tiles_stairs",
    "dorios_atelier:granite_tiles_three_steps_stairs",
    "dorios_atelier:mossy_cobblestone_stairs",
    "dorios_atelier:mossy_cobblestone_three_steps_stairs",
    "dorios_atelier:mossy_stone_bricks_stairs",
    "dorios_atelier:mossy_stone_bricks_three_steps_stairs",
    "dorios_atelier:mud_bricks_stairs",
    "dorios_atelier:mud_bricks_three_steps_stairs",
    "dorios_atelier:netherrack_stairs",
    "dorios_atelier:netherrack_three_steps_stairs",
    "dorios_atelier:obsidian_bricks_stairs",
    "dorios_atelier:obsidian_bricks_three_steps_stairs",
    "dorios_atelier:obsidian_tiles_stairs",
    "dorios_atelier:obsidian_tiles_three_steps_stairs",
    "dorios_atelier:packed_mud_stairs",
    "dorios_atelier:packed_mud_three_steps_stairs",
    "dorios_atelier:polished_andesite_stairs",
    "dorios_atelier:polished_andesite_three_steps_stairs",
    "dorios_atelier:polished_blackstone_bricks_stairs",
    "dorios_atelier:polished_blackstone_bricks_three_steps_stairs",
    "dorios_atelier:polished_blackstone_stairs",
    "dorios_atelier:polished_blackstone_three_steps_stairs",
    "dorios_atelier:polished_calcite_stairs",
    "dorios_atelier:polished_calcite_three_steps_stairs",
    "dorios_atelier:polished_deepslate_stairs",
    "dorios_atelier:polished_deepslate_three_steps_stairs",
    "dorios_atelier:polished_diorite_stairs",
    "dorios_atelier:polished_diorite_three_steps_stairs",
    "dorios_atelier:polished_dripstone_stairs",
    "dorios_atelier:polished_dripstone_three_steps_stairs",
    "dorios_atelier:polished_granite_stairs",
    "dorios_atelier:polished_granite_three_steps_stairs",
    "dorios_atelier:polished_obsidian_stairs",
    "dorios_atelier:polished_obsidian_three_steps_stairs",
    "dorios_atelier:polished_tuff_stairs",
    "dorios_atelier:polished_tuff_three_steps_stairs",
    "dorios_atelier:prismarine_bricks_stairs",
    "dorios_atelier:prismarine_bricks_three_steps_stairs",
    "dorios_atelier:prismarine_stairs",
    "dorios_atelier:prismarine_three_steps_stairs",
    "dorios_atelier:purpur_block_stairs",
    "dorios_atelier:purpur_block_three_steps_stairs",
    "dorios_atelier:quartz_bricks_stairs",
    "dorios_atelier:quartz_bricks_three_steps_stairs",
    "dorios_atelier:smooth_andesite_stairs",
    "dorios_atelier:smooth_andesite_three_steps_stairs",
    "dorios_atelier:smooth_basalt_stairs",
    "dorios_atelier:smooth_basalt_three_steps_stairs",
    "dorios_atelier:smooth_blackstone_stairs",
    "dorios_atelier:smooth_blackstone_three_steps_stairs",
    "dorios_atelier:smooth_calcite_stairs",
    "dorios_atelier:smooth_calcite_three_steps_stairs",
    "dorios_atelier:smooth_diorite_stairs",
    "dorios_atelier:smooth_diorite_three_steps_stairs",
    "dorios_atelier:smooth_dripstone_stairs",
    "dorios_atelier:smooth_dripstone_three_steps_stairs",
    "dorios_atelier:smooth_granite_stairs",
    "dorios_atelier:smooth_granite_three_steps_stairs",
    "dorios_atelier:smooth_quartz_stairs",
    "dorios_atelier:smooth_quartz_three_steps_stairs",
    "dorios_atelier:smooth_stone_stairs",
    "dorios_atelier:smooth_stone_three_steps_stairs",
    "dorios_atelier:smooth_tuff_stairs",
    "dorios_atelier:smooth_tuff_three_steps_stairs",
    "dorios_atelier:stone_bricks_stairs",
    "dorios_atelier:stone_bricks_three_steps_stairs",
    "dorios_atelier:stone_stairs",
    "dorios_atelier:stone_three_steps_stairs",
    "dorios_atelier:tuff_bricks_stairs",
    "dorios_atelier:tuff_bricks_three_steps_stairs",
    "dorios_atelier:tuff_stairs",
    "dorios_atelier:tuff_three_steps_stairs",
    "dorios_atelier:tuff_tiles_stairs",
    "dorios_atelier:tuff_tiles_three_steps_stairs",
]);

const DIR_OFFSETS = {
    north: { x: 0, y: 0, z: -1 },
    south: { x: 0, y: 0, z: 1 },
    west: { x: -1, y: 0, z: 0 },
    east: { x: 1, y: 0, z: 0 }
};

const LEFT_OF = {
    north: "west",
    south: "east",
    west: "south",
    east: "north"
};

const RIGHT_OF = {
    north: "east",
    south: "west",
    west: "north",
    east: "south"
};

const OPPOSITE = {
    north: "south",
    south: "north",
    west: "east",
    east: "west"
};

const AXIS = {
    north: "z",
    south: "z",
    west: "x",
    east: "x"
};

const getNeighbor = (block, direction) => {
    const offset = DIR_OFFSETS[direction];
    if (!offset) return undefined;

    const target = {
        x: block.location.x + offset.x,
        y: block.location.y + offset.y,
        z: block.location.z + offset.z
    };

    return block.dimension.getBlock(target);
};

const isStair = block => block && STAIR_IDS.has(block.typeId);

const getState = (block, stateName) => block?.permutation?.getState(stateName);

const isCurvedOutShape = shape => shape === "curved_out_left" || shape === "curved_out_right";

const getRawFacing = block => {
    const facing = getState(block, FACING_STATE);
    return DIR_OFFSETS[facing] ? facing : undefined;
};

const getFacing = block => {
    const rawFacing = getRawFacing(block);
    if (!rawFacing) return undefined;

    const shape = getState(block, STAIR_SHAPE_STATE);
    return isCurvedOutShape(shape) ? OPPOSITE[rawFacing] : rawFacing;
};

const sameHalf = (block, neighbor) => getState(block, HALF_STATE) === getState(neighbor, HALF_STATE);

const isDifferentStair = (block, direction, facing) => {
    const neighbor = getNeighbor(block, direction);
    if (!isStair(neighbor) || !sameHalf(block, neighbor)) return true;
    return getFacing(neighbor) !== facing;
};

const resolveShape = block => {
    const facing = getFacing(block);
    if (!facing || !DIR_OFFSETS[facing]) return "straight";

    const front = getNeighbor(block, facing);
    if (isStair(front) && sameHalf(block, front)) {
        const frontFacing = getFacing(front);
        if (frontFacing && AXIS[frontFacing] !== AXIS[facing] && isDifferentStair(block, OPPOSITE[frontFacing], facing)) {
            if (frontFacing === LEFT_OF[facing]) return "curved_out_left";
            if (frontFacing === RIGHT_OF[facing]) return "curved_out_right";
        }
    }

    const back = getNeighbor(block, OPPOSITE[facing]);
    if (isStair(back) && sameHalf(block, back)) {
        const backFacing = getFacing(back);
        if (backFacing && AXIS[backFacing] !== AXIS[facing] && isDifferentStair(block, backFacing, facing)) {
            if (backFacing === LEFT_OF[facing]) return "curved_in_left";
            if (backFacing === RIGHT_OF[facing]) return "curved_in_right";
        }
    }

    return "straight";
};

const updateStair = block => {
    if (!isStair(block)) return;

    const shape = resolveShape(block);
    const currentShape = getState(block, STAIR_SHAPE_STATE);

    const rawFacing = getRawFacing(block);
    const logicalFacing = getFacing(block);
    const targetFacing = logicalFacing
        ? (isCurvedOutShape(shape) ? OPPOSITE[logicalFacing] : logicalFacing)
        : undefined;

    const shapeUnchanged = currentShape === shape;
    const facingUnchanged = !targetFacing || rawFacing === targetFacing;
    if (shapeUnchanged && facingUnchanged) return;

    try {
        let permutation = block.permutation.withState(STAIR_SHAPE_STATE, shape);
        if (targetFacing && rawFacing !== targetFacing) {
            permutation = permutation.withState(FACING_STATE, targetFacing);
        }
        block.setPermutation(permutation);
    } catch {
        return;
    }
};

const updateNeighbors = block => {
    for (const direction of Object.keys(DIR_OFFSETS)) {
        const neighbor = getNeighbor(block, direction);
        if (isStair(neighbor)) updateStair(neighbor);
    }
};

const updateNeighborsAt = (dimension, location) => {
    const fakeBlock = dimension.getBlock(location);
    if (!fakeBlock) return;
    updateNeighbors(fakeBlock);
};

const onPlaced = ({ block }) => {
    if (!block) return;
    updateStair(block);
    updateNeighbors(block);
};

const onBroken = event => {
    const { block, dimension } = event;
    if (block?.dimension && block?.location) {
        updateNeighborsAt(block.dimension, block.location);
        return;
    }

    if (dimension && block?.location) {
        updateNeighborsAt(dimension, block.location);
    }
};

const afterEvents = world.afterEvents;

if (afterEvents.playerPlaceBlock) {
    afterEvents.playerPlaceBlock.subscribe(onPlaced);
} else if (afterEvents.blockPlace) {
    afterEvents.blockPlace.subscribe(onPlaced);
}

if (afterEvents.playerBreakBlock) {
    afterEvents.playerBreakBlock.subscribe(onBroken);
} else if (afterEvents.blockBreak) {
    afterEvents.blockBreak.subscribe(onBroken);
}
