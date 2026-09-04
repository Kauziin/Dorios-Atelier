// chisel.js
import { system, world } from "@minecraft/server";
import { MATERIAL_CYCLES, BLOCK_ALIAS } from "./variants.js";
import { readToolLockFromItem, registerToolLockResolver } from "./toolMemory.js";
import { playToolMaterialSound, soundConfig } from "./soundConfig.js";

const TOOL_NAMESPACES = ["dorios_atelier", "utilitycraft"];
const CHISEL_COMPONENT_ID = "dorios_atelier:chisel";
const CHISEL_ID_SUFFIX = "_chisel";
const CHISEL_LOCK_KIND = "chisel";

const NAME_TOKEN_CACHE = new Map();
const NAME_TO_IDS = new Map();

/* --- helpers de string --- */
function stripNamespace(id) {
  const parts = id.split(":");
  return parts.length > 1 ? parts.slice(1).join(":") : parts[0];
}
function tokensOf(name) {
  return name.split("_").filter(Boolean);
}

function cachedTokens(name) {
  if (!NAME_TOKEN_CACHE.has(name)) {
    NAME_TOKEN_CACHE.set(name, tokensOf(name));
  }
  return NAME_TOKEN_CACHE.get(name);
}

function rememberName(name, id) {
  if (!NAME_TO_IDS.has(name)) NAME_TO_IDS.set(name, new Set());
  NAME_TO_IDS.get(name).add(id);
}

/* --- preprocessa ciclos (a partir de MATERIAL_CYCLES importado) --- */
const CYCLES = [];
for (const states of MATERIAL_CYCLES) {
  const tokenCount = new Map();
  const stateInfos = states.map((fullId) => {
    const name = stripNamespace(fullId);
    const toks = cachedTokens(name);
    toks.forEach((t) => tokenCount.set(t, (tokenCount.get(t) || 0) + 1));
    return { id: fullId, name, toks, variant: null };
  });

  let material = null;
  let best = -1;
  for (const [tok, cnt] of tokenCount.entries()) {
    if (cnt > best) {
      best = cnt;
      material = tok;
    }
  }
  if (!material) material = stateInfos[0].toks.slice(-1)[0] || stateInfos[0].name;

  stateInfos.forEach((si) => {
    const toksCopy = si.toks.slice();
    const idx = toksCopy.indexOf(material);
    if (idx !== -1) toksCopy.splice(idx, 1);
    si.variant = toksCopy.length ? toksCopy.join("_") : "base";
  });

  const idxByName = new Map();
  const idxByVariant = new Map();
  stateInfos.forEach((si, i) => {
    idxByName.set(si.name, i);
    idxByVariant.set(si.variant, i);
    rememberName(si.name, si.id);
  });

  CYCLES.push({ material, states: stateInfos, idxByName, idxByVariant });
}

/* lookup exato (id -> { cycleIndex, stateIndex }) */
const BLOCK_LOOKUP = new Map();
CYCLES.forEach((cycle, ci) => {
  cycle.states.forEach((si, siIndex) => {
    BLOCK_LOOKUP.set(si.id, { cycleIndex: ci, stateIndex: siIndex });
  });
});

/* alias resolver */
function resolveAlias(blockId) {
  let cur = blockId;
  const visited = new Set();
  while (BLOCK_ALIAS.has(cur) && !visited.has(cur)) {
    visited.add(cur);
    cur = BLOCK_ALIAS.get(cur);
  }
  return cur;
}

/* find entry heurístico para blockId */
function findEntryForBlockId(blockId) {
  const aliased = resolveAlias(blockId);
  if (BLOCK_LOOKUP.has(aliased)) return BLOCK_LOOKUP.get(aliased);

  const name = stripNamespace(blockId);
  for (const [id, entry] of BLOCK_LOOKUP.entries()) {
    if (stripNamespace(id) === name) return entry;
  }

  const parsedTokens = tokensOf(name);
  for (let ci = 0; ci < CYCLES.length; ci++) {
    const cycle = CYCLES[ci];
    if (!parsedTokens.includes(cycle.material)) continue;

    // Evita encaixar blocos que só compartilham o token de material (ex: "acacia_planks" caindo no ciclo de troncos).
    const tokensWithoutMaterial = parsedTokens.filter((t) => t !== cycle.material);
    const hasNonMaterialOverlap = tokensWithoutMaterial.some((t) =>
      cycle.states.some((st) => st.toks.includes(t))
    );
    if (!hasNonMaterialOverlap) continue;

    const toksCopy = parsedTokens.slice();
    toksCopy.splice(toksCopy.indexOf(cycle.material), 1);
    const parsedVariant = toksCopy.length ? toksCopy.join("_") : "base";

    const variantIndex = cycle.idxByVariant.get(parsedVariant);
    if (variantIndex !== undefined)
      return { cycleIndex: ci, stateIndex: variantIndex };

    for (let si = 0; si < cycle.states.length; si++) {
      const sname = cycle.states[si].name;
      if (sname === name || sname.includes(name) || name.includes(sname)) {
        return { cycleIndex: ci, stateIndex: si };
      }
    }
    return { cycleIndex: ci, stateIndex: 0 };
  }

  for (let ci = 0; ci < CYCLES.length; ci++) {
    const cycle = CYCLES[ci];
    let shared = false;
    for (const t of parsedTokens) {
      if (t === cycle.material) continue; // não casar só pelo material
      for (const st of cycle.states) {
        if (st.toks.includes(t)) {
          shared = true;
          break;
        }
      }
      if (shared) break;
    }
    if (shared) return { cycleIndex: ci, stateIndex: 0 };
  }

  return undefined;
}

/* build next candidate id (tentativa de pular variantes ausentes) */
function buildCandidatesForState(stateInfo, originalNamespace) {
  const seen = new Set();
  const candidatesForState = [];
  const push = (id) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      candidatesForState.push(id);
    }
  };

  const declaredId = stateInfo.id;
  const stripped = stateInfo.name;

  push(declaredId);

  const sameName = NAME_TO_IDS.get(stripped);
  sameName?.forEach((id) => push(id));

  push(`${originalNamespace}:${stripped}`);
  push(`dorios_atelier:${stripped}`);
  push(`utilitycraft:${stripped}`);
  push(`minecraft:${stripped}`);

  return candidatesForState;
}

function buildCandidatesForLock(blockTypeId, lockTargetId) {
  const seen = new Set();
  const candidates = [];
  const push = (id) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      candidates.push(id);
    }
  };

  const currentNamespace = (blockTypeId && blockTypeId.split && blockTypeId.split(":")[0]) || "minecraft";
  const lockName = stripNamespace(lockTargetId);

  push(lockTargetId);
  for (const ns of getCompatibleNamespaces(currentNamespace)) {
    push(`${ns}:${lockName}`);
  }

  return candidates;
}

function formatVariantLabel(variant) {
  if (!variant || variant === "base" || variant === "default") return "Base";
  return variant
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function tryApplyLockedVariant(block, lock) {
  if (!lock?.variant) return false;

  const currentEntry = findEntryForBlockId(block.typeId) || BLOCK_LOOKUP.get(resolveAlias(block.typeId));
  if (!currentEntry) return false;

  const cycle = CYCLES[currentEntry.cycleIndex];
  const targetIndex = cycle.idxByVariant.get(lock.variant);
  if (targetIndex === undefined) return false;

  const targetState = cycle.states[targetIndex];
  const currentNamespace = (block.typeId && block.typeId.split && block.typeId.split(":")[0]) || "minecraft";
  const candidates = buildCandidatesForState(targetState, currentNamespace);
  for (const candidate of candidates) {
    if (candidate === block.typeId) return false;
    try {
      block.setType(candidate);
      return true;
    } catch (_) {
      continue;
    }
  }

  return false;
}

function getSelectedSlotIndex(player) {
  if (typeof player.selectedSlot === "number") return player.selectedSlot;
  if (typeof player.selectedSlotIndex === "number") return player.selectedSlotIndex;
  return undefined;
}

function findSlotWithType(container, typeId) {
  const size = typeof container.size === "number" ? container.size : 36;
  for (let i = 0; i < size; i++) {
    const candidate = container.getItem(i);
    if (candidate && (!typeId || candidate.typeId === typeId)) {
      return { slot: i, stack: candidate };
    }
  }
  return { slot: undefined, stack: undefined };
}

/* tentativa segura de obter o próximo bloco disponível, pulando variantes inexistentes */
function tryApplyNextVariant(block) {
  const currentEntry = findEntryForBlockId(block.typeId) || BLOCK_LOOKUP.get(resolveAlias(block.typeId));
  if (!currentEntry) return false;

  const cycle = CYCLES[currentEntry.cycleIndex];
  const len = cycle.states.length;

  // garantia: não permitir mudança de material — só proceder se o token material existir no bloco atual
  const originalTokens = tokensOf(stripNamespace(block.typeId));
  if (!originalTokens.includes(cycle.material)) return false;

  const originalNamespace = (block.typeId && block.typeId.split && block.typeId.split(":")[0]) || "minecraft";

  const triedGlobal = new Set();
  for (let step = 1; step <= len; step++) {
    const idx = (currentEntry.stateIndex + step) % len;
    const stateInfo = cycle.states[idx];
    const candidates = buildCandidatesForState(stateInfo, originalNamespace);

    for (const candidateId of candidates) {
      if (triedGlobal.has(candidateId)) continue;
      triedGlobal.add(candidateId);
      try {
        block.setType(candidateId);
        return true;
      } catch (_) {
        continue;
      }
    }
  }

  return false;
}

/* dano/consumo do formão — mais robusto e tolerante:
   - tenta usar slot selecionado
   - se não, procura a primeira pilha no container com mesmo typeId
   - modifica o slot correto (remove se quebrar)
*/
function damageHeldChisel(player, eventItemStack) {
  system.run(() => {
    try {
      const container = player.getComponent("minecraft:inventory")?.container;
      if (!container) return;

      let slot = getSelectedSlotIndex(player);
      let stack = slot !== undefined ? container.getItem(slot) : undefined;

      const needsMatch = !stack || (eventItemStack && stack.typeId !== eventItemStack.typeId);
      if (needsMatch) {
        const match = findSlotWithType(container, eventItemStack?.typeId);
        slot = match.slot;
        stack = match.stack;
      }

      if (!stack || slot === undefined) return;

      const durability = stack.getComponent?.("minecraft:durability");
      if (!durability) return;

      const current = typeof durability.damage === "number" ? durability.damage : 0;
      const max = typeof durability.maxDurability === "number" ? durability.maxDurability : undefined;
      const next = Math.min(current + 1, max ?? current + 1);
      durability.damage = next;
      const broke = typeof max === "number" && max > 0 && next >= max;
      if (broke) {
        try {
          player.playSound?.(soundConfig.toolBreakEventByKind.chisel);
        } catch (_) {}
      }
      container.setItem(slot, broke ? undefined : stack);
    } catch (_) {
      // silencioso por design (removido debug)
    }
  });
}

/* registro do componente customizado */
registerToolLockResolver(CHISEL_LOCK_KIND, viewedBlock => {
  const viewedEntry = findEntryForBlockId(viewedBlock?.typeId);
  if (!viewedEntry) return undefined;

  const cycle = CYCLES[viewedEntry.cycleIndex];
  const stateInfo = cycle.states[viewedEntry.stateIndex];
  const variant = stateInfo?.variant ?? "base";
  return {
    kind: CHISEL_LOCK_KIND,
    variant,
    state: variant,
    label: formatVariantLabel(variant)
  };
});

system.beforeEvents.startup.subscribe((initEvent) => {
  const handlers = {
    onUseOn(event) {
      try {
        const { block, source, itemStack } = event;
        if (!block || !source || !itemStack) return;
        const lock = readToolLockFromItem(itemStack, CHISEL_LOCK_KIND);

        const applied = lock ? tryApplyLockedVariant(block, lock) : tryApplyNextVariant(block);
        if (!applied) return;

        playToolMaterialSound(block, source, soundConfig.toolUseFallbackEventByKind.chisel);

        damageHeldChisel(source, itemStack);
      } catch (_) {}
    },
  };

  try {
    initEvent.itemComponentRegistry.registerCustomComponent(CHISEL_COMPONENT_ID, handlers);
  } catch (_) {}
});

world?.beforeEvents?.itemComponentBeforeDurabilityDamage?.subscribe?.((event) => {
  const stack = event?.itemStack;
  if (!stack?.typeId || !stack.typeId.endsWith(CHISEL_ID_SUFFIX)) {
    return;
  }

  const hasKnownNamespace = TOOL_NAMESPACES.some((namespace) => stack.typeId.startsWith(`${namespace}:`));
  if (!hasKnownNamespace) {
    return;
  }
  event.cancel = true;
});
