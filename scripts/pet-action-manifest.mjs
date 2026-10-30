export const petActionIds = ["wave", "rest", "look", "stretch", "companion", "blink"];

export default function petActionManifest() {
  return {
    name: "pet-action-manifest",
    generateBundle(_options, bundle) {
      const actions = {};
      const rig = {};
      for (const [fileName, asset] of Object.entries(bundle)) {
        const match = /(?:^|\/)nailao-action-(wave|rest|look|stretch|companion|blink)-image2-[^/]+\.gif$/.exec(fileName);
        if (asset.type === "asset" && match) actions[match[1]] = fileName;
        const texture = /(?:^|\/)rig-(wave|rest|look|stretch|companion|blink)-[^/]+\.png$/.exec(fileName);
        if (asset.type === "asset" && texture) rig[texture[1]] = fileName;
      }
      for (const id of petActionIds) if (!actions[id]) this.error(`Missing bundled pet action: ${id}`);
      for (const id of petActionIds) if (!rig[id]) this.error(`Missing bundled pet rig: ${id}`);
      this.emitFile({ type: "asset", fileName: "pet-actions.json", source: JSON.stringify(actions, null, 2) });
      this.emitFile({ type: "asset", fileName: "pet-rig.json", source: JSON.stringify(rig, null, 2) });
    },
  };
}
