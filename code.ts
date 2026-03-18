figma.showUI(__html__, { width: 540, height: 420 });

type SerializedValue =
  | string
  | number
  | boolean
  | null
  | SerializedValue[]
  | { [key: string]: SerializedValue };

function serializeUnknown(
  value: unknown,
  depth: number,
  seen: Set<unknown>
): SerializedValue {
  if (value === null) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'undefined') {
    return '[undefined]';
  }

  if (typeof value === 'bigint') {
    return `${String(value)}n`;
  }

  if (typeof value === 'symbol') {
    return String(value);
  }

  if (typeof value === 'function') {
    const fn = value as Function;
    return `[function ${fn.name || 'anonymous'}]`;
  }

  if (depth <= 0) {
    return '[max-depth]';
  }

  if (seen.has(value)) {
    return '[circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeUnknown(item, depth - 1, seen));
  }

  const output: { [key: string]: SerializedValue } = {};
  const objectValue = value as Record<string, unknown>;

  for (const key of Object.keys(objectValue)) {
    try {
      output[key] = serializeUnknown(objectValue[key], depth - 1, seen);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output[key] = `[error: ${message}]`;
    }
  }

  return output;
}

function getAllPropertyNames(target: object): string[] {
  const names = new Set<string>();
  let current: object | null = target;

  while (current && current !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(current)) {
      if (key !== 'constructor') {
        names.add(key);
      }
    }
    current = Object.getPrototypeOf(current);
  }

  return Array.from(names).sort();
}

function inspectNode(node: SceneNode): { [key: string]: SerializedValue } {
  const result: { [key: string]: SerializedValue } = {};
  const props = getAllPropertyNames(node);

  for (const prop of props) {
    try {
      const rawValue = (node as unknown as Record<string, unknown>)[prop];
      result[prop] = serializeUnknown(rawValue, 3, new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result[prop] = `[unreadable: ${message}]`;
    }
  }

  return result;
}

function sendSelectionToUI() {
  const selection = figma.currentPage.selection;
  const payload = {
    page: figma.currentPage.name,
    selectionCount: selection.length,
    timestamp: new Date().toISOString(),
    nodes: selection.map(inspectNode),
  };

  figma.ui.postMessage({ type: 'selection-data', payload });
}

figma.on('selectionchange', sendSelectionToUI);

figma.ui.onmessage = (msg: { type?: string }) => {
  if (msg.type === 'refresh-selection') {
    sendSelectionToUI();
    return;
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

sendSelectionToUI();
