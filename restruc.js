var 	fs 			= require('fs'),
		path 		= require('path'),
		clone		= require('clone');

const ERROR = {
	noError: {"code": 0, "msg": ""},
	empty: {"code": 1, "msg": "The parameter is empty"},
	noExists: {"code": 2, "msg": "The path no exists"},
	exists: {"code": 3, "msg": "The path already exists"},
	system : {"code": 999, "msg": "System error"}
}

function Restruc(config, apisConfig) {

	var self = this;
	self.config = config;
	self.apisConfig = apisConfig;

	self.skelProject = {
		"src" : {
			"test" : {},
			"lib" : {
				"package.json": "empty"
			}
		},
		"README.md": "empty"
	};
	
	self.skelApi = {
		"README.md": "empty",
		"app": {
			"path": {},
			"paths.js": "empty",
			"main.js": "empty"
		},
		"test": {},
		"www": {
			"test": {},
			"app": {
				"init.js": "empty",
				"lang": {
					"en-us.js": "empty"
				},
				"resource": {},
				"screen": {
					"welcome.js": "empty",
					"welcome.html": "empty"
				},
				"ui": {}
			},
			"css": {},
			"js": {},
			"img": {},
			"index.html": "empty"
		}
	};
		
	
	var result = createDirectories();
	console.log("result", result)

	function createDirectories() {
		
		var e = ERROR.noError;
		try {
			var r = self.config.restruc;
			var e = checkPath(r.dirBase);
			if (e !== ERROR.exists) {
				e.dirBase = r.dirBase;
				return e;
			} else {
				e = checkPath(r.projectName);
				if (e === ERROR.empty) {
					e.projectName = r.projectName;
					return e;
				} else {
					var basePath = path.join(r.dirBase, r.projectName.replace(" ", "_").toLowerCase());					
					e = createDir(basePath);	
					if (e === ERROR.noError) {
						if (e === ERROR.noError) {
							for (var apiName in self.apisConfig) {
								self.skelProject.src[apiName] = clone(self.skelApi);
								var apiDefinition = require(__dirname + '/public/data/' + apiName + '.json');
								self.skelProject.src[apiName]["app"]["paths.js"] = createServerPaths(apiDefinition, self.skelProject.src[apiName]["app"]);
							}
						}
						e = createSkel(basePath, self.skelProject);
					}
					return e;
				}
			}
		} catch (err) {
			e = ERROR.system;
			e.err = err;
			return e;
		}
	}


	function createServerPaths(apiDefinition, skelApp) {
		var paths = "exports.paths = [\n";
		for (var i = 0; i < apiDefinition.endpoints.length; i++) {
			var endpoint = apiDefinition.endpoints[i];
			for (var j = 0; j < endpoint.methods.length; j++) {
				var method = endpoint.methods[j];
				if (i !== 0) {
					paths += "\n,";
				}
				paths += "\n\t{\t'method'\t: '" + method["HTTPMethod"] + "'";
				paths +=  "\n\t,\t'path'\t\t: '" + method["URI"] + "'";
				if (method["require"]) {
					if (Object.prototype.toString.call( method["require"] ) === '[object Array]') {
						paths +=  "\n\t,\t'handler'\t: [ ";
						for (var k = 0; k < method["require"].length; k++) {
							if (k !== 0) {
								paths += ", ";
							}
							paths += "require('./path/" + method["require"][k] + "')";
							skelApp["path"][method["require"][k]] = "empty";
						}
						paths +=  " ]";		
					} else {
						paths +=  "\n\t,\t'handler'\t: require('./path/" + method["require"] + "')";
						skelApp["path"][method["require"]] = "empty";
					}
				} else {
					paths +=  "\n\t,\t'handler'\t: require('./path/...')";
				}

				
				paths += "\n\t}";
			}
		}
		paths += "\n]";

		return paths;
	}

	function createSkel(basePath, skel) {
		var e = ERROR.noError;

		for (var file in skel) {
			var pathFile = path.join(basePath, file);
			if (typeof skel[file] === "object") {
				e = createDir(pathFile);
				if (e !== ERROR.noError) {
					break;
				} else {
					e = createSkel(pathFile, skel[file]);
					if (e !== ERROR.noError) {
						break;
					}	
				}				
			} else if (typeof skel[file] === "string") {
				if (skel[file] === "empty") {
					createFile(pathFile);	
				} else {
					fs.writeFileSync(pathFile, skel[file]);
				}
			}		
		}
		return e;
	}

	function checkPath(path) {
		if (!path) {
			return ERROR.empty;
		} else {
			if (!fs.existsSync(path)) {
				return ERROR.noExists;
			} else {
				return ERROR.exists;
			}
		}
	}

	function createDir(path) {
		var e = checkPath(path);
		if (e === ERROR.empty) {
			return e;
		} else {
			if (!fs.existsSync(path)) {
				fs.mkdirSync(path);
			}
			return ERROR.noError;
		}
	}

	function createFile(path) {
		var e = checkPath(path);
		if (e === ERROR.empty) {
			return e;
		} else {
			if (!fs.existsSync(path)) {
				fs.closeSync(fs.openSync(path, 'w'));
			}
			return ERROR.noError;
		}
	}
}

exports.Restruc = Restruc;