export const petActionIds = ["wave", "rest", "look", "stretch", "companion", "blink"];

export default function petActionManifest() {
  return {
    name: "pet-action-manifest",
    generateBundle(_options, bundle) {
      const actions = {};
      const motion = {};
      for (const [fileName, asset] of Object.entries(bundle)) {
        const match = /(?:^|\/)nailao-action-(wave|rest|look|stretch|companion|blink)-image2-[^/]+\.gif$/.exec(fileName);
        if (asset.type === "asset" && match) actions[match[1]] = fileName;
        const flow = /(?:^|\/)motion-(wave|rest|look|stretch|companion|blink)-[^/]+\.png$/.exec(fileName);
        if (asset.type === "asset" && flow) motion[flow[1]] = fileName;
      }
      for (const id of petActionIds) if (!actions[id]) this.error(`Missing bundled pet action: ${id}`);
      for (const id of petActionIds) if (!motion[id]) this.error(`Missing bundled pet motion: ${id}`);
      this.emitFile({ type: "asset", fileName: "pet-actions.json", source: JSON.stringify(actions, null, 2) });
      this.emitFile({ type: "asset", fileName: "pet-motion.json", source: JSON.stringify(motion, null, 2) });
    },
  };
}
