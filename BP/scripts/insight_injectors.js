import { system } from "@minecraft/server";
import { MATERIAL_CYCLES, BLOCK_ALIAS } from "./variants.js";

const REGISTRATION_MARKER = "__insightInjectorsAtelierRegistered";
const REGISTRATION_RETRY_TICKS = 20;
const MAX_REGISTRATION_ATTEMPTS = 180;
const INSIGHT_PROVIDER_NAME = "Dorios' Atelier";
const INSIGHT_CUSTOM_COMPONENT_KEYS = Object.freeze([
    "customVariantPreview"
]);

// ---------------------------------------------------------------------------
// Build lookup table (mirrors chisel.js BLOCK_LOOKUP construction)
// ---------------------------------------------------------------------------

function stripNamespace(id) {
    const parts = id.split(":");
    return parts.length > 1 ? parts.slice(1).join(":") : parts[0];
}

/**
 * Maps block identifier → { cycleIndex, stateIndex }
 * Built once at module load from the shared MATERIAL_CYCLES constant.
 */
const BLOCK_LOOKUP = new Map();

for (let ci = 0; ci < MATERIAL_CYCLES.length; ci++) {
    const cycle = MATERIAL_CYCLES[ci];
    for (let si = 0; si < cycle.length; si++) {
        BLOCK_LOOKUP.set(cycle[si], { cycleIndex: ci, stateIndex: si });
    }
}

/**
 * Resolves a block identifier through the BLOCK_ALIAS map,
 * following chains until a non-aliased ID is found.
 */
function resolveAlias(blockId) {
    let cur = blockId;
    const visited = new Set();
    while (BLOCK_ALIAS.has(cur) && !visited.has(cur)) {
        visited.add(cur);
        cur = BLOCK_ALIAS.get(cur);
    }
    return cur;
}

/**
 * Finds a cycle entry for the given block identifier.
 * Tries direct lookup first, then alias resolution, then
 * a name-stripped fallback for vanilla blocks without namespaces.
 */
function findEntryForBlockId(blockId) {
    if (BLOCK_LOOKUP.has(blockId)) return BLOCK_LOOKUP.get(blockId);

    const aliased = resolveAlias(blockId);
    if (BLOCK_LOOKUP.has(aliased)) return BLOCK_LOOKUP.get(aliased);

    // Fallback: match by stripped name (handles blocks like "polished_deepslate" vs "minecraft:polished_deepslate")
    const name = stripNamespace(blockId);
    for (const [id, entry] of BLOCK_LOOKUP.entries()) {
        if (stripNamespace(id) === name) return entry;
    }

    return undefined;
}

/**
 * Derives a friendly display name from a block identifier.
 * Strips the namespace and replaces underscores with spaces, capitalizing each word.
 *
 * Example: "dorios_atelier:andesite_bricks" → "Andesite Bricks"
 */
function blockIdToDisplayName(blockId) {
    const raw = stripNamespace(blockId);
    return raw
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// ---------------------------------------------------------------------------
// Field producer
// ---------------------------------------------------------------------------

function getNextVariantLine(context) {
    if (!context.playerSettings?.showCustomVariantPreview) {
        return undefined;
    }

    const blockId = context.block?.typeId;
    if (!blockId) return undefined;

    const entry = findEntryForBlockId(blockId);
    if (!entry) return undefined;

    const cycle = MATERIAL_CYCLES[entry.cycleIndex];
    if (!cycle || cycle.length <= 1) return undefined;

    const nextIndex = (entry.stateIndex + 1) % cycle.length;
    const nextBlockId = cycle[nextIndex];
    const nextName = blockIdToDisplayName(nextBlockId);

    return `Next Variant: ${nextName}`;
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

function collectAtelierBlockFields(context) {
    if (!context?.playerSettings?.showCustomFields || !context.block) {
        return undefined;
    }

    const lines = [];

    const variantLine = getNextVariantLine(context);
    if (variantLine) lines.push(variantLine);

    return lines.length ? lines : undefined;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function tryRegisterInjectors() {
    if (globalThis[REGISTRATION_MARKER]) {
        return true;
    }

    const api = globalThis.InsightCustomFields;
    if (!api || typeof api.registerBlockFieldInjector !== "function") {
        return false;
    }

    api.registerBlockFieldInjector(collectAtelierBlockFields, {
        provider: INSIGHT_PROVIDER_NAME,
        components: INSIGHT_CUSTOM_COMPONENT_KEYS
    });
    globalThis[REGISTRATION_MARKER] = true;
    return true;
}

function registerInjectorsWithRetry(attempt = 0) {
    if (tryRegisterInjectors() || attempt >= MAX_REGISTRATION_ATTEMPTS) {
        return;
    }

    system.runTimeout(() => {
        registerInjectorsWithRetry(attempt + 1);
    }, REGISTRATION_RETRY_TICKS);
}

registerInjectorsWithRetry();
