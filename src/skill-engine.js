const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const TOOL = /^[a-z][a-z0-9._-]{0,63}$/;

export function compileSkill(definition) {
  if (!definition || typeof definition !== "object") throw new TypeError("Skill muss ein Objekt sein.");
  if (!ID.test(definition.id || "")) throw new TypeError("Ungültige Skill-ID.");
  if (!definition.name || !definition.description || !definition.version) throw new TypeError("Name, Beschreibung und Version sind Pflicht.");
  if (!Array.isArray(definition.steps) || definition.steps.length < 1 || definition.steps.length > 20) throw new TypeError("Ein Skill braucht 1 bis 20 Schritte.");

  const ids = new Set();
  const steps = definition.steps.map((step) => {
    if (!step || !ID.test(step.id || "") || ids.has(step.id)) throw new TypeError("Ungültige oder doppelte Schritt-ID.");
    if (!TOOL.test(step.tool || "")) throw new TypeError("Ungültiger Tool-Name.");
    if (step.args && (typeof step.args !== "object" || Array.isArray(step.args))) throw new TypeError("Schritt-args muss ein Objekt sein.");
    const maxAttempts = step.maxAttempts ?? 1;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new TypeError("maxAttempts muss zwischen 1 und 3 liegen.");
    ids.add(step.id);
    return Object.freeze({
      id: step.id,
      tool: step.tool,
      args: Object.freeze({ ...(step.args || {}) }),
      requiresApproval: step.requiresApproval === true,
      retrySafe: step.retrySafe === true,
      maxAttempts
    });
  });

  return Object.freeze({
    id: definition.id,
    name: definition.name.trim(),
    description: definition.description.trim(),
    version: definition.version.trim(),
    steps: Object.freeze(steps)
  });
}

export async function executeSkill(skill, options = {}) {
  const tools = options.tools || {};
  const input = options.input || {};
  const approve = options.approve || (async () => false);
  const onStep = options.onStep || (async () => {});
  const outputs = {};
  const audit = [];

  for (const step of skill.steps) {
    const adapter = tools[step.tool];
    if (!adapter || typeof adapter.execute !== "function") {
      const error = "Tool nicht verfügbar: " + step.tool;
      const event = { stepId: step.id, status: "failed", error };
      audit.push(event);
      await onStep(event);
      return { status: "failed", outputs, audit, error };
    }

    if (step.requiresApproval && await approve({ skillId: skill.id, stepId: step.id, tool: step.tool, args: step.args }) !== true) {
      const pendingApproval = { stepId: step.id, status: "awaiting_approval", tool: step.tool };
      audit.push(pendingApproval);
      await onStep(pendingApproval);
      return { status: "awaiting_approval", outputs, audit, pendingApproval };
    }

    const retries = step.retrySafe && adapter.idempotent === true ? step.maxAttempts : 1;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        outputs[step.id] = await adapter.execute({
          args: step.args, input, outputs: { ...outputs },
          skill: { id: skill.id, version: skill.version },
          step: { id: step.id, attempt }
        });
        const event = { stepId: step.id, status: "completed", attempt };
        audit.push(event);
        await onStep(event);
        break;
      } catch (caught) {
        const error = caught instanceof Error ? caught.message.slice(0, 300) : "Unbekannter Tool-Fehler";
        const event = { stepId: step.id, status: "attempt_failed", attempt, error };
        audit.push(event);
        await onStep(event);
        if (attempt === retries) return { status: "failed", outputs, audit, error };
      }
    }
  }
  return { status: "completed", outputs, audit };
}
