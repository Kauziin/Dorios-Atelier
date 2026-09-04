import { world, system, ItemStack, Direction, GameMode } from "@minecraft/server"

// Original owner: Beardedflea (beardedflea/116253249178304518)

const adjacentVectors = [{ x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]
const getRelativeBlockLocation = (l, aL) => ({ x: l.x + aL.x, y: l.y + aL.y, z: l.z + aL.z });

world.beforeEvents.itemUseOn.subscribe(e => {
	if (e.itemStack.matches(e.itemStack.typeId, { "gvpa:double": false }) && e.faceLocation.y != 0.5) {
		const faceNum = Object.keys(Direction).indexOf(e.blockFace);
		const adjacentBlock = e.block.dimension.getBlock(getRelativeBlockLocation(e.block.location, adjacentVectors[faceNum]));
		if (adjacentBlock.typeId === e.itemStack.typeId) {
			e.cancel = true;
			system.run(() => {
				//player.playAnimation("animation.player.first_person.attack_rotation_item")
				const inv = e.source.getComponent('inventory').container
				if ((e.source.matches({ gameMode: GameMode.survival }))) {
					if (e.itemStack.amount - 1 != 0) {
						inv.setItem(e.source.selectedSlot, new ItemStack(e.itemStack.typeId, e.itemStack.amount - 1));
					} else {
						inv.setItem(e.source.selectedSlot, new ItemStack("minecraft:air", 1));
					}
				}
				adjacentBlock.setPermutation(adjacentBlock.permutation.withState("gvpa:double", true));
				world.playSound("use.stone", adjacentBlock.location);
			});
		}
	};
}); 
