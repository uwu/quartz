const resolve = (path, relativeTo) => {
	if (path[0] === "/") return path;

	const parts = relativeTo.split("/");
	for (const part of path.split("/")) {
		if (part === ".") parts.pop();
		else if (part === "..") {
			parts.pop();
			parts.pop();
		} else parts.push(part);
	}

	return parts.join("/");
};

export default ({ urlImport, localImport, quartz }) => {
  // just count up since each instance of this plugin gets its own store
  let storeCounter = 0;

  const myself = {
    async resolve({ config, accessor, store, name, moduleId }) {
      const prePlugins = [];
      for (const plugin of config.plugins) {
        if (plugin === myself) break;
        prePlugins.push(plugin);
      }

      let rawCode;
      let subModuleId;

      if (name.match(/^http(s?):\/\//)) {
        if (!urlImport) return;
        rawCode = await urlImport(name);
        subModuleId = name;
      } else {
        if (!localImport) return;
        subModuleId = resolve(name, moduleId);
        rawCode = await localImport(subModuleId);
      }

      if (rawCode === undefined) return;

      store[++storeCounter] = await quartz(rawCode, subModuleId, {
        ...config,
        plugins: prePlugins,
      });

      return `${accessor}[${storeCounter}]`;
    },
  };

  return myself;
};

// tree shakable simple implementation of urlImport() using fetch
export const fetchUrlImport = (code) => fetch(code).then(r => r.text());