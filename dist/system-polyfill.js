(function(exports) {
  // Begin Object.assign polyfill
  // from https://github.com/sindresorhus/object-assign

  'use strict';
  /* eslint-disable no-unused-vars */
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var propIsEnumerable = Object.prototype.propertyIsEnumerable;

  function toObject(val) {
  	if (val === null || val === undefined) {
  		throw new TypeError('Object.assign cannot be called with null or undefined');
  	}

  	return Object(val);
  }

  function shouldUseNative() {
  	try {
  		if (!Object.assign) {
  			return false;
  		}

  		// Detect buggy property enumeration order in older V8 versions.

  		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
  		var test1 = 'abc';  // eslint-disable-line
  		test1[5] = 'de';
  		if (Object.getOwnPropertyNames(test1)[0] === '5') {
  			return false;
  		}

  		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
  		var test2 = {};
  		for (var i = 0; i < 10; i++) {
  			test2['_' + String.fromCharCode(i)] = i;
  		}
  		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
  			return test2[n];
  		});
  		if (order2.join('') !== '0123456789') {
  			return false;
  		}

  		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
  		var test3 = {};
  		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
  			test3[letter] = letter;
  		});
  		if (Object.keys(Object.assign({}, test3)).join('') !==
  				'abcdefghijklmnopqrst') {
  			return false;
  		}

  		return true;
  	} catch (e) {
  		// We don't expect any of the above to throw, but better to be safe.
  		return false;
  	}
  }

  var assign = shouldUseNative() ? Object.assign : function (target, source) {
  	var from;
  	var to = toObject(target);
  	var symbols;

  	for (var s = 1; s < arguments.length; s++) {
  		from = Object(arguments[s]);

  		for (var key in from) {
  			if (hasOwnProperty.call(from, key)) {
  				to[key] = from[key];
  			}
  		}

  		if (Object.getOwnPropertySymbols) {
  			symbols = Object.getOwnPropertySymbols(from);
  			for (var i = 0; i < symbols.length; i++) {
  				if (propIsEnumerable.call(from, symbols[i])) {
  					to[symbols[i]] = from[symbols[i]];
  				}
  			}
  		}
  	}

  	return to;
  };

// End Object.assign polyfill

var headEl = document.getElementsByTagName('head')[0],
    ie = /MSIE/.test(navigator.userAgent);

function mapPath(path, packagePath) {
  var pkg = packagePath && systemConfig.packages[packagePath];

  return (pkg && pkg.map && _mapPath(path, pkg.map)) ||
    _mapPath(path, systemConfig.map) ||
    path;
}

function _mapPath(path, map) {
  return path && map && (_fastMapPath(path, map) || _fullMapPath(path, map));
}

function _fastMapPath(path, map) {
  return map[path];
}

function _fullMapPath(path, map) {
  for (var pre in map) {
    if (path.indexOf(pre) === 0) {
      return map[pre] + path.substring(pre.length);
    }
  }
}

function addSuffix(fileName) {
  return (fileName.indexOf('.js') === -1) ?
    fileName + '.js' :
    fileName;
}

function addBase(path) {
  return (systemConfig.baseURL || '/') + path;
}

function getMain(path) {
  var pkg, main;
  if ((pkg = systemConfig.packages[path])) {
    if ((main = pkg.main)) {
      return path + '/' + main;
    }
  }
  return path;
}

/*
  normalizeName() is inspired by Ember's loader:
  https://github.com/emberjs/ember.js/blob/0591740685ee2c444f2cfdbcebad0bebd89d1303/packages/loader/lib/main.js#L39-L53
 */
function normalizeName(child, parentBase) {
    if (child.charAt(0) === '/') {
        child = child.slice(1);
    }
    if (child.charAt(0) !== '.') {
        return addSuffix(getMain(mapPath(child)));
    }
    var parts = child.split('/');
    while (parts[0] === '.' || parts[0] === '..') {
        if (parts.shift() === '..') {
            parentBase.pop();
        }
    }
    return addSuffix(getMain(mapPath(parentBase.concat(parts).join('/'))));
}

var seen = Object.create(null);
var internalRegistry = Object.create(null);
var externalRegistry = Object.create(null);
var pendingLoads = Object.create(null);
var pendingImports = Object.create(null);
var systemConfig = Object.create(null);
var anonymousEntry;

// function ensuredExecute(name) {
//     var mod = internalRegistry[name];
//     if (mod && !seen[name]) {
//         seen[name] = true;
//         // one time operation to execute the module body
//         mod.execute();
//     }
//     return mod && mod.proxy;
// }

function set(name, values) {
    externalRegistry[name] = {values: values};
}

function get(name) {
  return (externalRegistry[name] && externalRegistry[name].values) ||
    (internalRegistry[name] && internalRegistry[name].values);
}

function has(name) {
    return !!externalRegistry[name] || !!internalRegistry[name];
}

function normalizeNameAndGet(name) {
  return get(normalizeName(name));
}

function config(inCfg) {
  ['map', 'packages', 'paths', 'browserConfig'].forEach(function(prop) {
    systemConfig[prop] = systemConfig[prop] || {};
    assign(systemConfig[prop], inCfg[prop]);
  });
  if (inCfg.baseURL) systemConfig.baseURL = inCfg.baseURL;
}

function createScriptNode(src, callback) {
    var node = document.createElement('script');
    // use async=false for ordered async?
    // parallel-load-serial-execute http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
    if (node.async) {
        node.async = false;
    }
    if (ie) {
        node.onreadystatechange = function() {
            if (/loaded|complete/.test(this.readyState)) {
                this.onreadystatechange = null;
                callback();
            }
        };
    } else {
        node.onload = node.onerror = callback;
    }
    node.setAttribute('src', src);
    headEl.appendChild(node);
}

function load(name) {
    if (pendingLoads[name]) return pendingLoads[name];

    pendingLoads[name] = new Promise(function(resolve, reject) {
        createScriptNode(addBase(name), function(err) {
            if (anonymousEntry) {
                System.register(name, anonymousEntry[0], anonymousEntry[1]);
                anonymousEntry = undefined;
            }
            var mod = internalRegistry[name];
            if (!mod) {
                reject(new Error('Error loading module ' + name));
                return;
            }
            Promise.all(mod.deps.map(function (dep) {
                // if (externalRegistry[dep] || internalRegistry[dep]) {
                //     return Promise.resolve();
                // }
                return load(dep);
            })).then(function() {
              resolve(mod);
            });
        });
    });
    return pendingLoads[name];
}

function __import(name, skipNormalization) {
    var nName = skipNormalization ? name : normalizeName(name, []);
    if (pendingImports[nName]) {
      return pendingImports[nName];
    }
    pendingImports[nName] = new Promise(function(resolve, reject) {
        var ext = externalRegistry[nName];
        if (ext) resolve(ext);

        var int = internalRegistry[nName];
        if (int) resolve(int.execute());

        return load(nName).then(function(loaded) {
            resolve(loaded.execute());
        });
    });
    return pendingImports[nName];
}

function _import(name) {
  return __import(name).then(function(mod) {
    return mod.values;
  });
}

var System = {
    set: set,
    get: get,
    has: has,
    config: config,
    import: _import,
    register: function(name, deps, wrapper) {
        if (Array.isArray(name)) {
            // anounymous module
            anonymousEntry = [];
            anonymousEntry.push.apply(anonymousEntry, arguments);
            return; // breaking to let the script tag to name it.
        }
        var proxy = Object.create(null),
            values = Object.create(null),
            mod, meta;
        // creating a new entry in the internal registry
        internalRegistry[name] = mod = {
            // live bindings
            proxy: proxy,
            // exported values
            values: values,
            // normalized deps
            deps: deps.map(function(dep) {
                return normalizeName(dep, name.split('/').slice(0, -1));
            }),
            // other modules that depends on this so we can push updates into those modules
            dependants: [],
            // method used to push updates of deps into the module body
            update: function(moduleName, moduleObj) {
                meta.setters[mod.deps.indexOf(moduleName)](moduleObj);
            },
            execute: function() {
              return new Promise(function(resolve, reject) {
                return Promise.all(mod.deps.map(function(depName) {
                    var dep = externalRegistry[depName];
                    if (dep) {
                        mod.update(depName, dep.values);
                        return Promise.resolve();
                    } else {
                        return __import(depName).then(function(dep) {
                          dep.dependants.push(name);
                          mod.update(depName, dep.values);
                          return Promise.resolve();
                        });
                    }
                })).then(function() {
                  meta.execute();
                  resolve(mod);
                });
            });
          }
        };
        // collecting execute() and setters[]
        meta = wrapper(function(identifier, value) {
            function initValue(id, value) {
              values[id] = value;
              if (!Object.getOwnPropertyDescriptor(proxy, id)) {
                  Object.defineProperty(proxy, id, {
                      enumerable: true,
                      get: function() {
                          return values[id];
                      }
                  });
              }
            }
            if (typeof identifier === 'object') {
              for (var id in identifier) {
                initValue(id, identifier[id]);
              }
            }
            else {
              initValue(identifier, value);
            }
            mod.lock = true; // locking down the updates on the module to avoid infinite loop
            mod.dependants.forEach(function(moduleName) {
                if (internalRegistry[moduleName] && !internalRegistry[moduleName].lock) {
                    internalRegistry[moduleName].update(name, values);
                }
            });
            mod.lock = false;
            return value;
        });
    },
    registerDynamic: function(name, deps, executingRequire, declare) {
      if (Array.isArray(name)) {
          // anounymous module
          anonymousEntry = [];
          anonymousEntry.push.apply(anonymousEntry, arguments);
          return; // breaking to let the script tag to name it.
      }
      var //proxy = Object.create(null),
          // values = Object.create(null),
          mod;
      // creating a new entry in the internal registry
      internalRegistry[name] = mod = {
          // live bindings
          // proxy: values,
          // exported values
          // values: values,
          // normalized deps
          deps: deps.map(function(dep) {
              return normalizeName(dep, name.split('/').slice(0, -1));
          }),
          // other modules that depends on this so we can push updates into those modules
          dependants: [],
          // method used to push updates of deps into the module body
          // update: function(moduleName, moduleObj) {
          //     console.log('Update no-op');
          //     // meta.setters[mod.deps.indexOf(moduleName)](moduleObj);
          // },
          execute: function() {
              function normalizeDepNameAndGet(depName) {
                return get(normalizeName(depName, name.split('/').slice(0, -1))).default;
              }
              declare(normalizeDepNameAndGet, null, mod);
              mod.proxy = {default: mod.exports};
              mod.values = mod.proxy;
              return Promise.resolve(mod);
              // mod.lock = true; // locking down the updates on the module to avoid infinite loop
              // mod.dependants.forEach(function(moduleName) {
              //     if (internalRegistry[moduleName] && !internalRegistry[moduleName].lock) {
              //         internalRegistry[moduleName].update(name, values);
              //     }
              // });
              // mod.lock = false;
          }
      };
    }
};

// exporting the System object
exports.System = System;
exports.SystemJS = System;

// temp
System._config = systemConfig;
System._pendingLoads = pendingLoads;
System._pendingImports = pendingImports;

})(window);
