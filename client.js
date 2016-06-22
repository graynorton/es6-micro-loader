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

  var mapped = (pkg && pkg.map && _mapPath(path, pkg.map)) ||
    _mapPath(path, systemConfig.map) ||
    path;

  return mapped;
}

function _mapPath(path, map) {
  return path && map && (_fastMapPath(path, map) || _fullMapPath(path, map));
}

function _fastMapPath(path, map) {
  return map[path];
}

function matchPrefix(path, map) {
  for (var pre in map) {
    if (path.indexOf(pre) === 0) {
      return pre;
    }
  }
}

function _fullMapPath(path, map) {
  var pre = matchPrefix(path, map);
  if (pre) return map[pre] + path.substring(pre.length);
}

function lastPassPathSubstitution(path) {
  return _fullMapPath(path, systemConfig.paths) || path;
}

function getPackagePath(path) {
  return matchPrefix(path, systemConfig.packages);
}

function getPackageConfig(path) {
  var packagePath = getPackagePath(path);
  if (packagePath) return systemConfig.packages[packagePath];
}

function getExtension(path) {
  var packageConfig = getPackageConfig(path);
  var pkgDefault = packageConfig && packageConfig.defaultExtension;
  if (pkgDefault) return pkgDefault;
  if (systemConfig.defaultJSExtensions) return 'js';
}

function addExtension(path) {
  if (path.match(/\.(js|html|css|json)$/)) return path;
  var ext = getExtension(path);
  if (ext) return path + '.' + ext;
  return path;
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
function normalizeName(child, requestorPath) {
  return new Promise(function(resolve, reject) {
    if (child.charAt(0) === '/') {
        child = child.slice(1);
    }
    if (child.charAt(0) !== '.') {
      var extendrp = requestorPath ?
        extendPackageConfig(requestorPath) :
        Promise.resolve();

      return extendrp.then(function() {
        var mappedChild = mapPath(child, requestorPath);
        return extendPackageConfig(mappedChild).then(function() {
          return resolve(addExtension(getMain(mappedChild)));
        })
      });
        // if (requestorPath) {
        //   return extendPackageConfig(requestorPath).then(function() {
        //     return extendPackageConfig(child).then(function() {
        //       return resolve(addExtension(getMain(mapPath(child, requestorPath))));
        //     });
        //   });
        // }
        // else {
        //   return resolve(addExtension(getMain(mapPath(child))));
        // }
    }
    var rpParts = requestorPath ?
      requestorPath.split('/').slice(0, -1) :
      [];
    var parts = child.split('/');
    while (parts[0] === '.' || parts[0] === '..') {
        if (parts.shift() === '..') {
            rpParts.pop();
        }
    }
    return resolve(addExtension(getMain(rpParts.concat(parts).join('/'))));
  });
}

var seen = Object.create(null);
var internalRegistry = Object.create(null);
var externalRegistry = Object.create(null);
var pendingLoads = Object.create(null);
var pendingImports = Object.create(null);
var systemConfig = Object.create(null);
var extendedConfigs = Object.create(null);
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

function addPackageConfigExpressions(inCfg) {
  if (inCfg.packageConfigPaths) {
    var patterns = inCfg.packageConfigPaths.map(function(pattern) {
      var ext = '.json';
      var subpaths = pattern.split('/');
      var numSub = subpaths.length;
      var filename = subpaths[numSub - 1].replace(ext, '');
      if (filename.lastIndexOf('*') === filename.length - 1) {
        subpaths[numSub - 1] = filename;
        filename = undefined;
      }
      else {
        subpaths.length = numSub - 1;
      }
      var exprStr = subpaths.reduce(function(head, sub) {
        return head + sub.replace('*', '[^/]+/');
      }, '^');
      var expr = new RegExp(exprStr.substr(0, exprStr.length - 1));
      var suf = filename ? '/' + filename + ext : ext;
      return function(path) {
        var match = path.match(expr);
        if (match) {
          var pkg = match[0].replace(/\.json$/, '');
          return {
            config: pkg + suf,
            package: pkg
          };
        }
      };
    });
    systemConfig.packageConfigPaths = patterns;
  }
}

function config(inCfg) {
  ['map', 'packages', 'paths', 'browserConfig'].forEach(function(prop) {
    systemConfig[prop] = systemConfig[prop] || {};
    assign(systemConfig[prop], inCfg[prop]);
  });

  if (inCfg.baseURL) systemConfig.baseURL = inCfg.baseURL;
  if (inCfg.defaultJSExtensions) systemConfig.defaultJSExtensions = inCfg.defaultJSExtensions;

  addPackageConfigExpressions(inCfg);
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

function AJAX(url, callback) {
  var r = new XMLHttpRequest();
  r.onreadystatechange = function() {
    if (r.readyState === XMLHttpRequest.DONE) {
      if (r.status === 200) {
        callback(r.responseText);
      }
      else {
        console.log('waah.', r.status);
        // callback(new Error());
      }
    }
  };
  r.open('GET', url);
  r.send();
}

function mergeConfig(pkgName, inCfgModule) {
  var cfg = systemConfig.packages[pkgName] || {};
  systemConfig.packages[pkgName] = cfg;
  var inCfg = inCfgModule.default;
  for (var prop in inCfg) {
    var inVal = inCfg[prop];
    if (typeof inVal === 'object') {
      cfg[prop] = assign(cfg[prop] || {}, inVal);
    }
    else {
      cfg[prop] = inVal;
    }
  }
  console.log(systemConfig.packages[pkgName]);
}

function extendPackageConfig(name) {
  var pcps = systemConfig.packageConfigPaths;
  // if (!pcps) return Promise.reject();
  if (!pcps) return Promise.resolve();
  var num = pcps ? pcps.length : 0;
  for (var i = 0; i < num; i++) {
    var match = pcps[i](name);
    if (match && match.config !== name) {
      if (!extendedConfigs[match.package]) {
        extendedConfigs[match.package] = _import(match.config).then(function(cfgModule) {
          mergeConfig(match.package, cfgModule);
        });
      }
      return extendedConfigs[match.package];
    }
  }
  // return Promise.reject();
  return Promise.resolve();
}

function load(name) {
    if (pendingLoads[name]) return pendingLoads[name];
    var path = addBase(lastPassPathSubstitution(name));
    pendingLoads[name] = new Promise(function(resolve, reject) {
        // createScriptNode(path, function(err) {
        AJAX(path, function(content) {
            if (content instanceof Error) return reject(content);
            try {
              /*jshint -W054 */
              var f = new Function('System', content);
              f(System);
              // if (ext === '.js') {
              //   /*jshint -W054 */
              //   var f = new Function('System', content);
              //   f(System);
              // }
              // if (ext === '.json') {
              //   resolve(JSON.parse(content));
              // }
            }
            catch (e) {
              console.log(name, path, e);
              return reject(e);
            }
            if (anonymousEntry) {
                System.register(name, anonymousEntry[0], anonymousEntry[1]);
                anonymousEntry = undefined;
            }
            var mod = internalRegistry[name];
            if (!mod) {
                return reject(new Error('Error loading module ' + name));
            }
            return mod.deps.then(function(nDeps) {
              Promise.all(nDeps.map(function(dep) {
                return load(dep);
              })).then(function() {
                resolve(mod);
              });
            });
        });
    });
    return pendingLoads[name];
}

function __import(name) {
    return normalizeName(name).then(function(nName) {
      if (pendingImports[nName]) {
        return pendingImports[nName];
      }
      pendingImports[nName] = new Promise(function(resolve, reject) {
          var ext = externalRegistry[nName];
          if (ext) resolve(ext);

          var int = internalRegistry[nName];
          if (int) return resolve(int.execute());

          return load(nName)
            .then(function(loaded) {
                resolve(loaded.execute());
            })
            .catch(function(reason) {
              console.log('load failed');
              // return extendPackageConfig(name)
              //   .then(function() {
              //     return __import(name);
              //   });
            });
      });
      return pendingImports[nName];
    });
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
            deps: new Promise(function(resolve, reject) {
              var nDeps = [];
              Promise.all(deps.map(function(dep) {
                var idx = deps.indexOf(dep);
                return normalizeName(dep, name).then(function(nName) {
                  nDeps[idx] = nName;
                  return nName;
                });
              })).then(function() {
                return resolve(nDeps);
              });
            }),
            // other modules that depends on this so we can push updates into those modules
            dependants: [],
            // method used to push updates of deps into the module body
            update: function(moduleName, moduleObj) {
                mod.deps.then(function(nDeps) {
                  meta.setters[nDeps.indexOf(moduleName)](moduleObj);
                });
            },
            execute: function() {
              return new Promise(function(resolve, reject) {
                return mod.deps.then(function(nDeps) {
                  return Promise.all(nDeps.map(function(depName) {
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
          depLookup = [],
          mod;
      // creating a new entry in the internal registry
      internalRegistry[name] = mod = {
          // live bindings
          // proxy: values,
          // exported values
          // values: values,
          // normalized deps
          deps: new Promise(function(resolve, reject) {
            var nDeps = [];
            Promise.all(deps.map(function(dep) {
              var idx = deps.indexOf(dep);
              return normalizeName(dep, name).then(function(nName) {
                nDeps[idx] = nName;
                depLookup[dep] = nName;
                return nName;
              });
            })).then(function() {
              return resolve(nDeps);
            });
          }),
          // other modules that depends on this so we can push updates into those modules
          dependants: [],
          // method used to push updates of deps into the module body
          // update: function(moduleName, moduleObj) {
          //     console.log('Update no-op');
          //     // meta.setters[mod.deps.indexOf(moduleName)](moduleObj);
          // },
          execute: function() {
            function getDep(depName) {
              var nName = depLookup[depName];
              var mod = get(nName);
              return mod.default;
            }
            if (executingRequire) {
              return mod.deps.then(function(nDeps) {
                return Promise.all(nDeps.map(function(dep) {
                    return __import(dep);
                })).then(function() {
                  declare(getDep, null, mod);
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
                });
              });
            }
            else {
              mod.values = {default: declare()};
              return Promise.resolve(mod);
            }
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
System._extendedConfigs = extendedConfigs;

})(window);
